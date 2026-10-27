// Локальный сервер AI-офиса на Rust: перенос server/office-server.mjs, только для Windows.
// Как работает:
//   1) Пока обои открыты (опрашивают состояние), раз в 4 секунды смотрит, какие AI-программы запущены:
//      Claude Code, Claude, Codex, ChatGPT, Ollama и др. Пока процесс открыт, его агент сидит в офисе.
//   2) Хуки Claude Code и Codex присылают события (POST /event): работает, ждёт тебя, закончил, команда упала,
//      тесты прошли, git push, субагенты (стажёры), упёрся в лимит.
//   3) Обои читают состояние: GET /state или Office::state(). HTTP слушает только 127.0.0.1 и требует ключ из token.txt.
//   4) Сводка дня из локальных логов Claude Code, история за неделю и кубки в office-state.json.
//   5) Лимиты: окно 5 часов Claude (оценка по логам) и проценты лимитов Codex из его логов.
//   6) Нагрузка ПК, игра на весь экран, занятый микрофон, простой мыши и клавиатуры, POST /focus.
// Процессы и окна смотрим напрямую через Windows API, без PowerShell.
mod http;
mod logs;
mod procs;
mod sessions;
mod win;
pub mod hooks;
#[doc(hidden)]
pub use logs::bench;

use std::collections::{HashMap, VecDeque};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicI64};
use std::sync::{Arc, Mutex, MutexGuard, TryLockError};
use std::time::Duration;

use anyhow::anyhow;
use serde_json::{json, Map, Value};

pub(crate) const IDLE_MS: i64 = 30_000;      // обои не спрашивали 30 с: перестаём сканировать
const SCAN_MS: u64 = 4000;

pub(crate) fn now_ms() -> i64 { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0) }
pub(crate) fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> { m.lock().unwrap_or_else(|e| e.into_inner()) }
pub(crate) fn try_lock<T>(m: &Mutex<T>) -> Option<MutexGuard<'_, T>> {
    match m.try_lock() { Ok(g) => Some(g), Err(TryLockError::Poisoned(e)) => Some(e.into_inner()), Err(TryLockError::WouldBlock) => None }
}
/// Первые n символов (как slice(0, n) в JS).
pub(crate) fn clip(s: &str, n: usize) -> String { s.chars().take(n).collect() }
/// Число в JSON как в JS: целое без «.0», NaN — null.
pub(crate) fn num(f: f64) -> Value {
    if f.is_finite() && f.fract() == 0.0 && f.abs() < 9e15 { Value::from(f as i64) } else { Value::from(f) }
}
/// String(v) из JS для значений из JSON.
pub(crate) fn js_str(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => "null".into(),
        Value::Array(a) => a.iter().map(|x| if x.is_null() { String::new() } else { js_str(x) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
        x => x.to_string(),
    }
}
/// Истинность значения в JS.
pub(crate) fn truthy(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|f| f != 0.0 && !f.is_nan()),
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    }
}
/// String(v || '') из JS.
pub(crate) fn sor(v: Option<&Value>) -> String { if truthy(v) { js_str(v.unwrap()) } else { String::new() } }
pub(crate) fn home() -> PathBuf { std::env::var_os("USERPROFILE").map(PathBuf::from).unwrap_or_default() }

pub(crate) struct Fx { pub n: u64, pub sid: String, pub typ: String, pub at: i64, pub id: Option<String> }

/// Всё изменяемое состояние сервера. Держим замок коротко: тяжёлая работа (процессы, логи, сеть) идёт без него.
#[derive(Default)]
pub(crate) struct State {
    // процессы
    pub proc_table: HashMap<u32, procs::Proc>,   // pid -> процесс
    pub proc_order: Vec<u32>,                    // порядок процессов в последнем скане
    pub proc_agents: HashMap<i64, procs::PAgent>, // pid корня (или -1 Codex, -2 Ollama, -10… другие ИИ) -> агент
    pub agent_seq: u64,
    pub last_scan_ok: bool,
    pub user_idle: u64,                          // мс без мыши и клавиатуры на момент последнего скана
    pub cpu: i64,
    pub mem: i64,
    pub gpu: Option<procs::Gpu>,
    pub full_name: String,
    pub quns: i32,
    pub mic_on: bool,
    pub ollama: procs::Ollama,
    pub last_poll: i64,
    // события для обоев
    pub fx: VecDeque<Fx>,
    pub fx_n: u64,
    pub hook_day: (String, u32),                 // за сегодня по хукам: сколько раз прошли тесты
    // сессии из хуков
    pub sessions: HashMap<String, sessions::Session>,
    pub sess_seq: u64,
    pub agent_pids: HashMap<String, Vec<i64>>,  // id агента -> процессы, по которым /focus ищет окно
    pub sid_agent: HashMap<String, String>,      // сессия -> id агента на обоях
    // то, что переживает перезапуск: история по дням, кубки, оценка лимита Claude
    pub saved: Map<String, Value>,
    pub saved_dirty: bool,
    // логи Claude и Codex
    pub day: Option<logs::Day>,
    pub recent: HashMap<String, (i64, u64)>,     // message.id -> (время, токены) за последние 10 часов
    pub claude_limit: Option<logs::ClaudeLimit>,
    pub codex_lim: Value,
    // HTTP
    pub denied_at: i64,
    pub events: u64,
    pub last_event_at: i64,
}

pub(crate) struct Inner {
    pub port: u16,
    pub version: String,
    pub dir: PathBuf,
    pub token: String,
    pub started_at: i64,
    pub st: Mutex<State>,
    pub scan_lock: Mutex<win::Sampler>,          // занят — скан процессов уже идёт
    pub stats_lock: Mutex<logs::StatsPriv>,      // занят — логи Claude уже читаются
    pub gpu_busy: AtomicBool,
    pub gpu_at: AtomicI64,
    pub projects: PathBuf,
    pub codex_sess: PathBuf,
    log_lock: Mutex<()>,
}

impl Inner {
    pub fn log(&self, t: &str) {
        let _g = lock(&self.log_lock);
        let ts = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ");
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(self.dir.join("server.log")) {
            let _ = writeln!(f, "{ts} {t}");
        }
    }
    pub fn st(&self) -> MutexGuard<'_, State> { lock(&self.st) }
    pub fn active(st: &State) -> bool { now_ms() - st.last_poll < IDLE_MS }

    pub fn kick_scan(self: &Arc<Self>) {
        let i = self.clone();
        std::thread::spawn(move || procs::scan(&i));
    }
    /// Сводка дня (и лимиты Codex) в фоне, через delay мс.
    pub fn kick_stats(self: &Arc<Self>, delay: u64, codex: bool) {
        let i = self.clone();
        std::thread::spawn(move || {
            if delay > 0 { std::thread::sleep(Duration::from_millis(delay)); }
            if codex { logs::codex_scan(&i); }
            logs::stats_scan(&i);
        });
    }

    // ---------- события для обоев: команда упала, тесты прошли, push, новый кубок ----------
    // Обои помнят номер последнего события и показывают только новые.
    pub fn fx_push(st: &mut State, sid: &str, typ: &str, id: Option<&str>) {
        st.fx_n += 1;
        let n = st.fx_n;
        st.fx.push_back(Fx { n, sid: sid.into(), typ: typ.into(), at: now_ms(), id: id.map(Into::into) });
        if st.fx.len() > 40 { st.fx.pop_front(); }
    }

    // ---------- кубки: получаются один раз и навсегда; названия и вид кубков — в обоях ----------
    pub fn award(&self, st: &mut State, id: &str) {
        let tr = st.saved.entry("trophies").or_insert_with(|| json!({}));
        if !tr.is_object() { *tr = json!({}); }
        if truthy(tr.get(id)) { return; }
        tr[id] = json!(now_ms());
        st.saved_dirty = true;
        Self::fx_push(st, "", "trophy", Some(id));
        self.log(&format!("новый кубок: {id}"));
        self.save(st);                           // процесс может закрыться в любой момент: кубок сохраняем сразу
    }

    pub fn save(&self, st: &mut State) {
        if !st.saved_dirty { return; }
        st.saved_dirty = false;
        let file = self.dir.join("office-state.json");
        let tmp = self.dir.join("office-state.json.tmp");
        let text = serde_json::to_string(&st.saved).unwrap_or_default();
        if let Err(e) = fs::write(&tmp, text).and_then(|_| fs::rename(&tmp, &file)) {
            self.log(&format!("не смог сохранить {}: {e}", file.display()));
        }
    }

    /// Опрос обоев: то же, что GET /state. Первый опрос после тишины сразу запускает сканы.
    pub fn poll(self: &Arc<Self>, origin: &str) -> Value {
        let mut st = self.st();
        let first = !Self::active(&st);
        if first { self.log(&format!("обои подключились (origin {origin})")); }
        st.last_poll = now_ms();
        let v = self.state_json(&mut st);
        drop(st);
        if first { self.kick_scan(); self.kick_stats(0, true); }
        v
    }

    fn state_json(&self, st: &mut State) -> Value {
        let agents = self.agents(st);
        let now = now_ms();
        let fx: Vec<Value> = st.fx.iter().filter(|e| now - e.at < 60_000).map(|e| {
            let mut o = json!({ "n": e.n, "type": e.typ, "agent": st.sid_agent.get(&e.sid).cloned().unwrap_or_default() });
            if let Some(id) = &e.id { o["id"] = json!(id); }
            o
        }).collect();
        let gpu = st.gpu.as_ref().map(|g| json!({ "load": num(g.load), "temp": num(g.temp), "vram": num(g.vram) }));
        let trophies: Vec<String> = st.saved.get("trophies").and_then(|t| t.as_object()).map(|t| t.keys().cloned().collect()).unwrap_or_default();
        json!({
            "agents": agents,
            "scan": st.last_scan_ok,
            "now": now,
            "version": self.version,
            "idle": st.user_idle,
            "stats": logs::stats_out(st),
            "limits": { "claude": logs::claude_out(st, now), "codex": st.codex_lim.clone() },
            "pc": { "cpu": st.cpu, "mem": st.mem, "gpu": gpu },
            "game": st.last_scan_ok && procs::game_now(st),
            "mic": st.last_scan_ok && st.mic_on,
            "fx": fx,
            "week": logs::week_out(st),
            "trophies": trophies,
            "streak": logs::streak(st),
            "locked": win::locked(),
        })
    }

    pub fn focus(&self, id: &str) -> String {
        let pids: Vec<u32> = self.st().agent_pids.get(id).map(|v| v.iter().filter(|&&p| p > 0 && p <= u32::MAX as i64).map(|&p| p as u32).collect()).unwrap_or_default();
        if pids.is_empty() { return "unknown".into(); }
        win::focus(&pids).unwrap_or_else(|| "error".into())
    }
}

/// Сервер офиса. Внутри Arc: клонируется и передаётся между потоками.
#[derive(Clone)]
pub struct Office(Arc<Inner>);

impl Office {
    /// data_dir = %LOCALAPPDATA%\DeskBots-Data (token.txt, office-state.json, server.log).
    /// Берёт ключ из token.txt (нет — создаёт 48 hex-символов), слушает 127.0.0.1:port, запускает фоновые потоки.
    /// Ошибка, если порт занят.
    pub fn start(data_dir: PathBuf, port: u16, version: &str) -> anyhow::Result<Office> {
        fs::create_dir_all(&data_dir)?;
        let log_file = data_dir.join("server.log");
        if fs::metadata(&log_file).is_ok_and(|m| m.len() > 1_000_000) { let _ = fs::write(&log_file, ""); }
        let token = load_token(&data_dir)?;
        let mut saved: Map<String, Value> = fs::read(data_dir.join("office-state.json")).ok()
            .and_then(|b| serde_json::from_slice::<Value>(&b).ok()).and_then(|v| match v { Value::Object(m) => Some(m), _ => None }).unwrap_or_default();
        for k in ["history", "trophies"] { if !saved.get(k).is_some_and(|v| v.is_object()) { saved.insert(k.into(), json!({})); } }
        let inner = Arc::new(Inner {
            port,
            version: version.into(),
            dir: data_dir,
            token,
            started_at: now_ms(),
            st: Mutex::new(State { saved, codex_lim: Value::Null, ..Default::default() }),
            scan_lock: Mutex::new(win::Sampler::default()),
            stats_lock: Mutex::new(logs::StatsPriv::default()),
            gpu_busy: AtomicBool::new(false),
            gpu_at: AtomicI64::new(0),
            projects: home().join(".claude").join("projects"),
            codex_sess: std::env::var_os("CODEX_HOME").map(PathBuf::from).unwrap_or_else(|| home().join(".codex")).join("sessions"),
            log_lock: Mutex::new(()),
        });
        let server = match tiny_http::Server::http(("127.0.0.1", port)) {
            Ok(s) => s,
            Err(e) => {
                let busy = e.downcast_ref::<std::io::Error>().is_some_and(|e| e.kind() == std::io::ErrorKind::AddrInUse);
                if busy { inner.log(&format!("порт {port} уже занят: сервер офиса уже работает")); return Err(anyhow!("порт {port} уже занят")); }
                inner.log(&format!("ошибка сервера: {e}"));
                return Err(anyhow!("ошибка сервера: {e}"));
            }
        };
        inner.log(&format!("слушает http://127.0.0.1:{port}, версия {}", if version.is_empty() { "-" } else { version }));
        let bg = |name: &str, f: Box<dyn FnOnce() + Send>| { let _ = std::thread::Builder::new().name(name.into()).spawn(f); };
        let i = inner.clone();
        bg("office-http", Box::new(move || http::serve(i, server)));
        // Пока обои спрашивают состояние, сканируем каждые 4 с. Обои молчат: не сканируем вообще.
        let i = inner.clone();
        bg("office-scan", Box::new(move || {
            let mut next = std::time::Instant::now();
            loop {
                next += Duration::from_millis(SCAN_MS);
                let now = std::time::Instant::now();
                if next > now { std::thread::sleep(next - now); } else { next = now; }
                if Inner::active(&i.st()) { procs::scan(&i); }
            }
        }));
        // Уборка сессий раз в 10 с
        let i = inner.clone();
        bg("office-clean", Box::new(move || loop {
            std::thread::sleep(Duration::from_secs(10));
            sessions::cleanup(&mut i.st());
        }));
        // Раз в минуту, пока обои открыты, сводка дня и лимиты Codex; полночь начинает новый день
        let i = inner.clone();
        bg("office-stats", Box::new(move || loop {
            std::thread::sleep(Duration::from_secs(60));
            if Inner::active(&i.st()) { logs::stats_scan(&i); logs::codex_scan(&i); }
        }));
        // Один раз после установки: история за прошлые 6 дней
        let i = inner.clone();
        bg("office-backfill", Box::new(move || { std::thread::sleep(Duration::from_secs(5)); logs::backfill(&i); }));
        Ok(Office(inner))
    }

    /// То же, что GET /state, плюс «locked». Считается опросом обоев.
    pub fn state(&self) -> Value { self.0.poll("-") }

    /// То же, что POST /focus: имя программы без .exe, «denied», «none», «unknown» или «error».
    pub fn focus(&self, id: &str) -> String { self.0.focus(&clip(id, 100)) }

    pub fn token(&self) -> String { self.0.token.clone() }

    /// Для окна настроек.
    pub fn info(&self) -> Value {
        let st = self.0.st();
        json!({
            "port": self.0.port,
            "version": self.0.version,
            "startedAt": self.0.started_at,
            "events": st.events,
            "lastEventAt": st.last_event_at,
            "dataDir": self.0.dir.to_string_lossy(),
        })
    }

    pub fn log(&self, msg: &str) { self.0.log(msg) }
}

// ключ доступа: хук и обои передают его в каждом запросе
fn load_token(dir: &Path) -> anyhow::Result<String> {
    let f = dir.join("token.txt");
    if let Ok(t) = fs::read_to_string(&f) {
        let t = t.trim_start_matches('\u{feff}').trim();
        if t.len() >= 32 { return Ok(t.to_string()); }
    }
    let t: String = win::random(24).iter().map(|b| format!("{b:02x}")).collect();
    fs::write(&f, &t)?;
    Ok(t)
}
