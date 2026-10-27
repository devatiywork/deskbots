// ---------- HTTP: только 127.0.0.1, каждый запрос несёт ключ ?token= ----------
// Без ключа любой запрос получает 403, поэтому «*» здесь ничего не открывает: обоям (file://) он нужен, чтобы прочитать ответ.
use std::io::Read;
use std::sync::Arc;

use serde_json::{json, Value};
use tiny_http::{Header, Method, Request, Response, Server};

use crate::{clip, now_ms, Inner};

fn hdr(name: &str, value: &str) -> Header { Header::from_bytes(name.as_bytes(), value.as_bytes()).unwrap() }
fn cors() -> Header { hdr("Access-Control-Allow-Origin", "*") }

pub(crate) fn serve(inner: Arc<Inner>, server: Server) {
    for req in server.incoming_requests() {
        let i = inner.clone();
        // каждый запрос в своём потоке: медленный клиент не задерживает обои
        std::thread::spawn(move || handle(&i, req));
    }
}

fn header<'a>(req: &'a Request, name: &'static str) -> Option<&'a str> {
    req.headers().iter().find(|h| h.field.equiv(name)).map(|h| h.value.as_str())
}

/// URLSearchParams.get: первое значение, «+» — пробел, %XX раскодируются.
fn param(url: &str, name: &str) -> Option<String> {
    let q = url.split_once('?')?.1;
    let q = q.split('#').next().unwrap_or("");
    q.split('&').find_map(|kv| {
        let (k, v) = kv.split_once('=').unwrap_or((kv, ""));
        (decode(k) == name).then(|| decode(v))
    })
}
fn decode(s: &str) -> String {
    let b = s.as_bytes();
    let hex = |x: u8| (x as char).to_digit(16);
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 3 <= b.len() {
            if let (Some(h), Some(l)) = (hex(b[i + 1]), hex(b[i + 2])) { out.push((h * 16 + l) as u8); i += 3; continue; }
        }
        out.push(if b[i] == b'+' { b' ' } else { b[i] });
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Сравнение ключа за постоянное время.
fn same(a: &[u8], b: &[u8]) -> bool { a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0 }

fn handle(inner: &Arc<Inner>, mut req: Request) {
    let host = header(&req, "Host").unwrap_or("").to_string();
    let origin = header(&req, "Origin").unwrap_or("").to_string();
    let url = req.url().to_string();
    // защита от DNS rebinding: чужое имя хоста, которое указывает на 127.0.0.1, сюда не пускаем
    if host != format!("127.0.0.1:{}", inner.port) && host != format!("localhost:{}", inner.port) { return deny(inner, req, 421, &host, &origin); }
    if !same(param(&url, "token").unwrap_or_default().as_bytes(), inner.token.as_bytes()) { return deny(inner, req, 403, &host, &origin); }
    let path = url.split(['?', '#']).next().unwrap_or("");
    match (req.method(), path) {
        (Method::Post, "/event") => {
            let mut body = Vec::new();
            if req.as_reader().take(64_001).read_to_end(&mut body).is_err() || body.len() > 64_000 { return; }   // слишком большое событие не принимаем
            // битое событие просто пропускаем
            if let Ok(ev) = serde_json::from_slice::<Value>(&body) { inner.apply(&ev); }
            let _ = req.respond(Response::empty(204).with_header(cors()));
        }
        (Method::Get, "/state") => {
            let v = inner.poll(if origin.is_empty() { "-" } else { &origin });
            let _ = req.respond(Response::from_data(v.to_string()).with_header(cors())
                .with_header(hdr("Content-Type", "application/json; charset=utf-8")).with_header(hdr("Cache-Control", "no-store")));
        }
        (Method::Post, "/focus") => {
            let result = inner.focus(&clip(&param(&url, "id").unwrap_or_default(), 100));
            let _ = req.respond(Response::from_data(json!({ "result": result }).to_string()).with_header(cors())
                .with_header(hdr("Content-Type", "application/json; charset=utf-8")));
        }
        _ => { let _ = req.respond(Response::empty(404).with_header(cors())); }
    }
}

fn deny(inner: &Inner, req: Request, code: u16, host: &str, origin: &str) {
    {
        let mut st = inner.st();
        let now = now_ms();
        if now - st.denied_at > 60_000 {                  // не чаще раза в минуту, чтобы лог не разрастался
            st.denied_at = now;
            drop(st);
            let url = req.url();
            let shown = match url.find("token=") {
                Some(i) => { let end = url[i..].find('&').map(|e| i + e).unwrap_or(url.len()); format!("{}token=…{}", &url[..i], &url[end..]) }
                None => url.to_string(),
            };
            inner.log(&format!("отказ {code}: {} {shown} origin={} host={}", req.method(), if origin.is_empty() { "-" } else { origin }, if host.is_empty() { "-" } else { host }));
        }
    }
    let _ = req.respond(Response::empty(code).with_header(cors()));
}
