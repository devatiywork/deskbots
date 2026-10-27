// Хуки AI-офиса (перенос install-hooks.mjs):
//   Claude Code → %USERPROFILE%\.claude\settings.json
//   Codex       → %USERPROFILE%\.codex\hooks.json (только если есть папка Codex)
// Перед изменением делает копию файла *.bak-<время>. Чужие хуки не трогает. Повторный запуск ничего не дублирует.
// Наши хуки — те, что указывают на этот deskbots-hook.exe (или другой deskbots-hook.exe), и старые хуки на Node (hook.mjs из AI-Office).
use std::fs;
use std::path::Path;
use std::sync::LazyLock;

use regex_lite::Regex;
use serde_json::{json, Map, Value};

// PostToolUseFailure — упавшая команда, SubagentStart/Stop — стажёры, StopFailure — ошибка API (например, лимит).
const CLAUDE_EVENTS: [&str; 11] = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure", "Notification",
    "SubagentStart", "SubagentStop", "Stop", "StopFailure", "SessionEnd"];
const CODEX_EVENTS: [&str; 7] = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PermissionRequest", "PostToolUse", "Stop", "SessionEnd"];
static AI_OFFICE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"AI[- ]Office").unwrap());

fn fwd(p: &Path) -> String { p.to_string_lossy().replace('\\', "/") }
fn norm(s: &str) -> String { s.replace('\\', "/").to_lowercase() }

fn parts(h: &Value) -> Vec<String> {
    let mut v: Vec<String> = ["command", "commandWindows"].iter().map(|k| match h.get(*k) { Some(Value::String(s)) => s.clone(), _ => String::new() }).collect();
    if let Some(Value::Array(a)) = h.get("args") { v.extend(a.iter().filter_map(|x| x.as_str().map(String::from))); }
    v
}
fn is_command(h: &Value) -> bool { h.get("type").and_then(|t| t.as_str()) == Some("command") }
/// Хук на этот exe.
fn is_current(h: &Value, exe: &str) -> bool { is_command(h) && parts(h).iter().any(|x| norm(x).contains(exe)) }
/// Наш хук: этот exe, любой deskbots-hook.exe или старый hook.mjs из папки AI-Office.
fn is_ours(h: &Value, exe: &str) -> bool {
    is_command(h) && parts(h).iter().any(|x| { let n = norm(x); n.contains(exe) || n.contains("deskbots-hook.exe") || (x.contains("hook.mjs") && AI_OFFICE.is_match(x)) })
}

fn read_json(file: &Path) -> Result<Map<String, Value>, String> {
    let bad = || format!("Не смог прочитать {}: там ошибка в JSON. Этот файл не менял.", file.display());
    let text = match fs::read(file) {
        Ok(b) => String::from_utf8(b).map_err(|_| bad())?,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Map::new()),
        Err(e) => return Err(format!("Не смог прочитать {}: {e}", file.display())),
    };
    let text = text.trim_start_matches('\u{feff}');
    if text.trim().is_empty() { return Ok(Map::new()); }
    match serde_json::from_str::<Value>(text) { Ok(Value::Object(m)) => Ok(m), _ => Err(bad()) }
}

fn edit(file: &Path, events: &[&str], exe: &str, remove: bool, group: &dyn Fn(&str) -> Value, msgs: &mut Vec<String>) -> bool {
    let mut settings = match read_json(file) { Ok(m) => m, Err(e) => { msgs.push(e); return false; } };
    let before = serde_json::to_string(&settings).unwrap_or_default();
    let hooks = settings.entry("hooks").or_insert_with(|| json!({}));
    if hooks.is_null() { *hooks = json!({}); }
    let Some(hooks) = hooks.as_object_mut() else { msgs.push(format!("Не смог прочитать {}: «hooks» там не объект. Этот файл не менял.", file.display())); return false; };
    for ev in events {
        let mut groups: Vec<Value> = match hooks.get(*ev) {
            None | Some(Value::Null) => Vec::new(),
            Some(Value::Array(a)) => a.iter().filter_map(|g| {
                let mut g = match g { Value::Object(m) => m.clone(), _ => Map::new() };
                let hs: Vec<Value> = match g.get("hooks") {
                    Some(Value::Array(h)) => h.iter().filter(|h| !is_ours(h, exe)).cloned().collect(),
                    None | Some(Value::Null) => Vec::new(),
                    Some(_) => return Some(Value::Object(g)),     // непонятная чужая запись: не трогаем
                };
                if hs.is_empty() { return None; }
                g.insert("hooks".into(), Value::Array(hs));
                Some(Value::Object(g))
            }).collect(),
            Some(_) => continue,                                 // не массив: чужое, не трогаем
        };
        if !remove { groups.push(group(ev)); }
        if groups.is_empty() { hooks.shift_remove(*ev); } else { hooks.insert(ev.to_string(), Value::Array(groups)); }
    }
    if hooks.is_empty() { settings.shift_remove("hooks"); }
    if serde_json::to_string(&settings).unwrap_or_default() == before { msgs.push(format!("Хуки в {} уже на месте", file.display())); return true; }
    let res = if file.exists() {
        let ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
        fs::copy(file, format!("{}.bak-{ms}", file.display())).map(|_| ())
    } else {
        file.parent().map(fs::create_dir_all).unwrap_or(Ok(()))
    };
    let res = res.and_then(|_| fs::write(file, serde_json::to_string_pretty(&settings).unwrap_or_default() + "\n"));
    match res {
        Ok(()) => { msgs.push(format!("{} {}", if remove { "Убрал хуки из" } else { "Записал хуки в" }, file.display())); true }
        Err(e) => { msgs.push(format!("Не смог записать {}: {e}", file.display())); false }
    }
}

fn run(hook_exe: &Path, claude_settings: &Path, codex_hooks: Option<&Path>, remove: bool) -> Vec<String> {
    let exe = fwd(hook_exe);
    let key = norm(&exe);
    let mut msgs = Vec::new();
    // Claude Code: запуск напрямую (exe + аргумент), без оболочки
    edit(claude_settings, &CLAUDE_EVENTS, &key, remove, &|ev| {
        let mut g = json!({ "hooks": [{ "type": "command", "command": exe, "args": ["claude"], "timeout": 3 }] });
        if ["PreToolUse", "PostToolUse", "PostToolUseFailure"].contains(&ev) { g["matcher"] = json!("*"); }
        g
    }, &mut msgs);
    // Codex: команда строкой. Его хуки нужно один раз одобрить в Codex командой /hooks.
    if let Some(cx) = codex_hooks {
        if cx.parent().is_some_and(|p| p.exists()) {
            let cmd = format!("\"{exe}\" codex");
            edit(cx, &CODEX_EVENTS, &key, remove, &|_| json!({ "hooks": [{ "type": "command", "command": cmd, "commandWindows": cmd, "timeout": 3 }] }), &mut msgs);
            if !remove { msgs.push("Codex: открой Codex, набери /hooks и одобри (trust) хуки DeskBots. Без этого Codex их не запускает.".into()); }
        } else {
            msgs.push("Codex не найден (нет папки .codex), его хуки пропускаю.".into());
        }
    }
    msgs
}

/// Записать хуки (старые хуки офиса заменяются, чужие не трогаются). Ответ — сообщения для человека.
pub fn install(hook_exe: &Path, claude_settings: &Path, codex_hooks: Option<&Path>) -> Vec<String> { run(hook_exe, claude_settings, codex_hooks, false) }

/// Убрать хуки офиса.
pub fn remove(hook_exe: &Path, claude_settings: &Path, codex_hooks: Option<&Path>) -> Vec<String> { run(hook_exe, claude_settings, codex_hooks, true) }

/// Стоят ли хуки на этот exe на всех нужных событиях: (Claude Code, Codex).
pub fn status(hook_exe: &Path, claude_settings: &Path, codex_hooks: Option<&Path>) -> (bool, bool) {
    let key = norm(&fwd(hook_exe));
    let has = |file: &Path, events: &[&str]| {
        let Ok(s) = read_json(file) else { return false };
        events.iter().all(|ev| s.get("hooks").and_then(|h| h.get(*ev)).and_then(|g| g.as_array()).is_some_and(|groups| {
            groups.iter().any(|g| g.get("hooks").and_then(|h| h.as_array()).is_some_and(|hs| hs.iter().any(|h| is_current(h, &key))))
        }))
    };
    (has(claude_settings, &CLAUDE_EVENTS), codex_hooks.is_some_and(|cx| cx.exists() && has(cx, &CODEX_EVENTS)))
}
