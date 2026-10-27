// Мышь на обоях. Окна обоев лежат под иконками, поэтому клики достаются рабочему столу. Низкоуровневый хук видит
// все движения и нажатия; если курсор над пустым рабочим столом на мониторе с обоями, копия события уходит в страницу
// обоев этого монитора (window.__wpMouse). Рабочий стол при этом получает клик как обычно: иконки работают.
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Mutex, OnceLock};
use windows::Win32::Foundation::*;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::*;

// hwnd окна обоев и координаты в пикселях его монитора
#[derive(Clone, Copy)]
pub enum Ev { Move(isize, i32, i32), Down(isize, i32, i32), Up(isize, i32, i32), Leave(isize) }

struct Target { rect: (i32, i32, i32, i32), hwnd: isize, inside: bool }
static TARGETS: Mutex<Vec<Target>> = Mutex::new(Vec::new());
static TX: OnceLock<Sender<Ev>> = OnceLock::new();

/// Куда пересылать: прямоугольники мониторов с обоями (экранные пиксели) и их окна.
pub fn set_targets(list: Vec<((i32, i32, i32, i32), isize)>) {
    if let Ok(mut t) = TARGETS.lock() {
        *t = list.into_iter().map(|(rect, hwnd)| Target { rect, hwnd, inside: false }).collect();
    }
}

unsafe extern "system" fn hook(code: i32, wp: WPARAM, lp: LPARAM) -> LRESULT {
    if code >= 0 {
        let m = &*(lp.0 as *const MSLLHOOKSTRUCT);
        let msg = wp.0 as u32;
        if matches!(msg, WM_MOUSEMOVE | WM_LBUTTONDOWN | WM_LBUTTONUP) {
            if let (Ok(mut list), Some(tx)) = (TARGETS.try_lock(), TX.get()) {
                for t in list.iter_mut() {
                    let (x, y, w, h) = t.rect;
                    let on = m.pt.x >= x && m.pt.x < x + w && m.pt.y >= y && m.pt.y < y + h
                        && crate::desktop::desktop_at(m.pt, HWND(t.hwnd as _));
                    if on {
                        let (lx, ly) = (m.pt.x - x, m.pt.y - y);
                        let _ = tx.send(match msg { WM_LBUTTONDOWN => Ev::Down(t.hwnd, lx, ly), WM_LBUTTONUP => Ev::Up(t.hwnd, lx, ly), _ => Ev::Move(t.hwnd, lx, ly) });
                    } else if t.inside {
                        let _ = tx.send(Ev::Leave(t.hwnd));
                    }
                    t.inside = on;
                }
            }
        }
    }
    CallNextHookEx(None, code, wp, lp)
}

/// Запускает поток с хуком. События приходят в возвращённый канал.
pub fn start() -> Receiver<Ev> {
    let (tx, rx) = channel();
    let _ = TX.set(tx);
    std::thread::spawn(|| unsafe {
        let inst = GetModuleHandleW(None).ok().map(|m| HINSTANCE(m.0));
        if SetWindowsHookExW(WH_MOUSE_LL, Some(hook), inst, 0).is_err() { return; }
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    });
    rx
}
