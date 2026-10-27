// Сессии из хуков Claude Code и Codex и список агентов для обоев.
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use chrono::{Datelike, Timelike};
use serde_json::{json, Value};

use crate::{clip, js_str, now_ms, sor, truthy, Inner, State};

pub(crate) struct Session {
    pub id: String,
    pub kind: &'static str,
    pub folder: String,
    pub status: &'static str,
    pub tool: String,
    pub detail: String,
    pub last: i64,
    pub ppid: i64,
    pub pid: i64,
    pub tool_at: i64,
    pub subs: HashMap<String, i64>,
    pub limit_at: i64,
    seq: u64,
}

fn label(kind: &str) -> &'static str {
    match kind {
        "claude" => "Claude Code", "claude-app" => "Claude", "codex" => "Codex", "chatgpt" => "ChatGPT", "ollama" => "Ollama",
        "gemini" => "Gemini", "grok" => "Grok", "deepseek" => "DeepSeek", "qwen" => "Qwen", "mistral" => "Mistral",
        "perplexity" => "Perplexity", "copilot" => "Copilot", _ => "undefined",
    }
}

fn folder_of(cwd: &str) -> String { cwd.split(['\\', '/']).rfind(|s| !s.is_empty()).map(|s| clip(s, 24)).unwrap_or_default() }

fn is_int(v: Option<&Value>) -> Option<f64> {
    let f = v?.as_f64()?;
    (f.is_finite() && f.fract() == 0.0).then_some(f)
}

impl Inner {
    /// Событие хука (POST /event).
    pub(crate) fn apply(self: &Arc<Self>, ev: &Value) {
        if !ev.is_object() { return; }
        let id = clip(&sor(ev.get("session_id")), 80);
        if id.is_empty() { return; }
        let now = now_ms();
        let mut guard = self.st();
        let st = &mut *guard;
        st.events += 1;
        st.last_event_at = now;
        if !st.sessions.contains_key(&id) {
            if st.sessions.len() >= 200 { return; }               // мусорный поток событий не раздувает память
            st.sess_seq += 1;
            let kind = if ev.get("agent").and_then(|v| v.as_str()) == Some("codex") { "codex" } else { "claude" };
            st.sessions.insert(id.clone(), Session { id: id.clone(), kind, folder: String::new(), status: "idle", tool: String::new(), detail: String::new(),
                last: now, ppid: 0, pid: 0, tool_at: 0, subs: HashMap::new(), limit_at: 0, seq: st.sess_seq });
        }
        let s = st.sessions.get_mut(&id).unwrap();
        if truthy(ev.get("cwd")) { s.folder = folder_of(&js_str(&ev["cwd"])); }
        if truthy(ev.get("ppid")) {
            s.ppid = match &ev["ppid"] {
                Value::Number(n) => n.as_f64().filter(|f| f.is_finite()).map(|f| f as i64).unwrap_or(0),
                Value::String(t) => t.trim().parse::<f64>().ok().filter(|f| f.is_finite()).map(|f| f as i64).unwrap_or(0),
                _ => 0,
            };
        }
        s.last = now;
        let msg = ev.get("message").filter(|v| !v.is_null()).map(js_str).unwrap_or_default();
        let detail = clip(&sor(ev.get("detail")), 24);
        let cmd = ev.get("cmd").and_then(|v| v.as_str()).filter(|c| matches!(*c, "test" | "push" | "commit" | "build")).unwrap_or("");
        let failed = is_int(ev.get("exit")).is_some_and(|e| e != 0.0);
        let name = ev.get("hook_event_name").and_then(|v| v.as_str()).unwrap_or("");
        let tool_name = || clip(&sor(ev.get("tool_name")), 40);
        let mut fx: Vec<&str> = Vec::new();
        let mut awards: Vec<&str> = Vec::new();
        let mut limit = false;
        match name {
            "SessionStart" => { s.status = "idle"; s.tool.clear(); s.detail.clear(); }
            "UserPromptSubmit" => { s.status = "working"; s.tool = "думает".into(); s.detail = detail; s.tool_at = now; }
            "PreToolUse" => { s.status = "working"; s.tool = tool_name(); s.detail = detail; s.tool_at = now; }
            // у Codex упавшая команда приходит в PostToolUse с кодом выхода
            "PostToolUse" | "PostToolUseFailure" => {
                s.status = "working";
                if name == "PostToolUseFailure" || failed {
                    if !truthy(ev.get("interrupt")) { fx.push(match cmd { "test" => "test-fail", "push" => "push-fail", "commit" => "commit-fail", "build" => "build-fail", _ => "fail" }); }
                } else if !cmd.is_empty() {
                    fx.push(match cmd { "test" => "test-ok", "push" => "push-ok", "commit" => "commit-ok", _ => "build-ok" });
                    let d = chrono::Local::now();
                    if cmd == "test" {
                        let k = d.format("%a %b %d %Y").to_string();
                        if st.hook_day.0 != k { st.hook_day = (k, 0); }
                        st.hook_day.1 += 1;
                        if st.hook_day.1 >= 10 { awards.push("green10"); }
                    }
                    if cmd == "push" && d.weekday() == chrono::Weekday::Fri && d.hour() >= 18 { awards.push("fridaypush"); }
                }
            }
            "PermissionRequest" => { s.status = "waiting"; s.tool = tool_name(); s.detail = detail; }
            "Notification" => {
                if ev.get("notification_type").and_then(|v| v.as_str()) == Some("idle_prompt") || msg.to_lowercase().contains("waiting for your input") { s.status = "idle"; s.tool.clear(); }
                else { s.status = "waiting"; s.tool = clip(&msg, 80); }
            }
            // субагенты — стажёры за столом агента; фоновые доживают до SubagentStop, поэтому Stop их не убирает
            "SubagentStart" => { if truthy(ev.get("agent_id")) && s.subs.len() < 20 { s.subs.insert(clip(&js_str(&ev["agent_id"]), 60), now); } }
            "SubagentStop" => { s.subs.remove(&clip(&sor(ev.get("agent_id")), 60)); }
            "Stop" => { s.status = "idle"; s.tool.clear(); s.detail.clear(); }
            // ответ не пришёл из-за ошибки API; лимит — сразу перечитываем логи, там время сброса
            "StopFailure" => {
                s.status = "idle"; s.tool.clear(); s.detail.clear();
                if ev.get("error").and_then(|v| v.as_str()) == Some("rate_limit") { s.limit_at = now; fx.push("limit"); limit = true; }
            }
            "SessionEnd" => { s.status = "gone"; s.subs.clear(); }
            _ => {}
        }
        if s.subs.len() >= 5 { awards.push("interns5"); }
        if s.status == "working" { let h = chrono::Local::now().hour(); if h < 5 { awards.push("night"); } else if h < 7 { awards.push("early"); } }
        let ppid = s.ppid;
        for t in fx { Inner::fx_push(st, &id, t, None); }
        for a in awards { self.award(st, a); }
        if limit { self.kick_stats(3000, false); }
        if Inner::active(st) && ppid != 0 && !(ppid > 0 && ppid <= u32::MAX as i64 && st.proc_table.contains_key(&(ppid as u32))) { self.kick_scan(); }
    }

    /// Список агентов для обоев; заодно запоминает, какие процессы стоят за каждым агентом и чьи события к кому относятся.
    pub(crate) fn agents(&self, st: &mut State) -> Vec<Value> {
        let now = now_ms();
        st.agent_pids.clear();
        st.sid_agent.clear();
        let mut order: Vec<(i64, u64, String)> = st.sessions.values().filter(|s| s.status != "gone").map(|s| (-s.last, s.seq, s.id.clone())).collect();
        order.sort();
        let live: Vec<String> = order.into_iter().map(|x| x.2).collect();
        let mut by_pid: HashMap<i64, String> = HashMap::new();
        let mut unlinked: Vec<String> = Vec::new();
        for id in &live {
            let pid = link_session(st, id);
            if pid != 0 && !by_pid.contains_key(&pid) { by_pid.insert(pid, id.clone()); } else if pid == 0 { unlinked.push(id.clone()); }
        }
        // Не нашли родителя (например, хук запущен через оболочку, которая уже закрылась): пара по виду программы.
        for id in unlinked {
            let kind = st.sessions[&id].kind;
            let free = st.proc_agents.values().filter(|a| a.kind == kind && !by_pid.contains_key(&a.pid)).max_by_key(|a| (a.first_seen, std::cmp::Reverse(a.seq))).map(|a| a.pid);
            if let Some(pid) = free { by_pid.insert(pid, id.clone()); st.sessions.get_mut(&id).unwrap().pid = pid; }
        }
        let since = |s: &crate::sessions::Session, fresh: bool| if fresh && s.status == "working" && s.tool_at != 0 { now - s.tool_at } else { 0 };
        let mut out = Vec::new();
        let mut order: Vec<&crate::procs::PAgent> = st.proc_agents.values().collect();
        order.sort_by_key(|a| (a.first_seen, a.seq));
        let mut pids_out: Vec<(String, Vec<i64>)> = Vec::new();
        let mut sid_out: Vec<(String, String)> = Vec::new();
        for a in order {
            if a.kind == "ollama" { continue; }                 // лама добавляется ниже, по загруженной модели
            let s = by_pid.get(&a.pid).map(|id| &st.sessions[id]);
            let fresh = s.is_some_and(|s| now - s.last < 10 * 60_000);
            let aid = format!("{}-{}", a.kind, a.pid);
            let pids_of = || if a.pid > 0 { vec![a.pid] } else { st.proc_order.iter().filter(|p| st.proc_table[p].kind == Some(a.kind)).map(|&p| p as i64).take(12).collect() };
            pids_out.push((aid.clone(), match s { Some(s) if s.ppid != 0 && a.pid < 0 => std::iter::once(s.ppid).chain(pids_of()).collect(), _ => pids_of() }));
            if let Some(s) = s { sid_out.push((s.id.clone(), aid.clone())); }
            let (status, tool, detail) = match s {
                Some(s) if fresh => (s.status, s.tool.clone(), if s.status != "idle" { s.detail.clone() } else { String::new() }),
                _ => (if a.cpu_busy { "working" } else { "idle" }, String::new(), String::new()),
            };
            out.push(json!({
                "id": aid,
                "kind": a.kind,
                "name": format!("{}{}", label(a.kind), s.filter(|s| !s.folder.is_empty()).map(|s| format!(" · {}", s.folder)).unwrap_or_default()),
                "status": status,
                "tool": tool,
                "detail": detail,
                "since": s.map(|s| since(s, fresh)).unwrap_or(0),
                "subs": s.map(|s| s.subs.len()).unwrap_or(0),
                "hooks": s.is_some(),
            }));
        }
        // лама в офисе, пока Ollama открыта (сервер отвечает или виден её процесс); работает, пока модель отвечает
        let o = &st.ollama;
        let model = o.models.first().filter(|m| !m.is_empty()).or(o.running.first().filter(|m| !m.is_empty())).cloned().unwrap_or_else(|| o.last.clone());
        if o.up || st.proc_agents.contains_key(&-2) || !o.running.is_empty() {
            let busy = st.proc_agents.get(&-2).is_some_and(|a| a.cpu_busy) || now < o.busy_until;
            pids_out.push(("ollama".into(), st.proc_order.iter().filter(|p| st.proc_table[p].kind == Some("ollama")).map(|&p| p as i64).take(12).collect()));
            out.push(json!({ "id": "ollama", "kind": "ollama", "name": if model.is_empty() { "Ollama".to_string() } else { format!("Ollama · {model}") },
                "status": if busy { "working" } else { "idle" }, "tool": "", "detail": model, "hooks": false }));
        }
        // Сессия без найденного процесса (или сканирование недоступно): показываем, пока от неё были события за 2 минуты.
        let linked: HashSet<&String> = by_pid.values().collect();
        for id in &live {
            let s = &st.sessions[id];
            if linked.contains(id) || !(!st.last_scan_ok || now - s.last < 120_000 || !s.subs.is_empty()) { continue; }
            if s.ppid != 0 { pids_out.push((s.id.clone(), vec![s.ppid])); }
            sid_out.push((s.id.clone(), s.id.clone()));
            out.push(json!({
                "id": s.id, "kind": s.kind, "name": format!("{}{}", label(s.kind), if s.folder.is_empty() { String::new() } else { format!(" · {}", s.folder) }),
                "status": s.status, "tool": s.tool, "detail": if s.status != "idle" { s.detail.clone() } else { String::new() },
                "since": since(s, true), "subs": s.subs.len(), "hooks": true,
            }));
        }
        st.agent_pids.extend(pids_out);
        st.sid_agent.extend(sid_out);
        if out.iter().filter(|a| a["status"] == "working").count() >= 3 { self.award(st, "team3"); }
        out
    }
}

/// К какому открытому процессу относится сессия: ищем вверх по родителям от процесса, запустившего хук.
fn link_session(st: &mut State, id: &str) -> i64 {
    let (spid, sppid) = { let s = &st.sessions[id]; (s.pid, s.ppid) };
    if spid != 0 && st.proc_agents.contains_key(&spid) { return spid; }
    let mut pid = sppid;
    let mut found = 0;
    for _ in 0..30 {
        if pid == 0 { break; }
        if st.proc_agents.contains_key(&pid) { found = pid; break; }
        let Some(p) = (pid > 0 && pid <= u32::MAX as i64).then(|| st.proc_table.get(&(pid as u32))).flatten() else { break };
        if p.kind == Some("codex") && st.proc_agents.contains_key(&-1) { found = -1; break; }
        pid = p.ppid as i64;
    }
    if found != 0 { st.sessions.get_mut(id).unwrap().pid = found; }
    found
}

/// Уборка: закрытые сессии убираем через 15 с, совсем тихие через 30 мин, «работает» без событий 10 мин = отдых.
/// Стажёр без SubagentStop дольше 30 минут считается ушедшим.
pub(crate) fn cleanup(st: &mut State) {
    let now = now_ms();
    st.sessions.retain(|_, s| {
        let quiet = now - s.last;
        s.subs.retain(|_, at| now - *at <= 30 * 60_000);
        if (s.status == "gone" && quiet > 15_000) || (quiet > 30 * 60_000 && s.subs.is_empty()) { return false; }
        if s.status == "working" && quiet > 10 * 60_000 { s.status = "idle"; s.tool.clear(); }
        true
    });
}
