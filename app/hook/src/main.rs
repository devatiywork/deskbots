// Хук для Claude Code и Codex: читает событие из stdin и отправляет короткую сводку на сервер офиса.
// Аргумент: claude или codex (кто запустил хук).
// Полный текст запросов и команд НЕ отправляется. Кроме id сессии, папки, события и имени инструмента
// уходит только короткая подпись (detail): имя файла, первые слова команды, домен сайта
// или первые 6 символов запроса с «…». После команды — только её вид (тесты, push, коммит, сборка) и код выхода,
// без вывода. Всё остаётся на этом компьютере (127.0.0.1).
// Хук ничего не печатает: так его вывод не попадает в контекст модели и не тратит лимиты.
// Запрос несёт ключ из token.txt (рядом с exe или в %LOCALAPPDATA%\DeskBots-Data): без него сервер событие не примет.
// Всегда выходит с кодом 0, чтобы никогда не мешать работе Claude, даже если сервер выключен.
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::time::{Duration, Instant};

use serde_json::{Map, Value};

fn main() {
    std::panic::set_hook(Box::new(|_| {}));            // даже паника ничего не печатает
    std::thread::spawn(|| { std::thread::sleep(Duration::from_secs(2)); std::process::exit(0); });
    let _ = std::panic::catch_unwind(run);
    std::process::exit(0);
}

fn run() {
    let Some(token) = token() else { return };
    let port: u16 = match std::env::var("OFFICE_PORT") {
        Ok(p) if !p.is_empty() => match p.trim().parse() { Ok(p) => p, Err(_) => return },
        _ => 7777,
    };
    let mut raw = Vec::new();
    if std::io::stdin().read_to_end(&mut raw).is_err() { return; }
    let Ok(ev) = serde_json::from_slice::<Value>(&raw) else { return };
    if ev.is_null() { return; }
    let body = body(&ev, std::env::args().nth(1).as_deref() == Some("codex"));
    post(port, &token, &body);                          // сервер не запущен: молча выходим
}

fn token() -> Option<String> {
    let read = |p: PathBuf| std::fs::read_to_string(p).ok().map(|t| t.trim_start_matches('\u{feff}').trim().to_string()).filter(|t| !t.is_empty());
    let near = std::env::current_exe().ok().and_then(|e| e.parent().map(|d| d.join("token.txt")));
    near.and_then(read).or_else(|| read(PathBuf::from(std::env::var_os("LOCALAPPDATA")?).join("DeskBots-Data").join("token.txt")))
}

fn body(ev: &Value, codex: bool) -> String {
    let name = ev.get("hook_event_name").and_then(Value::as_str).unwrap_or("");
    let after = name == "PostToolUse" || name == "PostToolUseFailure";
    let r = ev.get("tool_response").filter(|v| v.is_object() || v.is_array());
    let set = |v: Option<&Value>| v.filter(|v| !v.is_null()).cloned();
    let exit = r.and_then(|r| set(r.get("exit_code")).or_else(|| set(r.get("exitCode"))).or_else(|| set(r.get("returncode"))));
    let mut b = Map::new();
    if after {
        if let Some(k) = cmd_kind(&joined(ev.get("tool_input").and_then(|t| t.get("command")))) { b.insert("cmd".into(), k.into()); }
        if let Some(e) = exit.and_then(|e| e.as_f64()).filter(|f| f.is_finite() && f.fract() == 0.0) { b.insert("exit".into(), Value::from(e as i64)); }
    }
    if name == "PostToolUseFailure" && ev.get("is_interrupt") == Some(&Value::Bool(true)) { b.insert("interrupt".into(), true.into()); }
    if name == "SubagentStart" || name == "SubagentStop" { if let Some(a) = ev.get("agent_id") { b.insert("agent_id".into(), a.clone()); } }
    if name == "StopFailure" { b.insert("error".into(), first(&or_empty(ev.get("error")), 40).into()); }
    if let Some(d) = detail_of(ev, name) { b.insert("detail".into(), d.into()); }
    b.insert("agent".into(), if codex { "codex" } else { "claude" }.into());
    if let Some(p) = parent_pid() { b.insert("ppid".into(), p.into()); }
    for k in ["session_id", "hook_event_name", "cwd", "tool_name", "notification_type"] {
        if let Some(v) = ev.get(k) { b.insert(k.into(), v.clone()); }
    }
    if name == "Notification" { if let Some(v) = ev.get("message") { b.insert("message".into(), v.clone()); } }
    Value::Object(b).to_string()
}

// ---------- короткая подпись того, что агент делает сейчас ----------
fn truthy(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|f| f != 0.0),
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    }
}
/// String(v) из JS.
fn js_str(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Array(a) => a.iter().map(|x| if x.is_null() { String::new() } else { js_str(x) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
        x => x.to_string(),
    }
}
/// String(v || '')
fn or_empty(v: Option<&Value>) -> String { if truthy(v) { js_str(v.unwrap()) } else { String::new() } }
/// Команда строкой: массив склеивается через пробел.
fn joined(c: Option<&Value>) -> String {
    match c {
        Some(Value::Array(a)) => a.iter().map(|x| if x.is_null() { String::new() } else { js_str(x) }).collect::<Vec<_>>().join(" "),
        v => or_empty(v),
    }
}
fn first(s: &str, n: usize) -> String { s.chars().take(n).collect() }
/// Пробелы схлопываются, длинное обрезается с «…».
fn clip(s: &str, n: usize) -> String {
    let t = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if t.chars().count() > n { first(&t, n) + "…" } else { t }
}
fn base(f: &str) -> &str { f.split(['\\', '/']).filter(|s| !s.is_empty()).last().unwrap_or("") }

fn detail_of(ev: &Value, name: &str) -> Option<String> {
    if name == "UserPromptSubmit" { return Some(clip(&or_empty(ev.get("prompt")), 6)).filter(|s| !s.is_empty()); }
    if name != "PreToolUse" && name != "PermissionRequest" { return None; }
    let ti = ev.get("tool_input").filter(|t| truthy(Some(t)));
    let get = |k: &str| ti.and_then(|t| t.get(k)).filter(|v| truthy(Some(v)));
    if let Some(f) = get("file_path").or_else(|| get("notebook_path")).or_else(|| get("path")) { return Some(clip(base(&js_str(f)), 22)); }
    if let Some(c) = get("command") {
        let s = joined(Some(c));
        let mut w = s.split_whitespace();
        let w0 = w.next().unwrap_or("");
        let b = base(w0);
        let lower = b.to_ascii_lowercase();
        let cmd = if lower.ends_with(".exe") || lower.ends_with(".cmd") { &b[..b.len() - 4] } else { b };
        let known = ["git", "npm", "npx", "dotnet", "pnpm", "yarn", "cargo", "go", "python", "python3", "pip", "node"].contains(&cmd);
        return Some(clip(&match w.next() { Some(w1) if known => format!("{cmd} {w1}"), _ => cmd.to_string() }, 18));
    }
    if let Some(u) = get("url") { return hostname(&js_str(u)).map(|h| first(h.strip_prefix("www.").unwrap_or(&h), 22)); }
    if let Some(q) = get("query").or_else(|| get("pattern")) { return Some(clip(&js_str(q), 6)); }
    if let Some(d) = get("description") { return Some(clip(&js_str(d), 10)); }
    None
}

/// Имя хоста из адреса, как new URL(u).hostname; неверный адрес — None.
fn hostname(u: &str) -> Option<String> {
    let u = u.trim();
    let (scheme, rest) = u.split_once(':')?;
    let mut sc = scheme.chars();
    if !sc.next()?.is_ascii_alphabetic() || !sc.all(|c| c.is_ascii_alphanumeric() || "+-.".contains(c)) { return None; }
    let scheme = scheme.to_ascii_lowercase();
    let special = ["http", "https", "ws", "wss", "ftp", "file"].contains(&scheme.as_str());
    let rest = if special { rest.trim_start_matches(['/', '\\']) } else { match rest.strip_prefix("//") { Some(r) => r, None => return Some(String::new()) } };
    let auth = rest.split(['/', '?', '#']).next().unwrap_or("");
    let auth = if special { auth.split('\\').next().unwrap_or("") } else { auth };
    let host = auth.rsplit_once('@').map(|x| x.1).unwrap_or(auth);
    let host = if host.starts_with('[') { host.split_inclusive(']').next().unwrap_or(host) } else { host.split(':').next().unwrap_or("") };
    if special && scheme != "file" && host.is_empty() { return None; }
    Some(if special { host.to_lowercase() } else { host.to_string() })
}

// ---------- какая это команда: на обоях push празднуют, упавшие тесты расстраивают ----------
// Те же правила, что регулярные выражения в hook.mjs (\b — граница слова из букв, цифр и _).
fn is_word(c: char) -> bool { c.is_ascii_alphanumeric() || c == '_' }

fn cmd_kind(s: &str) -> Option<&'static str> {
    let c: Vec<char> = s.chars().collect();
    let at = |i: usize, w: &str| -> Option<usize> {
        let mut j = i;
        for ch in w.chars() { if c.get(j) != Some(&ch) { return None; } j += 1; }
        Some(j)
    };
    let ws = |i: usize| { let mut j = i; while j < c.len() && c[j].is_whitespace() { j += 1; } (j > i).then_some(j) };
    let nonws = |i: usize| { let mut j = i; while j < c.len() && !c[j].is_whitespace() { j += 1; } (j > i).then_some(j) };
    let word = |i: usize, w: &str| at(i, w).is_some_and(|j| j == c.len() || !is_word(c[j]));
    // «git [-C путь] push»
    let git = |i: usize, verb: &str| at(i, "git").and_then(ws).is_some_and(|k| {
        word(k, verb) || at(k, "-C").and_then(ws).and_then(nonws).and_then(ws).is_some_and(|m| word(m, verb))
    });
    // «npm [run] test», «cargo test»
    let then = |i: usize, tools: &[&str], verb: &str, run: bool| tools.iter().any(|t| at(i, t).and_then(ws).is_some_and(|k| {
        word(k, verb) || (run && at(k, "run").and_then(ws).is_some_and(|m| word(m, verb)))
    }));
    let any = |f: &dyn Fn(usize) -> bool| (0..c.len()).any(|i| (i == 0 || !is_word(c[i - 1])) && f(i));
    let pm = ["npm", "pnpm", "yarn", "bun"];
    if any(&|i| git(i, "push")) { return Some("push"); }
    if any(&|i| git(i, "commit")) { return Some("commit"); }
    if any(&|i| ["pytest", "jest", "vitest", "mocha", "phpunit", "rspec", "ctest"].iter().any(|w| word(i, w))
        || then(i, &pm, "test", true) || then(i, &["cargo", "go", "dotnet", "deno", "mix"], "test", false) || then(i, &["node"], "--test", false)) { return Some("test"); }
    if any(&|i| then(i, &pm, "build", true) || then(i, &["cargo", "dotnet", "go"], "build", false) || word(i, "tsc") || word(i, "msbuild")) { return Some("build"); }
    None
}

// ---------- отправка ----------
fn enc(s: &str) -> String {
    s.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect()
}

fn post(port: u16, token: &str, body: &str) {
    let limit = Duration::from_millis(800);
    let deadline = Instant::now() + limit;
    let left = || deadline.checked_duration_since(Instant::now()).filter(|d| !d.is_zero());
    let Ok(mut s) = TcpStream::connect_timeout(&SocketAddr::from(([127, 0, 0, 1], port)), limit) else { return };
    let _ = s.set_nodelay(true);
    let Some(l) = left() else { return };
    let _ = s.set_write_timeout(Some(l));
    let req = format!("POST /event?token={} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", enc(token), body.len());
    if s.write_all(req.as_bytes()).is_err() { return; }
    // как fetch: ждём ответ сервера, но не дольше 800 мс
    let Some(l) = left() else { return };
    let _ = s.set_read_timeout(Some(l));
    let _ = s.read(&mut [0u8; 256]);
}

// ---------- pid родителя (того, кто запустил хук): снимок процессов toolhelp ----------
#[repr(C)]
struct ProcessEntry { size: u32, usage: u32, pid: u32, heap: usize, module: u32, threads: u32, ppid: u32, pri: i32, flags: u32, exe: [u16; 260] }
#[link(name = "kernel32")]
extern "system" {
    fn CreateToolhelp32Snapshot(flags: u32, pid: u32) -> isize;
    fn Process32FirstW(h: isize, pe: *mut ProcessEntry) -> i32;
    fn Process32NextW(h: isize, pe: *mut ProcessEntry) -> i32;
    fn CloseHandle(h: isize) -> i32;
}

fn parent_pid() -> Option<u32> {
    let me = std::process::id();
    unsafe {
        let h = CreateToolhelp32Snapshot(2, 0);         // TH32CS_SNAPPROCESS
        if h == -1 || h == 0 { return None; }
        let mut pe: ProcessEntry = std::mem::zeroed();
        pe.size = std::mem::size_of::<ProcessEntry>() as u32;
        let mut ok = Process32FirstW(h, &mut pe) != 0;
        let mut r = None;
        while ok {
            if pe.pid == me { r = Some(pe.ppid); break; }
            ok = Process32NextW(h, &mut pe) != 0;
        }
        CloseHandle(h);
        r
    }
}
