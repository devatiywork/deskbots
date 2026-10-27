// Окно обоев за иконками рабочего стола.
// Классическая схема (Windows 10, Windows 11 до 23H2): Progman по сообщению 0x052C создаёт отдельный WorkerW позади окна
// с иконками, окно обоев становится его дочерним. С 24H2 («поднятый» рабочий стол) иконки (SHELLDLL_DefView) и WorkerW —
// дочерние окна самого Progman: обои становятся слоистым дочерним окном Progman ниже иконок и выше WorkerW.
use serde::Serialize;
use windows::core::{w, BOOL, PCWSTR};
use windows::Win32::Devices::Display::*;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::UI::WindowsAndMessaging::*;

#[derive(Clone, Serialize)]
pub struct Monitor {
    pub id: String,      // \\.\DISPLAY2
    pub name: String,    // название монитора из EDID, например AF24H1
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
    pub primary: bool,
}

// названия мониторов: \\.\DISPLAYn -> «AF24H1»
fn friendly_names() -> Vec<(String, String)> {
    let mut out = Vec::new();
    unsafe {
        let (mut np, mut nm) = (0u32, 0u32);
        if GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut np, &mut nm) != ERROR_SUCCESS { return out; }
        let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); np as usize];
        let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); nm as usize];
        if QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, &mut np, paths.as_mut_ptr(), &mut nm, modes.as_mut_ptr(), None) != ERROR_SUCCESS { return out; }
        for p in paths.iter().take(np as usize) {
            let mut src = DISPLAYCONFIG_SOURCE_DEVICE_NAME::default();
            src.header.r#type = DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME;
            src.header.size = std::mem::size_of::<DISPLAYCONFIG_SOURCE_DEVICE_NAME>() as u32;
            src.header.adapterId = p.sourceInfo.adapterId;
            src.header.id = p.sourceInfo.id;
            let mut tgt = DISPLAYCONFIG_TARGET_DEVICE_NAME::default();
            tgt.header.r#type = DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME;
            tgt.header.size = std::mem::size_of::<DISPLAYCONFIG_TARGET_DEVICE_NAME>() as u32;
            tgt.header.adapterId = p.targetInfo.adapterId;
            tgt.header.id = p.targetInfo.id;
            if DisplayConfigGetDeviceInfo(&mut src.header) == 0 && DisplayConfigGetDeviceInfo(&mut tgt.header) == 0 {
                out.push((wstr(&src.viewGdiDeviceName), wstr(&tgt.monitorFriendlyDeviceName)));
            }
        }
    }
    out
}

fn wstr(b: &[u16]) -> String {
    String::from_utf16_lossy(&b[..b.iter().position(|&c| c == 0).unwrap_or(b.len())])
}

pub fn monitors() -> Vec<Monitor> {
    unsafe extern "system" fn cb(h: HMONITOR, _: HDC, _: *mut RECT, data: LPARAM) -> BOOL {
        let v = &mut *(data.0 as *mut Vec<Monitor>);
        let mut mi = MONITORINFOEXW::default();
        mi.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
        if GetMonitorInfoW(h, &mut mi.monitorInfo).as_bool() {
            let r = mi.monitorInfo.rcMonitor;
            v.push(Monitor { id: wstr(&mi.szDevice), name: String::new(), x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top,
                primary: mi.monitorInfo.dwFlags & MONITORINFOF_PRIMARY != 0 });
        }
        TRUE
    }
    let mut v: Vec<Monitor> = Vec::new();
    unsafe { let _ = EnumDisplayMonitors(None, None, Some(cb), LPARAM(&mut v as *mut _ as isize)); }
    let names = friendly_names();
    for m in &mut v {
        m.name = names.iter().find(|(id, _)| *id == m.id).map(|(_, n)| n.clone()).filter(|n| !n.is_empty()).unwrap_or_else(|| m.id.trim_start_matches(r"\\.\").to_string());
    }
    v.sort_by_key(|m| (m.x, m.y));
    v
}

// какие мониторы занять: выбранные в настройках; если не выбран ни один или выбранные отключены — все
pub fn pick(list: &[Monitor], want: &[String]) -> Vec<Monitor> {
    let chosen: Vec<Monitor> = list.iter().filter(|m| want.contains(&m.id)).cloned().collect();
    if chosen.is_empty() { list.to_vec() } else { chosen }
}

// метка окна обоев для монитора: \\.\DISPLAY2 -> wp-DISPLAY2
pub fn label(id: &str) -> String {
    format!("wp-{}", id.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>())
}

fn class_of(h: HWND) -> String {
    let mut b = [0u16; 64];
    let n = unsafe { GetClassNameW(h, &mut b) };
    String::from_utf16_lossy(&b[..n.max(0) as usize])
}

// окно верхнего уровня, внутри которого лежат иконки (классическая схема)
fn icons_host() -> Option<HWND> {
    unsafe extern "system" fn cb(h: HWND, data: LPARAM) -> BOOL {
        if FindWindowExW(Some(h), None, w!("SHELLDLL_DefView"), PCWSTR::null()).is_ok_and(|d| !d.is_invalid()) {
            *(data.0 as *mut HWND) = h;
            return FALSE;
        }
        TRUE
    }
    let mut found = HWND::default();
    unsafe { let _ = EnumWindows(Some(cb), LPARAM(&mut found as *mut _ as isize)); }
    (!found.is_invalid()).then_some(found)
}

pub struct Attached {
    pub parent: HWND,
    pub raised: bool,      // схема 24H2
}

/// Встраивает окно hwnd под иконки на прямоугольнике r (экранные пиксели).
pub fn attach(hwnd: HWND, r: (i32, i32, i32, i32)) -> Result<Attached, String> {
    unsafe {
        let progman = FindWindowW(w!("Progman"), PCWSTR::null()).map_err(|e| format!("нет Progman: {e}"))?;
        let mut res = 0usize;
        SendMessageTimeoutW(progman, 0x052C, WPARAM(0xD), LPARAM(1), SMTO_NORMAL, 1000, Some(&mut res));
        let defview = FindWindowExW(Some(progman), None, w!("SHELLDLL_DefView"), PCWSTR::null()).ok().filter(|h| !h.is_invalid());
        let raised = defview.is_some();
        let parent = if raised {
            progman
        } else {
            let mut worker = icons_host().and_then(|top| FindWindowExW(None, Some(top), w!("WorkerW"), PCWSTR::null()).ok()).filter(|h| !h.is_invalid());
            if worker.is_none() {
                SendMessageTimeoutW(progman, 0x052C, WPARAM(0), LPARAM(0), SMTO_NORMAL, 1000, Some(&mut res));
                worker = icons_host().and_then(|top| FindWindowExW(None, Some(top), w!("WorkerW"), PCWSTR::null()).ok()).filter(|h| !h.is_invalid());
            }
            worker.unwrap_or(progman)
        };
        // обычное дочернее окно без рамки; на 24H2 ещё и слоистое, иначе Windows его не покажет под иконками
        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let style = (style & !(WS_POPUP.0 | WS_CAPTION.0 | WS_THICKFRAME.0 | WS_SYSMENU.0 | WS_MINIMIZEBOX.0 | WS_MAXIMIZEBOX.0)) | WS_CHILD.0 | WS_VISIBLE.0;
        SetWindowLongPtrW(hwnd, GWL_STYLE, style as isize);
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let ex = (ex & !WS_EX_APPWINDOW.0) | WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0 | if raised { WS_EX_LAYERED.0 } else { 0 };
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, ex as isize);
        if raised { let _ = SetLayeredWindowAttributes(hwnd, COLORREF(0), 255, LWA_ALPHA); }
        SetParent(hwnd, Some(parent)).map_err(|e| format!("SetParent: {e}"))?;
        // координаты монитора в системе координат родителя
        let mut pts = [POINT { x: r.0, y: r.1 }];
        MapWindowPoints(None, Some(parent), &mut pts);
        let after = if raised { defview } else { Some(HWND_BOTTOM) };
        SetWindowPos(hwnd, after, pts[0].x, pts[0].y, r.2, r.3, SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED)
            .map_err(|e| format!("SetWindowPos: {e}"))?;
        Ok(Attached { parent, raised })
    }
}

/// Окно ещё на своём месте: родитель жив (Explorer мог перезапуститься), а на 24H2 оно выше фона WorkerW —
/// перерисовывая рабочий стол (например, после нового ярлыка), Explorer может опустить его под фон.
pub fn still_attached(hwnd: HWND, parent: HWND) -> bool {
    unsafe {
        if !IsWindow(Some(parent)).as_bool() || !GetParent(hwnd).is_ok_and(|p| p == parent) { return false; }
        let Some(bg) = FindWindowExW(Some(parent), None, w!("WorkerW"), PCWSTR::null()).ok().filter(|h| !h.is_invalid()) else { return true };
        // фон должен быть где-то ниже нас среди соседей
        let mut h = GetWindow(hwnd, GW_HWNDNEXT).ok().filter(|h| !h.is_invalid());
        while let Some(x) = h {
            if x == bg { return true; }
            h = GetWindow(x, GW_HWNDNEXT).ok().filter(|h| !h.is_invalid());
        }
        false
    }
}

/// Какая доля монитора сейчас показывает рабочий стол, а не окна поверх него: проверка сеткой 16×9 точек.
pub fn desktop_share(r: (i32, i32, i32, i32), own: HWND) -> f32 {
    let mut on = 0;
    for j in 0..9 {
        for i in 0..16 {
            let pt = POINT { x: r.0 + r.2 * (2 * i + 1) / 32, y: r.1 + r.3 * (2 * j + 1) / 18 };
            if desktop_at(pt, own) { on += 1; }
        }
    }
    on as f32 / 144.0
}

/// Под курсором рабочий стол (иконки или пустое место), а не чужое окно.
pub fn desktop_at(pt: POINT, own: HWND) -> bool {
    unsafe {
        let h = WindowFromPoint(pt);
        if h.is_invalid() { return false; }
        if h == own { return true; }
        matches!(class_of(h).as_str(), "SysListView32" | "SHELLDLL_DefView" | "WorkerW" | "Progman")
            || matches!(class_of(GetAncestor(h, GA_ROOT)).as_str(), "Progman" | "WorkerW")
    }
}
