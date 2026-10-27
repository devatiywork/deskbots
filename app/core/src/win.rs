// Всё, что раньше делал постоянный PowerShell: список процессов, простой мыши и клавиатуры, нагрузка процессора и памяти,
// «не беспокоить» Windows, окно на весь экран, занятый микрофон, вывод окна агента на передний план.
use std::collections::HashMap;
use std::ffi::c_void;
use std::mem::{size_of, zeroed};

use windows_sys::Wdk::System::Threading::{NtQueryInformationProcess, ProcessCommandLineInformation};
use windows_sys::Win32::Foundation::{CloseHandle, ERROR_SUCCESS, FILETIME, HANDLE, HWND, INVALID_HANDLE_VALUE, LPARAM, RECT, UNICODE_STRING};
use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
use windows_sys::Win32::Security::Cryptography::{BCryptGenRandom, BCRYPT_USE_SYSTEM_PREFERRED_RNG};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS};
use windows_sys::Win32::System::Registry::{RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ, REG_QWORD};
use windows_sys::Win32::System::SystemInformation::{GetTickCount, GlobalMemoryStatusEx, MEMORYSTATUSEX};
use windows_sys::Win32::System::Threading::{GetProcessTimes, GetSystemTimes, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, keybd_event, KEYEVENTF_KEYUP, LASTINPUTINFO, VK_MENU};
use windows_sys::Win32::UI::Shell::{SHQueryUserNotificationState, QUNS_NOT_PRESENT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetForegroundWindow, GetWindow, GetWindowRect, GetWindowThreadProcessId, IsIconic, IsWindowVisible, SetForegroundWindow,
    ShowWindowAsync, GW_OWNER, SW_RESTORE,
};

fn wide(s: &str) -> Vec<u16> { s.encode_utf16().chain(Some(0)).collect() }
fn from_wide(b: &[u16]) -> String { String::from_utf16_lossy(&b[..b.iter().position(|&c| c == 0).unwrap_or(b.len())]) }
fn ft(f: &FILETIME) -> u64 { (f.dwHighDateTime as u64) << 32 | f.dwLowDateTime as u64 }

/// Имя программы без «.exe», как ProcessName в PowerShell.
pub fn bare(name: &str) -> &str {
    if name.len() > 4 && name[name.len() - 4..].eq_ignore_ascii_case(".exe") { &name[..name.len() - 4] } else { name }
}

pub struct RawProc { pub pid: u32, pub ppid: u32, pub name: String }

/// Все процессы: pid, родитель, имя файла (снимок toolhelp, без WMI).
pub fn processes() -> Option<Vec<RawProc>> {
    unsafe {
        let h = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if h == INVALID_HANDLE_VALUE { return None; }
        let mut out = Vec::with_capacity(400);
        let mut pe: PROCESSENTRY32W = zeroed();
        pe.dwSize = size_of::<PROCESSENTRY32W>() as u32;
        let mut ok = Process32FirstW(h, &mut pe) != 0;
        while ok {
            out.push(RawProc { pid: pe.th32ProcessID, ppid: pe.th32ParentProcessID, name: from_wide(&pe.szExeFile) });
            ok = Process32NextW(h, &mut pe) != 0;
        }
        CloseHandle(h);
        if out.is_empty() { None } else { Some(out) }
    }
}

/// Путь к программе и командная строка не меняются, пока жив процесс: помним их по (pid, время запуска).
#[derive(Default)]
pub struct Sampler {
    sys: (u64, u64, u64),
    cache: HashMap<u32, (u64, String, String)>,
}

/// Путь, командная строка и процессорное время (секунды) одного процесса; None — нет доступа или уже закрылся.
pub fn details(pid: u32, s: &mut Sampler) -> Option<(String, String, f64)> {
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() { return None; }
        let (mut c, mut e, mut k, mut u): (FILETIME, FILETIME, FILETIME, FILETIME) = (zeroed(), zeroed(), zeroed(), zeroed());
        let times = GetProcessTimes(h, &mut c, &mut e, &mut k, &mut u) != 0;
        let created = ft(&c);
        let cached = s.cache.get(&pid).filter(|x| x.0 == created).map(|x| (x.1.clone(), x.2.clone()));
        let (exe, cmd) = match cached {
            Some(x) => x,
            None => {
                let x = (image_path(h), command_line(h));
                s.cache.insert(pid, (created, x.0.clone(), x.1.clone()));
                x
            }
        };
        CloseHandle(h);
        let cpu = if times { (ft(&k) + ft(&u)) as f64 / 1e7 } else { 0.0 };
        Some((exe, cmd, cpu))
    }
}

/// Забыть закрытые процессы.
pub fn forget_except(s: &mut Sampler, alive: &std::collections::HashSet<u32>) { s.cache.retain(|pid, _| alive.contains(pid)); }

unsafe fn image_path(h: HANDLE) -> String {
    let mut buf = [0u16; 1024];
    let mut n = buf.len() as u32;
    if QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut n) == 0 { return String::new(); }
    String::from_utf16_lossy(&buf[..n as usize])
}

unsafe fn command_line(h: HANDLE) -> String {
    let mut buf: Vec<u64> = vec![0; 512];                 // u64: выравнивание для UNICODE_STRING
    for _ in 0..3 {
        let mut need = 0u32;
        let len = (buf.len() * 8) as u32;
        let st = NtQueryInformationProcess(h, ProcessCommandLineInformation, buf.as_mut_ptr() as *mut c_void, len, &mut need);
        if st >= 0 {
            let us = &*(buf.as_ptr() as *const UNICODE_STRING);
            if us.Buffer.is_null() || us.Length == 0 { return String::new(); }
            return String::from_utf16_lossy(std::slice::from_raw_parts(us.Buffer, us.Length as usize / 2));
        }
        if need as usize <= buf.len() * 8 { return String::new(); }
        buf = vec![0; need as usize / 8 + 1];
    }
    String::new()
}

/// Мс без мыши и клавиатуры.
pub fn idle_ms() -> u64 {
    unsafe {
        let mut p = LASTINPUTINFO { cbSize: size_of::<LASTINPUTINFO>() as u32, dwTime: 0 };
        if GetLastInputInfo(&mut p) == 0 { return 0; }
        GetTickCount().wrapping_sub(p.dwTime) as u64
    }
}

/// Загрузка процессора в % с прошлого вызова.
pub fn cpu_load(s: &mut Sampler) -> i64 {
    unsafe {
        let (mut i, mut k, mut u): (FILETIME, FILETIME, FILETIME) = (zeroed(), zeroed(), zeroed());
        if GetSystemTimes(&mut i, &mut k, &mut u) == 0 { return 0; }
        let (i, k, u) = (ft(&i), ft(&k), ft(&u));
        let (pi, pk, pu) = s.sys;
        s.sys = (i, k, u);
        let all = k.wrapping_sub(pk) as i64 + u.wrapping_sub(pu) as i64;
        let busy = all - i.wrapping_sub(pi) as i64;
        if all > 0 { 100 * busy / all } else { 0 }
    }
}

/// Занятая память в %.
pub fn mem_load() -> i64 {
    unsafe {
        let mut m: MEMORYSTATUSEX = zeroed();
        m.dwLength = size_of::<MEMORYSTATUSEX>() as u32;
        if GlobalMemoryStatusEx(&mut m) == 0 { return 0; }
        m.dwMemoryLoad as i64
    }
}

/// Состояние «не беспокоить» Windows (3 — игра или видео на весь экран через Direct3D).
pub fn quns() -> i32 {
    let mut s = 0;
    unsafe { if SHQueryUserNotificationState(&mut s) < 0 { return 0; } }
    s
}

/// Экран заблокирован или запущена заставка.
pub fn locked() -> bool { quns() == QUNS_NOT_PRESENT }

/// pid процесса, чьё окно на переднем плане закрывает весь монитор; 0 — такого нет.
pub fn fullscreen_pid() -> u32 {
    unsafe {
        let h = GetForegroundWindow();
        if h.is_null() { return 0; }
        let mut r: RECT = zeroed();
        if GetWindowRect(h, &mut r) == 0 { return 0; }
        let mut mi: MONITORINFO = zeroed();
        mi.cbSize = size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST), &mut mi) == 0 { return 0; }
        let m = mi.rcMonitor;
        if r.left > m.left || r.top > m.top || r.right < m.right || r.bottom < m.bottom { return 0; }
        let mut pid = 0;
        GetWindowThreadProcessId(h, &mut pid);
        pid
    }
}

// ---------- микрофон: Windows сама записывает в реестр, кто и когда им пользуется ----------
struct Key(HKEY);
impl Drop for Key { fn drop(&mut self) { unsafe { RegCloseKey(self.0); } } }
impl Key {
    fn open(parent: HKEY, path: &str) -> Option<Key> {
        let mut h: HKEY = std::ptr::null_mut();
        let w = wide(path);
        if unsafe { RegOpenKeyExW(parent, w.as_ptr(), 0, KEY_READ, &mut h) } != ERROR_SUCCESS { return None; }
        Some(Key(h))
    }
    fn subkeys(&self) -> Vec<String> {
        let mut out = Vec::new();
        let mut buf = [0u16; 512];
        for i in 0.. {
            let mut n = buf.len() as u32;
            let rc = unsafe { RegEnumKeyExW(self.0, i, buf.as_mut_ptr(), &mut n, std::ptr::null(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut()) };
            if rc != ERROR_SUCCESS { break; }
            out.push(String::from_utf16_lossy(&buf[..n as usize]));
        }
        out
    }
    fn qword(&self, name: &str, def: i64) -> i64 {
        let w = wide(name);
        let (mut t, mut v, mut n) = (0u32, 0i64, 8u32);
        let rc = unsafe { RegQueryValueExW(self.0, w.as_ptr(), std::ptr::null(), &mut t, &mut v as *mut i64 as *mut u8, &mut n) };
        if rc != ERROR_SUCCESS || t != REG_QWORD { def } else { v }
    }
    fn busy(&self) -> bool { self.qword("LastUsedTimeStart", 0) > 0 && self.qword("LastUsedTimeStop", 1) == 0 }
}

/// Занят ли микрофон сейчас (без доступа к звуку).
pub fn mic_on() -> bool {
    let Some(k) = Key::open(HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone") else { return false };
    let mut on = false;
    for n in k.subkeys() {
        let Some(s) = Key::open(k.0, &n) else { continue };
        if n == "NonPackaged" {
            for m in s.subkeys() { if Key::open(s.0, &m).is_some_and(|x| x.busy()) { on = true; } }
        } else if s.busy() { on = true; }
    }
    on
}

// ---------- клик по агенту: окно его программы выходит вперёд ----------
/// Главное окно процесса, как MainWindowHandle в .NET: первое видимое окно верхнего уровня без владельца.
fn main_windows() -> HashMap<u32, HWND> {
    unsafe extern "system" fn cb(h: HWND, l: LPARAM) -> windows_sys::core::BOOL {
        let map = &mut *(l as *mut HashMap<u32, HWND>);
        if GetWindow(h, GW_OWNER).is_null() && IsWindowVisible(h) != 0 {
            let mut pid = 0;
            GetWindowThreadProcessId(h, &mut pid);
            map.entry(pid).or_insert(h);
        }
        1
    }
    let mut map: HashMap<u32, HWND> = HashMap::new();
    unsafe { EnumWindows(Some(cb), &mut map as *mut _ as LPARAM); }
    map
}

/// От каждого процесса вверх по родителям (до 12 шагов, до explorer) к первому окну; оно выходит вперёд.
/// Ответ: имя программы, «denied» (Windows не дала) или «none» (окна нет).
pub fn focus(pids: &[u32]) -> Option<String> {
    let table: HashMap<u32, RawProc> = processes()?.into_iter().map(|p| (p.pid, p)).collect();
    let wins = main_windows();
    for &id in pids {
        let (mut cur, mut hops) = (id, 0);
        while cur > 0 && hops < 12 {
            let Some(p) = table.get(&cur) else { break };
            let name = bare(&p.name);
            if name.eq_ignore_ascii_case("explorer") { break; }
            if let Some(&h) = wins.get(&cur) {
                unsafe {
                    if IsIconic(h) != 0 { ShowWindowAsync(h, SW_RESTORE); }
                    // нажатие Alt снимает запрет Windows выводить чужое окно вперёд
                    keybd_event(VK_MENU as u8, 0, 0, 0);
                    keybd_event(VK_MENU as u8, 0, KEYEVENTF_KEYUP, 0);
                    return Some(if SetForegroundWindow(h) != 0 { name.to_string() } else { "denied".into() });
                }
            }
            cur = p.ppid;
            hops += 1;
        }
    }
    Some("none".into())
}

/// Случайные байты из системного генератора.
pub fn random(n: usize) -> Vec<u8> {
    let mut b = vec![0u8; n];
    unsafe { BCryptGenRandom(std::ptr::null_mut(), b.as_mut_ptr(), n as u32, BCRYPT_USE_SYSTEM_PREFERRED_RNG); }
    b
}
