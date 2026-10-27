// ---------- логи Claude Code: сводка дня, история, окно лимита ----------
// ~/.claude/projects/<проект>/<сессия>.jsonl (и subagents/*.jsonl): по строке на блок ответа. Читаем только файлы,
// которые менялись сегодня (или за последние 10 часов), и только дописанное с прошлого раза. Токены считаем по уникальному
// message.id (один ответ занимает несколько строк с одинаковым usage), инструменты — по уникальному id вызова.
// Всё чтение и разбор идут без замка; замок берётся только на применение готовых записей.
use std::collections::{HashMap, HashSet};
use std::fmt;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Arc, LazyLock, Mutex};

use chrono::{DateTime, Datelike, Local, NaiveDate, TimeZone};
use memchr::memmem::Finder;
use regex_lite::Regex;
use serde::de::{IgnoredAny, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Deserializer};
use serde_json::{json, Map, Value};

use crate::{js_str, lock, now_ms, num, truthy, try_lock, Inner, State};

const WIN_MS: i64 = 5 * 3_600_000;          // окно лимита Claude: 5 часов от первого запроса (начало округляется до часа)
const DAY_MS: i64 = 86_400_000;
const CHUNK: usize = 8 << 20;
const EDIT_TOOLS: [&str; 4] = ["Edit", "MultiEdit", "Write", "NotebookEdit"];
const SHELL_TOOLS: [&str; 2] = ["Bash", "PowerShell"];
static COMMIT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\bgit(\s+-C\s+\S+)?\s+commit\b").unwrap());
static F_ASSIST: LazyLock<Finder<'static>> = LazyLock::new(|| Finder::new(b"\"assistant\""));
static F_QUOTA: LazyLock<Finder<'static>> = LazyLock::new(|| Finder::new(b"\"quotaLimits\""));
static F_RATE: LazyLock<Finder<'static>> = LazyLock::new(|| Finder::new(b"\"rate_limits\":{"));

// ---------- даты: местное время, ключ дня «2026-10-27» без нулей ----------
fn local(ts: i64) -> DateTime<Local> { Local.timestamp_millis_opt(ts).single().unwrap_or_else(Local::now) }
fn key_of(d: NaiveDate) -> String { format!("{}-{}-{}", d.year(), d.month(), d.day()) }
pub(crate) fn day_key(ts: i64) -> String { key_of(local(ts).date_naive()) }
fn day_start(ts: i64) -> i64 {
    let d = local(ts).date_naive();
    (0..3).find_map(|h| Local.from_local_datetime(&d.and_hms_opt(h, 0, 0)?).earliest()).map(|t| t.timestamp_millis()).unwrap_or(ts)
}
fn parse_ts(s: &str) -> Option<i64> { DateTime::parse_from_rfc3339(s).ok().map(|t| t.timestamp_millis()) }
fn mtime_ms(m: &fs::Metadata) -> i64 {
    m.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_millis() as i64).unwrap_or(0)
}

pub(crate) struct Day {
    pub key: String,
    pub start: i64,
    files: HashSet<String>,
    commands: u64,
    commits: u64,
    tokens: u64,
    out: u64,
    sessions: HashSet<String>,
    msgs: HashSet<String>,
    tools: HashSet<String>,
}
impl Day {
    fn new(ts: i64) -> Day {
        Day { key: day_key(ts), start: day_start(ts), files: HashSet::new(), commands: 0, commits: 0, tokens: 0, out: 0,
            sessions: HashSet::new(), msgs: HashSet::new(), tools: HashSet::new() }
    }
    fn hist(&self) -> Value { json!({ "files": self.files.len(), "commands": self.commands, "commits": self.commits, "tokens": self.tokens, "out": self.out }) }
}

/// Последний отказ по лимиту из логов.
pub(crate) struct ClaudeLimit { at: i64, until: f64, typ: String }

/// Только для сканера логов: сколько каждого файла уже прочитано (в полночь не сбрасывается).
#[derive(Default)]
pub(crate) struct StatsPriv { offsets: HashMap<PathBuf, u64> }

// ---------- разбор строки лога: нужные поля, остальное пропускается без копирования ----------
#[derive(Deserialize)]
struct Line {
    #[serde(rename = "type")]
    typ: Option<String>,
    timestamp: Option<String>,
    message: Option<Msg>,
    #[serde(rename = "quotaLimits")]
    quota: Option<Quota>,
}
#[derive(Deserialize)]
struct Msg {
    id: Option<String>,
    usage: Option<Usage>,
    #[serde(default)]
    content: Blocks,
}
#[derive(Deserialize)]
struct Usage { input_tokens: Option<f64>, output_tokens: Option<f64>, cache_creation_input_tokens: Option<f64>, cache_read_input_tokens: Option<f64> }
#[derive(Deserialize)]
struct Block {
    #[serde(rename = "type")]
    typ: Option<String>,
    id: Option<String>,
    name: Option<String>,
    input: Option<Input>,
}
#[derive(Deserialize)]
struct Input { file_path: Option<Value>, notebook_path: Option<Value>, command: Option<Value> }
#[derive(Deserialize)]
struct Quota {
    status: Option<String>,
    #[serde(rename = "resetsAt")]
    resets_at: Option<f64>,
    #[serde(rename = "rateLimitType")]
    typ: Option<Value>,
}
/// message.content: массив блоков; строка или что-то другое — пусто.
#[derive(Default)]
struct Blocks(Vec<Block>);
impl<'de> Deserialize<'de> for Blocks {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        struct V;
        impl<'de> Visitor<'de> for V {
            type Value = Blocks;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result { f.write_str("content") }
            fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<Blocks, A::Error> {
                let mut v = Vec::new();
                while let Some(b) = a.next_element::<Block>()? { v.push(b); }
                Ok(Blocks(v))
            }
            fn visit_map<A: MapAccess<'de>>(self, mut a: A) -> Result<Blocks, A::Error> {
                while a.next_entry::<IgnoredAny, IgnoredAny>()?.is_some() {}
                Ok(Blocks::default())
            }
            fn visit_str<E>(self, _: &str) -> Result<Blocks, E> { Ok(Blocks::default()) }
            fn visit_unit<E>(self) -> Result<Blocks, E> { Ok(Blocks::default()) }
            fn visit_bool<E>(self, _: bool) -> Result<Blocks, E> { Ok(Blocks::default()) }
            fn visit_i64<E>(self, _: i64) -> Result<Blocks, E> { Ok(Blocks::default()) }
            fn visit_u64<E>(self, _: u64) -> Result<Blocks, E> { Ok(Blocks::default()) }
            fn visit_f64<E>(self, _: f64) -> Result<Blocks, E> { Ok(Blocks::default()) }
        }
        d.deserialize_any(V)
    }
}

/// Что нужно сводке из одной строки лога.
struct Rec { ts: i64, assistant: bool, quota: Option<(f64, String)>, msg: Option<(String, u64, u64)>, tools: Vec<Tool> }
struct Tool { id: String, edit: Option<String>, shell: Option<bool> }

fn tok(x: Option<f64>) -> u64 { x.filter(|f| f.is_finite() && *f > 0.0).map(|f| f as u64).unwrap_or(0) }

fn parse_rec(line: &[u8]) -> Option<Rec> {
    // быстрый отсев: нужны только ответы модели
    if F_ASSIST.find(line).is_none() && F_QUOTA.find(line).is_none() { return None; }
    let l: Line = serde_json::from_slice(line).ok()?;
    let m = l.message?;
    let ts = parse_ts(l.timestamp.as_deref()?)?;
    if ts <= 0 { return None; }
    let quota = l.quota.filter(|q| q.status.as_deref() == Some("rejected") && q.resets_at.is_some_and(|r| r != 0.0 && !r.is_nan()))
        .map(|q| (q.resets_at.unwrap_or(0.0), if truthy(q.typ.as_ref()) { js_str(q.typ.as_ref().unwrap()) } else { String::new() }));
    let assistant = l.typ.as_deref() == Some("assistant");
    let msg = match (m.id, m.usage) {
        (Some(id), Some(u)) if !id.is_empty() => {
            let out = tok(u.output_tokens);
            Some((id, tok(u.input_tokens) + out + tok(u.cache_creation_input_tokens) + tok(u.cache_read_input_tokens), out))
        }
        _ => None,
    };
    let tools = if !assistant { Vec::new() } else {
        m.content.0.into_iter().filter_map(|c| {
            if c.typ.as_deref() != Some("tool_use") { return None; }
            let id = c.id.filter(|i| !i.is_empty())?;
            let name = c.name.unwrap_or_default();
            let inp = c.input;
            let edit = if EDIT_TOOLS.contains(&name.as_str()) {
                inp.as_ref().and_then(|i| [&i.file_path, &i.notebook_path].into_iter().find(|v| truthy(v.as_ref())).map(|v| js_str(v.as_ref().unwrap()).to_lowercase()))
            } else { None };
            let shell = SHELL_TOOLS.contains(&name.as_str()).then(|| {
                let c = inp.as_ref().and_then(|i| i.command.as_ref()).filter(|v| truthy(Some(v))).map(js_str).unwrap_or_default();
                COMMIT.is_match(&c)
            });
            Some(Tool { id, edit, shell })
        }).collect()
    };
    Some(Rec { ts, assistant, quota, msg, tools })
}

/// Одна строка лога в сводку дня d.
fn count(d: &mut Day, r: &Rec, file: &str, sub: bool) {
    if !sub && !d.sessions.contains(file) { d.sessions.insert(file.to_string()); }
    if let Some((id, t, out)) = &r.msg {
        if !d.msgs.contains(id) {
            d.msgs.insert(id.clone());
            d.tokens += t;
            d.out += out;
        }
    }
    for t in &r.tools {
        if d.tools.contains(&t.id) { continue; }
        d.tools.insert(t.id.clone());
        if let Some(f) = &t.edit { d.files.insert(f.clone()); }
        if let Some(commit) = t.shell {
            d.commands += 1;
            if commit { d.commits += 1; }
        }
    }
}

/// Строка лога в сводку дня и в окно лимита.
fn stat_rec(st: &mut State, r: &Rec, file: &str, sub: bool, now: i64) {
    if let Some((resets, typ)) = &r.quota {
        if st.claude_limit.as_ref().is_none_or(|c| r.ts > c.at) { st.claude_limit = Some(ClaudeLimit { at: r.ts, until: resets * 1000.0, typ: typ.clone() }); }
    }
    if !r.assistant { return; }
    if let Some((id, t, _)) = &r.msg {
        if r.ts > now - 2 * WIN_MS && !st.recent.contains_key(id) { st.recent.insert(id.clone(), (r.ts, *t)); }
    }
    if let Some(d) = st.day.as_mut() { if r.ts >= d.start { count(d, r, file, sub); } }
}

fn jsonl_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        match e.file_type() {
            Ok(t) if t.is_dir() => jsonl_files(&p, out),
            Ok(_) if e.file_name().to_string_lossy().ends_with(".jsonl") => out.push(p),
            _ => {}
        }
    }
}
fn is_sub(file: &str) -> bool { file.contains("\\subagents\\") || file.contains("/subagents/") || file.contains("\\subagents/") || file.contains("/subagents\\") }

/// Все строки буфера (последняя — даже без перевода строки), пустые пропускаются.
fn lines(b: &[u8]) -> impl Iterator<Item = &[u8]> {
    let mut start = 0;
    let mut it = memchr::memchr_iter(b'\n', b);
    std::iter::from_fn(move || loop {
        if start > b.len() { return None; }
        let end = it.next().unwrap_or(b.len());
        let line = &b[start..end];
        start = end + 1;
        if !line.is_empty() { return Some(line); }
    })
}

/// Кусками по 8 МБ до последнего полного перевода строки: недописанная строка подождёт следующего раза.
fn read_lines(file: &Path, mut from: u64, size: u64, mut on_chunk: impl FnMut(&[u8])) -> std::io::Result<u64> {
    let mut f = File::open(file)?;
    let mut buf = vec![0u8; CHUNK.min((size - from.min(size)) as usize)];
    while from < size {
        let want = ((size - from) as usize).min(CHUNK);
        f.seek(SeekFrom::Start(from))?;
        let mut n = 0;
        while n < want {
            match f.read(&mut buf[n..want])? { 0 => break, k => n += k }
        }
        if n == 0 { break; }
        match memchr::memrchr(b'\n', &buf[..n]) {
            None => { if n == CHUNK { from += n as u64; continue; } break; }     // строка длиннее 8 МБ: пропускаем
            Some(end) => { on_chunk(&buf[..end]); from += end as u64 + 1; }
        }
    }
    Ok(from)
}

/// Дочитать новые строки во всех свежих файлах (с прошлого раза) и применить их к состоянию.
fn scan_files(projects: &Path, offsets: &mut HashMap<PathBuf, u64>, since: i64, st: &Mutex<State>) {
    let mut files = Vec::new();
    jsonl_files(projects, &mut files);
    for file in files {
        let Ok(md) = fs::metadata(&file) else { continue };
        if mtime_ms(&md) < since { continue; }
        let size = md.len();
        let mut from = offsets.get(&file).copied().unwrap_or(0);
        if size < from { from = 0; }                     // файл переписали заново
        if size <= from { continue; }
        let name = file.to_string_lossy().into_owned();
        let sub = is_sub(&name);
        let read = read_lines(&file, from, size, |chunk| {
            let recs: Vec<Rec> = lines(chunk).filter_map(parse_rec).collect();
            if recs.is_empty() { return; }
            let now = now_ms();
            let mut g = lock(st);
            for r in &recs { stat_rec(&mut g, r, &name, sub, now); }
        });
        if let Ok(end) = read { offsets.insert(file, end); }
    }
}

/// Сводка за прошлые дни [from, to): по одному Day на день.
fn collect_days(projects: &Path, from: i64, to: i64) -> Vec<Day> {
    let mut files = Vec::new();
    jsonl_files(projects, &mut files);
    let mut days: HashMap<String, Day> = HashMap::new();
    for file in files {
        let Ok(md) = fs::metadata(&file) else { continue };
        if mtime_ms(&md) < from { continue; }
        let name = file.to_string_lossy().into_owned();
        let sub = is_sub(&name);
        let _ = read_lines(&file, 0, md.len(), |chunk| {
            for r in lines(chunk).filter_map(parse_rec) {
                if !r.assistant || !(r.ts >= from && r.ts < to) { continue; }
                let d = days.entry(day_key(r.ts)).or_insert_with(|| Day::new(r.ts));
                count(d, &r, &name, sub);
            }
        });
    }
    let mut v: Vec<Day> = days.into_values().collect();
    v.sort_by_key(|d| d.start);
    v
}

fn history(st: &mut State) -> &mut Map<String, Value> {
    let h = st.saved.entry("history").or_insert_with(|| json!({}));
    if !h.is_object() { *h = json!({}); }
    h.as_object_mut().unwrap()
}

pub(crate) fn stats_scan(inner: &Arc<Inner>) {
    let Some(mut pv) = try_lock(&inner.stats_lock) else { return };
    let now = now_ms();
    let since = {
        let mut st = inner.st();
        let key = day_key(now);
        if st.day.as_ref().is_none_or(|d| d.key != key) { st.day = Some(Day::new(now)); }
        st.day.as_ref().unwrap().start.min(now - 2 * WIN_MS)
    };
    scan_files(&inner.projects, &mut pv.offsets, since, &inner.st);
    let mut g = inner.st();
    let st = &mut *g;
    let now = now_ms();
    st.recent.retain(|_, e| e.0 >= now - 2 * WIN_MS);
    // запомнили, сколько токенов было в окне, когда Claude упёрся в 5-часовой лимит: по этому потолку считаем проценты
    if let Some(cl) = &st.claude_limit {
        let cap_at = st.saved.get("claudeCap").and_then(|c| c.get("at")).and_then(|v| v.as_f64());
        if cl.typ == "five_hour" && cap_at != Some(cl.at as f64) {
            if let Some((_, _, t)) = claude_window(&st.recent, cl.at).filter(|w| w.2 > 0) {
                let at = cl.at;
                st.saved.insert("claudeCap".into(), json!({ "at": at, "tokens": t }));
                st.saved_dirty = true;
            }
        }
    }
    let Some(d) = st.day.as_ref() else { return };
    let (key, h, tokens, commits) = (d.key.clone(), d.hist(), d.tokens, d.commits);
    let hist = history(st);
    hist.insert(key, h);
    hist.retain(|k, _| key_utc_ms(k).is_none_or(|t| t >= now - 60 * DAY_MS));
    st.saved_dirty = true;
    if tokens >= 100_000_000 { inner.award(st, "tokens100m"); }
    if tokens >= 1_000_000_000 { inner.award(st, "tokens1b"); }
    if commits >= 50 { inner.award(st, "commits50"); }
    if streak(st) >= 7 { inner.award(st, "streak7"); }
    inner.save(st);
}

/// Ключ дня как дата UTC в мс (как Date.parse у дополненного нулями ключа); не дата — None.
fn key_utc_ms(k: &str) -> Option<i64> {
    let mut it = k.split('-');
    let (y, m, d) = (it.next()?.parse().ok()?, it.next()?.parse().ok()?, it.next()?.parse().ok()?);
    if it.next().is_some() { return None; }
    Some(NaiveDate::from_ymd_opt(y, m, d)?.and_hms_opt(0, 0, 0)?.and_utc().timestamp_millis())
}

/// Один раз после установки: история за прошлые 6 дней из старых логов, чтобы график недели сразу был полным.
pub(crate) fn backfill(inner: &Arc<Inner>) {
    if truthy(inner.st().saved.get("backfilled")) { return; }
    let today = day_start(now_ms());
    let days = collect_days(&inner.projects, today - 6 * DAY_MS, today);
    let mut g = inner.st();
    let st = &mut *g;
    let hist = history(st);
    for d in &days { if !hist.contains_key(&d.key) { hist.insert(d.key.clone(), d.hist()); } }
    for d in &days {
        if d.tokens >= 100_000_000 { inner.award(st, "tokens100m"); }
        if d.tokens >= 1_000_000_000 { inner.award(st, "tokens1b"); }
        if d.commits >= 50 { inner.award(st, "commits50"); }
    }
    if streak(st) >= 7 { inner.award(st, "streak7"); }
    st.saved.insert("backfilled".into(), json!(true));
    st.saved_dirty = true;
    inner.save(st);
    inner.log(&format!("история за неделю собрана: {} дн.", days.len()));
}

/// Окно лимита: начинается с первого запроса после конца прошлого окна (округлено вниз до часа) и длится 5 часов.
fn claude_window(recent: &HashMap<String, (i64, u64)>, up_to: i64) -> Option<(i64, i64, u64)> {
    let mut v: Vec<(i64, u64)> = recent.values().filter(|e| e.0 <= up_to).copied().collect();
    v.sort_by_key(|e| e.0);
    let (mut start, mut t) = (0i64, 0u64);
    for (ts, k) in v {
        if start == 0 || ts >= start + WIN_MS { start = ts.div_euclid(3_600_000) * 3_600_000; t = 0; }
        t += k;
    }
    (start != 0 && up_to < start + WIN_MS).then_some((start, start + WIN_MS, t))
}

pub(crate) fn stats_out(st: &State) -> Value {
    match &st.day {
        Some(d) => json!({ "files": d.files.len(), "commands": d.commands, "commits": d.commits, "tokens": d.tokens, "out": d.out, "sessions": d.sessions.len() }),
        None => Value::Null,
    }
}

fn hist_get<'a>(st: &'a State, k: &str) -> Option<&'a Value> { st.saved.get("history")?.get(k) }

pub(crate) fn streak(st: &State) -> u32 {
    let today = Local::now().date_naive();
    let (mut n, mut d) = (0, today);
    for _ in 0..1000 {
        let t = hist_get(st, &key_of(d)).and_then(|h| h.get("tokens")).and_then(|t| t.as_f64()).unwrap_or(0.0);
        let worked = t > 0.0;
        if !worked && !(n == 0 && d == today) { break; }   // сегодня ещё не работали: серия не обрывается
        if worked { n += 1; }
        let Some(p) = d.pred_opt() else { break };
        d = p;
    }
    n
}

pub(crate) fn week_out(st: &State) -> Value {
    let today = Local::now().date_naive();
    (0..7).map(|i| {
        let d = today - chrono::Days::new(6 - i);
        let h = hist_get(st, &key_of(d));
        let f = |k: &str| h.and_then(|h| h.get(k)).filter(|v| truthy(Some(v))).cloned().unwrap_or(json!(0));
        json!({ "dow": d.weekday().num_days_from_sunday(), "tokens": f("tokens"), "commits": f("commits"), "commands": f("commands"), "files": f("files") })
    }).collect()
}

pub(crate) fn claude_out(st: &State, now: i64) -> Value {
    let cap = st.saved.get("claudeCap").and_then(|c| c.get("tokens")).and_then(|t| t.as_f64()).filter(|c| *c != 0.0);
    let mut o = match claude_window(&st.recent, now) {
        Some((_, reset, t)) => json!({ "tokens": t, "reset": reset, "pct": cap.map(|c| num((t as f64 / c * 100.0 + 0.5).floor().min(100.0))) }),
        None => json!({ "tokens": 0, "reset": 0, "pct": null }),
    };
    match &st.claude_limit {
        Some(cl) if cl.until > now as f64 => { o["limited"] = num(cl.until); o["type"] = json!(cl.typ); }
        // упёрся, время сброса ещё не в логах
        _ => if st.sessions.values().any(|s| s.limit_at != 0 && now - s.limit_at < 10 * 60_000) { o["limited"] = json!(-1); },
    }
    o
}

// ---------- лимиты Codex: он сам пишет проценты 5-часового и недельного окна в логи сессий ----------
pub(crate) fn codex_scan(inner: &Arc<Inner>) {
    let now = now_ms();
    let mut files = Vec::new();
    for back in 0..8 {
        let d = local(now - back * DAY_MS);
        let dir = inner.codex_sess.join(d.year().to_string()).join(format!("{:02}", d.month())).join(format!("{:02}", d.day()));
        if let Ok(rd) = fs::read_dir(&dir) {
            for e in rd.flatten() { if e.file_name().to_string_lossy().ends_with(".jsonl") { files.push(e.path()); } }
        }
    }
    let mut newest: Vec<(PathBuf, i64, u64)> = files.into_iter().filter_map(|f| fs::metadata(&f).ok().map(|m| (f, mtime_ms(&m), m.len()))).collect();
    newest.sort_by_key(|f| std::cmp::Reverse(f.1));
    newest.truncate(3);
    let mut best: Option<(i64, Value)> = None;
    for (f, _, size) in newest {
        let n = size.min(512 << 10);
        let tail = File::open(&f).and_then(|mut h| {
            h.seek(SeekFrom::Start(size - n))?;
            let mut b = Vec::with_capacity(n as usize);
            h.take(n).read_to_end(&mut b)?;
            Ok(b)
        });
        let tail = match tail { Ok(t) => t, Err(e) => { inner.log(&format!("ошибка лимитов Codex: {e}")); return; } };
        for line in lines(&tail) {
            if F_RATE.find(line).is_none() { continue; }
            let Ok(o) = serde_json::from_slice::<Value>(line) else { continue };
            let p = &o["payload"];
            let r = if truthy(p.get("rate_limits")) { &p["rate_limits"] } else { &p["info"]["rate_limits"] };
            let ts = o["timestamp"].as_str().and_then(parse_ts).unwrap_or(0);
            if truthy(r.get("primary")) && ts > 0 && best.as_ref().is_none_or(|b| ts > b.0) { best = Some((ts, r.clone())); }
        }
    }
    let Some((at, r)) = best else { return };
    let now = now_ms() as f64;
    let win = |w: &Value| {
        if !truthy(Some(w)) { return Value::Null; }
        let resets = w.get("resets_at").and_then(|v| v.as_f64());
        let used = w.get("used_percent").and_then(|v| v.as_f64()).filter(|f| !f.is_nan()).unwrap_or(0.0);
        json!({
            "pct": if resets.is_some_and(|r| r * 1000.0 > now) { num((used + 0.5).floor()) } else { json!(0) },
            "reset": num(resets.filter(|r| *r != 0.0).unwrap_or(0.0) * 1000.0),
        })
    };
    let lim = json!({
        "at": at,
        "five": win(&r["primary"]),
        "week": win(&r["secondary"]),
        "plan": if truthy(r.get("plan_type")) { js_str(&r["plan_type"]) } else { String::new() },
        "reached": truthy(r.get("rate_limit_reached_type")),
    });
    inner.st().codex_lim = lim;
}

/// Замер скорости разбора логов (для examples/bench.rs): первая сводка дня и сбор истории за 6 дней.
#[doc(hidden)]
pub mod bench {
    use super::*;
    use std::time::Instant;

    pub fn run(projects: &Path) -> String {
        let now = now_ms();
        let st = Mutex::new(State { day: Some(Day::new(now)), ..Default::default() });
        let since = day_start(now).min(now - 2 * WIN_MS);
        let mut offsets = HashMap::new();
        let t = Instant::now();
        scan_files(projects, &mut offsets, since, &st);
        let first = t.elapsed();
        let read: u64 = offsets.values().sum();
        let t = Instant::now();
        scan_files(projects, &mut offsets, since, &st);
        let again = t.elapsed();
        let g = lock(&st);
        let day = stats_out(&g);
        let win = claude_window(&g.recent, now_ms());
        drop(g);
        let today = day_start(now);
        let t = Instant::now();
        let days = collect_days(projects, today - 6 * DAY_MS, today);
        let back = t.elapsed();
        let mut s = format!("сводка дня: {:.2} с, прочитано {:.0} МБ из {} файлов; повтор {:.3} с\n{day}\nокно Claude: {win:?}\n",
            first.as_secs_f64(), read as f64 / 1e6, offsets.len(), again.as_secs_f64());
        s += &format!("история за 6 дней: {:.2} с\n", back.as_secs_f64());
        for d in days { s += &format!("  {} {}\n", d.key, d.hist()); }
        s
    }
}
