// Процессы: какие AI-программы открыты, кто из них «думает» (нагрузка на процессор), Ollama, видеокарта.
use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::atomic::Ordering;
use std::sync::{Arc, LazyLock};
use std::time::{Duration, Instant};

use regex_lite::Regex;
use serde_json::Value;

use crate::{clip, js_str, now_ms, sor, try_lock, win, Inner, State};

const CPU_BUSY: f64 = 0.05;                 // доля одного ядра, выше которой считаем, что программа «думает»

pub(crate) struct Proc { pub pid: u32, pub ppid: u32, pub name: String, pub cmd: String, pub cpu: f64, pub kind: Option<&'static str> }
pub(crate) struct PAgent { pub pid: i64, pub kind: &'static str, pub first_seen: i64, pub seq: u64, cpu_prev: f64, cpu_at: i64, busy_until: i64, pub cpu_busy: bool }
#[derive(Default)]
pub(crate) struct Ollama { pub up: bool, pub models: Vec<String>, pub running: Vec<String>, pub last: String, key: String, pub busy_until: i64 }
pub(crate) struct Gpu { pub load: f64, pub temp: f64, pub vram: f64 }

fn re(s: &str) -> Regex { Regex::new(s).unwrap() }
fn unlatest(s: &str) -> &str { s.strip_suffix(":latest").unwrap_or(s) }

// другие ИИ: настольные программы и CLI; каждый вид — один агент, статус «работает» по нагрузке на процессор
pub(crate) const OTHER: [&str; 7] = ["gemini", "grok", "deepseek", "qwen", "mistral", "perplexity", "copilot"];
static OTHER_RE: LazyLock<Vec<(&'static str, Regex, Option<Regex>)>> = LazyLock::new(|| vec![
    ("gemini", re(r"^gemini(\.exe)?$"), Some(re(r"@google[\\/]gemini-cli"))),
    ("grok", re(r"^grok(\.exe)?$"), Some(re(r"grok-cli"))),
    ("deepseek", re(r"^deepseek"), None),
    ("qwen", re(r"^qwen(\.exe)?$"), Some(re(r"@qwen-code[\\/]qwen-code"))),
    ("mistral", re(r"^(le ?chat|mistral|vibe(\.exe)?$)"), Some(re(r"mistral[-_]vibe"))),
    ("perplexity", re(r"^perplexity"), None),
    ("copilot", re(r"^(microsoft ?|m365)?copilot(\.exe)?$"), Some(re(r"@github[\\/]copilot"))),
]);
// у этих процессов смотрим путь, командную строку и процессорное время; у остальных хватает имени
static WANT: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)^(claude|codex.*|chatgpt|node|ollama.*|gemini.*|grok.*|deepseek.*|qwen.*|le ?chat.*|mistral.*|vibe|perplexity.*|m365copilot.*|copilot|microsoft ?copilot)\.exe$"));
static OLLAMA_RUN: LazyLock<Regex> = LazyLock::new(|| re(r#"(?i)ollama(?:\.exe)?"?\s+run\s+([^\s"]+)"#));
// окно на весь экран у этих программ — не игра: рабочий стол, сами обои, меню «Пуск», экран блокировки
static NOT_GAME: LazyLock<Regex> = LazyLock::new(|| re(r"(?i)^(explorer|wallpaper(32|64)|webwallpaper\d*|wallpaperservice\d*|ShellExperienceHost|StartMenuExperienceHost|SearchHost|SearchApp|LockApp|TextInputHost|ApplicationFrameHost|claude)$"));

pub(crate) fn game_now(st: &State) -> bool { st.quns == 3 || (!st.full_name.is_empty() && !NOT_GAME.is_match(&st.full_name)) }

fn kind_of(name: &str, exe: &str, cmd: &str, parent: Option<&str>) -> Option<&'static str> {
    let (n, exe, cmd) = (name.to_lowercase(), exe.to_lowercase(), cmd.to_lowercase());
    if n == "chatgpt.exe" { return Some("chatgpt"); }
    if n.starts_with("codex") && n.ends_with(".exe") { return Some("codex"); }
    if n.starts_with("ollama") { return Some("ollama"); }      // ollama.exe, «ollama app.exe», ollama_llama_server
    if n == "claude.exe" {
        let desktop = exe.contains("anthropicclaude") || exe.contains(r"\windowsapps\") || exe.contains(r"\claude\app-");
        if !desktop { return Some("claude"); }
        let parent_is_app = parent.is_some_and(|p| p.eq_ignore_ascii_case("claude.exe"));
        if parent_is_app && !cmd.contains("--type=") { return Some("claude"); }   // сессия Claude Code внутри приложения
        return Some("claude-app");
    }
    if n == "node.exe" {
        if cmd.contains("claude-code") || cmd.contains(r"@anthropic-ai\claude") || cmd.contains("@anthropic-ai/claude") { return Some("claude"); }
        if cmd.contains(r"@openai\codex") || cmd.contains("@openai/codex") { return Some("codex"); }
    }
    for (k, nr, lr) in OTHER_RE.iter() {
        if nr.is_match(&n) || lr.as_ref().is_some_and(|r| r.is_match(&cmd)) { return Some(k); }
    }
    None
}

/// Один скан: процессы, нагрузка, окно на весь экран, микрофон; затем Ollama.
pub(crate) fn scan(inner: &Arc<Inner>) {
    let Some(mut sampler) = try_lock(&inner.scan_lock) else { return };
    gpu_scan(inner);
    let Some(raw) = win::processes() else { inner.st().last_scan_ok = false; return };
    let idle = win::idle_ms();
    let cpu = win::cpu_load(&mut sampler).clamp(0, 100);
    let mem = win::mem_load();
    let quns = win::quns();
    let fp = win::fullscreen_pid();
    let mic = win::mic_on();
    // окно самого офиса (обои) на весь экран — не игра
    let fs = if fp == 0 || fp == std::process::id() { String::new() } else { raw.iter().find(|p| p.pid == fp).map(|p| win::bare(&p.name).to_string()).unwrap_or_default() };
    let mut list: Vec<(Proc, String)> = Vec::with_capacity(raw.len());
    let mut alive = HashSet::new();
    for p in raw {
        let (exe, cmd, cpu) = if WANT.is_match(&p.name) {
            alive.insert(p.pid);
            win::details(p.pid, &mut sampler).unwrap_or_default()
        } else { Default::default() };
        list.push((Proc { pid: p.pid, ppid: p.ppid, name: p.name, cmd, cpu, kind: None }, exe));
    }
    win::forget_except(&mut sampler, &alive);
    let names: HashMap<u32, String> = list.iter().map(|(p, _)| (p.pid, p.name.clone())).collect();
    for (p, exe) in list.iter_mut() { p.kind = kind_of(&p.name, exe, &p.cmd, names.get(&p.ppid).map(|s| s.as_str())); }
    let now = now_ms();
    {
        let mut guard = inner.st();
        let st = &mut *guard;
        st.last_scan_ok = true;
        st.user_idle = idle;
        st.cpu = cpu;
        st.mem = mem;
        st.quns = quns;
        st.full_name = clip(&fs, 60);
        st.mic_on = mic;
        // открытые `ollama run <модель>`: модель считается запущенной, даже если Ollama уже выгрузила её из памяти
        st.ollama.running = list.iter().filter_map(|(p, _)| OLLAMA_RUN.captures(&p.cmd).map(|c| unlatest(&c[1]).to_string())).collect();
        st.proc_order = list.iter().map(|(p, _)| p.pid).collect();
        st.proc_table = list.into_iter().map(|(p, _)| (p.pid, p)).collect();
        // корень группы: процесс нужного вида, у которого родитель другого вида (вкладки Electron и дочерние процессы схлопываются)
        let mut roots: Vec<(i64, &'static str, f64)> = Vec::new();
        let mut idx: HashMap<i64, usize> = HashMap::new();
        for pid in &st.proc_order {
            let p = &st.proc_table[pid];
            let Some(kind) = p.kind else { continue };
            let mut root = p;
            let mut up = st.proc_table.get(&p.ppid);
            let mut guard = 0;
            while let Some(u) = up {
                if u.kind != Some(kind) || guard >= 20 { break; }
                root = u;
                up = st.proc_table.get(&u.ppid);
                guard += 1;
            }
            // Codex, Ollama и «другие ИИ» запускают много процессов: каждый вид — один агент
            let key = match kind {
                "codex" => -1,
                "ollama" => -2,
                k => OTHER.iter().position(|o| *o == k).map(|i| -10 - i as i64).unwrap_or(root.pid as i64),
            };
            let i = *idx.entry(key).or_insert_with(|| { roots.push((key, kind, 0.0)); roots.len() - 1 });
            roots[i].2 += p.cpu;
        }
        for &(key, kind, cpu) in &roots {
            if let Some(a) = st.proc_agents.get_mut(&key) {
                // делим на настоящее время между сканами: после паузы обоев нет ложного «работает»
                let load = (cpu - a.cpu_prev) / f64::max(1.0, (now - a.cpu_at) as f64 / 1000.0);
                a.cpu_prev = cpu;
                a.cpu_at = now;
                if load > CPU_BUSY { a.busy_until = now + 20_000; }      // после всплеска считаем занятым ещё 20 секунд
                a.cpu_busy = now < a.busy_until;
            } else {
                st.agent_seq += 1;
                let seq = st.agent_seq;
                st.proc_agents.insert(key, PAgent { pid: key, kind, first_seen: now, seq, cpu_prev: cpu, cpu_at: now, busy_until: 0, cpu_busy: false });
            }
        }
        st.proc_agents.retain(|k, _| idx.contains_key(k));
    }
    ollama_scan(inner);
}

// ---------- Ollama ----------
// Лама сидит в офисе, пока Ollama открыта. «Работает», пока модель отвечает. В табличке название загруженной (или последней) модели.
static OLLAMA_PORT: LazyLock<u16> = LazyLock::new(|| {
    let h = std::env::var("OLLAMA_HOST").unwrap_or_default();
    re(r":(\d+)/?$").captures(&h).and_then(|c| c[1].parse().ok()).unwrap_or(11434)
});

/// GET на 127.0.0.1 (HTTP/1.0: ответ без chunked, соединение закрывается сервером), всё вместе не дольше timeout.
fn http_get(port: u16, path: &str, timeout: Duration) -> Option<Vec<u8>> {
    let deadline = Instant::now() + timeout;
    let left = || deadline.checked_duration_since(Instant::now()).filter(|d| !d.is_zero());
    let mut s = TcpStream::connect_timeout(&SocketAddr::from(([127, 0, 0, 1], port)), timeout).ok()?;
    s.set_write_timeout(Some(left()?)).ok()?;
    s.write_all(format!("GET {path} HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nAccept: application/json\r\n\r\n").as_bytes()).ok()?;
    let mut buf = Vec::new();
    let mut chunk = [0u8; 16384];
    loop {
        s.set_read_timeout(Some(left()?)).ok()?;
        match s.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => buf.extend_from_slice(&chunk[..n]),
            Err(_) => return None,
        }
        if buf.len() > 4 << 20 { return None; }
    }
    let at = memchr::memmem::find(&buf, b"\r\n\r\n")?;
    Some(buf.split_off(at + 4))
}

fn ollama_scan(inner: &Arc<Inner>) {
    let body = http_get(*OLLAMA_PORT, "/api/ps", Duration::from_millis(1500));
    let models = body.and_then(|b| serde_json::from_slice::<Value>(&b).ok()).and_then(|v| match v.get("models") {
        None | Some(Value::Null) => Some(vec![]),
        Some(Value::Array(a)) => Some(a.clone()),
        _ => None,
    });
    let mut st = inner.st();
    let o = &mut st.ollama;
    match models {
        Some(models) => {
            let part = |m: &Value, k: &str| m.get(k).map(js_str).unwrap_or_else(|| "undefined".into());
            let key = models.iter().map(|m| format!("{} {}", part(m, "name"), part(m, "expires_at"))).collect::<Vec<_>>().join("|");
            // новый запрос продлевает модель: значит, она только что отвечала
            if !models.is_empty() && key != o.key { o.busy_until = now_ms() + 20_000; }
            o.key = key;
            o.models = models.iter().map(|m| clip(unlatest(&sor(m.get("name"))), 40)).collect();
            o.up = true;
            if let Some(m) = o.models.first().filter(|m| !m.is_empty()) { o.last = m.clone(); }
        }
        None => { o.up = false; o.models.clear(); o.key.clear(); }
    }
}

// ---------- видеокарта NVIDIA: загрузка, температура, занятая видеопамять ----------
// Без NVIDIA стойка показывает только процессор и память.
static NVSMI: LazyLock<Option<PathBuf>> = LazyLock::new(|| {
    [r"C:\Windows\System32\nvidia-smi.exe", r"C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe"].iter().map(PathBuf::from).find(|p| p.exists())
});

/// Number(s) из JS: пустая строка — 0, мусор — NaN.
fn js_number(s: &str) -> f64 { let t = s.trim(); if t.is_empty() { 0.0 } else { t.parse().unwrap_or(f64::NAN) } }

fn gpu_scan(inner: &Arc<Inner>) {
    let Some(exe) = NVSMI.as_ref() else { return };
    let now = now_ms();
    if inner.gpu_busy.load(Ordering::SeqCst) || now - inner.gpu_at.load(Ordering::SeqCst) < 8000 { return; }
    inner.gpu_busy.store(true, Ordering::SeqCst);
    inner.gpu_at.store(now, Ordering::SeqCst);
    let i = inner.clone();
    std::thread::spawn(move || {
        let out = run(exe, &["--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"], Duration::from_secs(4));
        let gpu = out.and_then(|o| {
            let v: Vec<f64> = o.split('\n').next().unwrap_or("").split(',').map(js_number).collect();
            let at = |k: usize| v.get(k).copied().unwrap_or(f64::NAN);
            let (load, temp, used, total) = (at(0), at(1), at(2), at(3));
            if !load.is_finite() { return None; }
            let vram = if total != 0.0 && !total.is_nan() { (used / total * 100.0 + 0.5).floor() } else { 0.0 };
            Some(Gpu { load, temp: if temp.is_finite() { temp } else { 0.0 }, vram })
        });
        i.st().gpu = gpu;
        i.gpu_busy.store(false, Ordering::SeqCst);
    });
}

/// Запуск без окна консоли, с ограничением по времени; None — ошибка, ненулевой код или не успел.
fn run(exe: &PathBuf, args: &[&str], timeout: Duration) -> Option<String> {
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut child = Command::new(exe).args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null()).creation_flags(CREATE_NO_WINDOW).spawn().ok()?;
    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(s)) => break s,
            Ok(None) if start.elapsed() < timeout => std::thread::sleep(Duration::from_millis(50)),
            _ => { let _ = child.kill(); let _ = child.wait(); return None; }
        }
    };
    let mut out = String::new();
    child.stdout.take()?.read_to_string(&mut out).ok()?;
    status.success().then_some(out)
}
