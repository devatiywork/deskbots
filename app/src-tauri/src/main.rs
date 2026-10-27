// DeskBots: пиксельный офис с ИИ-агентами прямо на рабочем столе, без Wallpaper Engine.
// На каждом выбранном мониторе своё окно обоев под иконками, мышь над пустым рабочим столом пересылается в него.
// Сервер офиса (агенты, хуки Claude Code и Codex, сводка, лимиты, нагрузка ПК) работает внутри приложения.
// Окно настроек открывается из трея; панель на самих обоях осталась прежней, обе стороны видят одни настройки.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod autostart;
mod desktop;
mod mouse;
mod office;
mod settings;

use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use windows::Win32::Foundation::HWND;

// одинаковые для всех окон: у WebView2 одно окружение на приложение.
// Окно обоев закрыто иконками, и без этих ключей Chromium считал бы его невидимым и останавливал анимацию.
const BROWSER_ARGS: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,CalculateNativeWinOcclusion \
--disable-backgrounding-occluded-windows --disable-renderer-backgrounding --autoplay-policy=no-user-gesture-required";

struct Placed { parent: isize, hwnd: isize, monitor: String, rect: (i32, i32, i32, i32), raised: bool }

struct Shared {
    dir: PathBuf,
    settings: Mutex<settings::Settings>,
    office: Option<office::Office>,
    error: String,
    placed: Mutex<HashMap<String, Placed>>,   // по метке окна обоев (wp-DISPLAY2)
    main_screen: Mutex<String>,               // метка окна обоев, которое играет звук
    desk_shown: AtomicBool,                   // рабочий стол на мониторе со звуком виден, а не закрыт окнами
    syncing: Mutex<()>,
    pause_item: Mutex<Option<CheckMenuItem<tauri::Wry>>>,
}
type St<'a> = State<'a, Arc<Shared>>;

// ключи WebView2; OFFICE_DEVTOOLS=порт включает отладку страниц через DevTools (только для разработки)
fn browser_args() -> String {
    match std::env::var("OFFICE_DEVTOOLS") { Ok(p) if !p.is_empty() => format!("{BROWSER_ARGS} --remote-debugging-port={p}"), _ => BROWSER_ARGS.to_string() }
}

fn data_dir() -> PathBuf {
    PathBuf::from(std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into())).join("DeskBots-Data")
}
fn home() -> PathBuf { PathBuf::from(std::env::var("USERPROFILE").unwrap_or_default()) }
fn claude_settings() -> PathBuf { home().join(".claude").join("settings.json") }
fn codex_hooks() -> PathBuf {
    std::env::var("CODEX_HOME").map(PathBuf::from).unwrap_or_else(|_| home().join(".codex")).join("hooks.json")
}
fn hook_exe(dir: &PathBuf) -> PathBuf { dir.join("deskbots-hook.exe") }
// запущено из папки сборки (target): автозапуск и хуки Claude Code не трогаем, чтобы проверка не сломала рабочую установку
fn installed() -> bool { std::env::current_exe().map(|e| !e.to_string_lossy().to_lowercase().contains(r"\target\")).unwrap_or(false) }

fn log(sh: &Shared, msg: &str) {
    match &sh.office { Some(o) => o.log(msg), None => eprintln!("{msg}") }
}

// ---------- окна обоев, по одному на монитор ----------
// встраивает окно label под иконки на его мониторе (в главном потоке)
fn place_wallpaper(app: &AppHandle, label: &str) {
    let sh = app.state::<Arc<Shared>>().inner().clone();
    let Some(win) = app.get_webview_window(label) else { return };
    let Some(m) = desktop::monitors().into_iter().find(|m| desktop::label(&m.id) == label) else { return };
    let Ok(h) = win.hwnd() else { return };
    let hwnd = HWND(h.0 as _);
    match desktop::attach(hwnd, (m.x, m.y, m.w, m.h)) {
        Ok(a) => {
            // Масштаб Windows (125% и т. п.) не применяем: пиксель страницы — пиксель экрана, как было в Wallpaper Engine.
            // Иначе панель на 2K при 125% вырастает в полтора раза: её шрифт округляется до 10 px. Дочернее окно Progman
            // к тому же получает масштаб главного монитора, а не своего.
            let _ = win.with_webview(move |pw| unsafe {
                use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Controller3;
                use windows_core::Interface;
                if let Ok(c3) = pw.controller().cast::<ICoreWebView2Controller3>() {
                    let _ = c3.SetShouldDetectMonitorScaleChanges(false);
                    let _ = c3.SetRasterizationScale(1.0);
                }
            });
            log(&sh, &format!("обои на мониторе {} ({}, {}x{}), схема {}", m.name, m.id, m.w, m.h, if a.raised { "24H2" } else { "WorkerW" }));
            let mut placed = sh.placed.lock().unwrap();
            placed.insert(label.to_string(), Placed { parent: a.parent.0 as isize, hwnd: hwnd.0 as isize, monitor: m.id, rect: (m.x, m.y, m.w, m.h), raised: a.raised });
            mouse::set_targets(placed.values().map(|p| (p.rect, p.hwnd)).collect());
        }
        Err(e) => log(&sh, &format!("не смог встроить обои на {}: {e}", m.name)),
    }
}

// Окна обоев под выбранные мониторы: недостающие создаёт, сдвинутые встраивает заново (Explorer перезапустился,
// поменяли разрешение), лишние закрывает. Только из фонового потока: окно, созданное в главном потоке, WebView2 вешает.
fn sync_wallpapers(app: &AppHandle) {
    let sh = app.state::<Arc<Shared>>().inner().clone();
    let _one = sh.syncing.lock().unwrap();
    let want = sh.settings.lock().unwrap().monitors.clone();
    let targets = desktop::pick(&desktop::monitors(), &want);
    let labels: Vec<String> = targets.iter().map(|m| desktop::label(&m.id)).collect();
    let mut removed = false;
    for (label, win) in app.webview_windows() {
        if label.starts_with("wp-") && !labels.contains(&label) {
            removed |= sh.placed.lock().unwrap().remove(&label).is_some();
            let _ = win.destroy();
        }
    }
    if removed {
        mouse::set_targets(sh.placed.lock().unwrap().values().map(|p| (p.rect, p.hwnd)).collect());
    }
    // звук играет одно окно: на главном мониторе, а если его не выбрали — на первом
    let main = targets.iter().find(|m| m.primary).or(targets.first()).map(|m| desktop::label(&m.id)).unwrap_or_default();
    if std::mem::replace(&mut *sh.main_screen.lock().unwrap(), main.clone()) != main { let _ = app.emit("screen", ()); }
    for (m, label) in targets.iter().zip(&labels) {
        if app.get_webview_window(label).is_none() {
            let built = WebviewWindowBuilder::new(app, label, WebviewUrl::App("wallpaper/index.html".into()))
                .title(format!("DeskBots — обои {}", m.name))
                .decorations(false)
                .resizable(false)
                .skip_taskbar(true)
                .focused(false)
                .shadow(false)
                .visible(false)
                .additional_browser_args(&browser_args())
                // WebView2 создаётся не сразу и берёт размер окна до встраивания: после загрузки страницы встраиваем ещё раз
                .on_page_load(|w, p| {
                    if matches!(p.event(), tauri::webview::PageLoadEvent::Finished) {
                        let (app, label) = (w.app_handle().clone(), w.label().to_string());
                        let _ = w.app_handle().run_on_main_thread(move || place_wallpaper(&app, &label));
                    }
                })
                .build();
            if let Err(e) = built { log(&sh, &format!("не смог создать окно обоев для {}: {e}", m.name)); continue; }
        }
        let ok = sh.placed.lock().unwrap().get(label).is_some_and(|p| p.rect == (m.x, m.y, m.w, m.h)
            && desktop::still_attached(HWND(p.hwnd as _), HWND(p.parent as _)));
        if !ok {
            let (a, l) = (app.clone(), label.clone());
            let _ = app.run_on_main_thread(move || place_wallpaper(&a, &l));
        }
    }
}

fn watch_wallpapers(app: AppHandle) {
    std::thread::spawn(move || loop {
        sync_wallpapers(&app);
        std::thread::sleep(Duration::from_secs(3));
    });
}

// Звук только когда рабочий стол виден: окна закрывают монитор со звуком больше чем наполовину — офис молчит.
fn watch_desk(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last = None;
        loop {
            std::thread::sleep(Duration::from_millis(400));
            let sh = app.state::<Arc<Shared>>().inner().clone();
            let main = sh.main_screen.lock().unwrap().clone();
            let target = sh.placed.lock().unwrap().get(&main).map(|p| (p.rect, p.hwnd));
            let shown = target.map_or(true, |(r, h)| desktop::desktop_share(r, HWND(h as _)) >= 0.5);
            sh.desk_shown.store(shown, Ordering::Relaxed);
            if last != Some(shown) { last = Some(shown); let _ = app.emit("desk", shown); }
        }
    });
}

// мышь с рабочего стола в страницу обоев своего монитора; движения не чаще 60 раз в секунду
fn forward_mouse(app: AppHandle) {
    let rx = mouse::start();
    std::thread::spawn(move || {
        let send = |hwnd: isize, js: String| {
            for (label, w) in app.webview_windows() {
                if label.starts_with("wp-") && w.hwnd().is_ok_and(|h| h.0 as isize == hwnd) { let _ = w.eval(&js); }
            }
        };
        let mv = |x: i32, y: i32| format!("window.__wpMouse&&__wpMouse('move',{x},{y})");
        let mut pending: Option<(isize, i32, i32)> = None;
        loop {
            match rx.recv_timeout(Duration::from_millis(16)) {
                Ok(mouse::Ev::Move(h, x, y)) => {
                    if let Some((ph, px, py)) = pending { if ph != h { send(ph, mv(px, py)); } }
                    pending = Some((h, x, y));
                }
                Ok(ev) => {
                    if let Some((ph, x, y)) = pending.take() { send(ph, mv(x, y)); }
                    let (h, js) = match ev {
                        mouse::Ev::Down(h, x, y) => (h, format!("window.__wpMouse&&__wpMouse('down',{x},{y})")),
                        mouse::Ev::Up(h, x, y) => (h, format!("window.__wpMouse&&__wpMouse('up',{x},{y})")),
                        mouse::Ev::Leave(h) | mouse::Ev::Move(h, ..) => (h, "window.__wpMouse&&__wpMouse('leave',0,0)".into()),
                    };
                    send(h, js);
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    if let Some((ph, x, y)) = pending.take() { send(ph, mv(x, y)); }
                }
                Err(_) => break,
            }
        }
    });
}

// ---------- окно настроек ----------
// из меню трея, щелчка по значку и второго запуска: там главный поток, поэтому окно создаём в фоновом
fn show_settings(app: &AppHandle) {
    let a = app.clone();
    std::thread::spawn(move || open_settings(&a));
}

fn open_settings(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.unminimize(); let _ = w.show(); let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings/index.html".into()))
        .title("DeskBots — настройки")
        .inner_size(1000.0, 720.0)
        .min_inner_size(780.0, 560.0)
        .center()
        .additional_browser_args(&browser_args())
        .build();
}

// ---------- команды для страниц ----------
#[tauri::command]
fn get_settings(st: St) -> settings::Settings { st.settings.lock().unwrap().clone() }

#[tauri::command]
fn set_settings(app: AppHandle, st: St, patch: Value) -> Result<settings::Settings, String> {
    let (old, new) = {
        let mut cur = st.settings.lock().unwrap();
        let new = settings::merge(&cur, &patch).ok_or("неверные настройки")?;
        let old = std::mem::replace(&mut *cur, new.clone());
        (old, new)
    };
    settings::save(&st.dir.join("app-settings.json"), &new);
    if old.autostart != new.autostart && installed() { autostart::set(new.autostart); }
    if old.monitors != new.monitors { let a = app.clone(); std::thread::spawn(move || sync_wallpapers(&a)); }
    if old.paused != new.paused { if let Some(i) = &*st.pause_item.lock().unwrap() { let _ = i.set_checked(new.paused); } }
    let _ = app.emit("settings", &new);
    Ok(new)
}

#[tauri::command]
fn monitors(st: St) -> Value {
    let list = desktop::monitors();
    let used: Vec<String> = st.placed.lock().unwrap().values().map(|p| p.monitor.clone()).collect();
    json!({ "list": list, "used": used })
}

// окно обоев спрашивает, играть ли ему звук: играет только окно на главном мониторе
#[tauri::command]
fn screen(window: tauri::WebviewWindow, st: St) -> Value {
    json!({ "main": *st.main_screen.lock().unwrap() == window.label(), "desk": st.desk_shown.load(Ordering::Relaxed) })
}

#[tauri::command]
async fn state(st: St<'_>) -> Result<Value, String> {
    Ok(match &st.office { Some(o) => o.state(), None => json!({ "agents": [], "scan": false, "error": st.error }) })
}

#[tauri::command]
async fn focus(st: St<'_>, id: String) -> Result<Value, String> {
    Ok(json!({ "result": st.office.as_ref().map(|o| o.focus(&id)).unwrap_or_else(|| "error".into()) }))
}

#[tauri::command]
fn app_info(st: St) -> Value {
    let exe = hook_exe(&st.dir);
    let codex = codex_hooks();
    let (hc, hx) = office::hooks::status(&exe, &claude_settings(), codex.parent().filter(|p| p.exists()).map(|_| codex.as_path()));
    let placed = st.placed.lock().unwrap();
    json!({
        "version": env!("CARGO_PKG_VERSION"),
        "dataDir": st.dir,
        "server": st.office.as_ref().map(|o| o.info()),
        "error": st.error,
        "hooks": { "claude": hc, "codex": hx, "exe": exe },
        "wallpaper": placed.values().map(|p| json!({ "monitor": p.monitor, "w": p.rect.2, "h": p.rect.3, "mode": if p.raised { "24H2" } else { "WorkerW" } })).collect::<Vec<_>>(),
    })
}

#[tauri::command]
fn install_hooks(st: St) -> Vec<String> {
    let codex = codex_hooks();
    office::hooks::install(&hook_exe(&st.dir), &claude_settings(), codex.parent().filter(|p| p.exists()).map(|_| codex.as_path()))
}

#[tauri::command]
fn remove_hooks(st: St) -> Vec<String> {
    let codex = codex_hooks();
    office::hooks::remove(&hook_exe(&st.dir), &claude_settings(), codex.parent().filter(|p| p.exists()).map(|_| codex.as_path()))
}

// асинхронная: синхронная команда, создающая окно, в Windows блокирует главный поток
#[tauri::command]
async fn open_settings_window(app: AppHandle) { open_settings(&app); }

#[tauri::command]
fn quit(app: AppHandle) { app.exit(0); }

// deskbots-hook.exe лежит в папке данных, чтобы путь в настройках Claude Code не менялся при обновлениях приложения
fn deploy_hook(app: &AppHandle, sh: &Shared) {
    let Ok(src) = app.path().resource_dir().map(|d| d.join("deskbots-hook.exe")) else { return };
    if !src.exists() { return; }
    let dst = hook_exe(&sh.dir);
    let same = std::fs::read(&src).ok().zip(std::fs::read(&dst).ok()).is_some_and(|(a, b)| a == b);
    if !same && std::fs::copy(&src, &dst).is_err() {
        // старый хук сейчас выполняется: занятый exe можно переименовать, а на его место положить новый
        let ms = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
        let old = sh.dir.join(format!("deskbots-hook.old-{ms}.exe"));
        if let Err(e) = std::fs::rename(&dst, &old).and_then(|_| std::fs::copy(&src, &dst).map(|_| ())) {
            log(sh, &format!("не смог положить deskbots-hook.exe: {e}"));
            return;
        }
    }
    // старые копии, которые уже никто не держит
    for e in std::fs::read_dir(&sh.dir).into_iter().flatten().flatten() {
        if e.file_name().to_string_lossy().starts_with("deskbots-hook.old-") { let _ = std::fs::remove_file(e.path()); }
    }
    let codex = codex_hooks();
    let codex = codex.parent().filter(|p| p.exists()).map(|_| codex.as_path());
    if office::hooks::status(&dst, &claude_settings(), codex) != (true, codex.is_some()) {
        for m in office::hooks::install(&dst, &claude_settings(), codex) { log(sh, &m); }
    }
}

fn main() {
    let dir = data_dir();
    let _ = std::fs::create_dir_all(&dir);
    let first_run = !dir.join("app-settings.json").exists();
    let s = settings::load(&dir.join("app-settings.json"));
    let port = std::env::var("OFFICE_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(7777);
    let (office, error) = match office::Office::start(dir.clone(), port, env!("CARGO_PKG_VERSION")) {
        Ok(o) => (Some(o), String::new()),
        Err(e) => (None, format!("сервер офиса не запустился: {e}")),
    };
    let quiet = std::env::args().any(|a| a == "--autostart");
    let shared = Arc::new(Shared { dir, settings: Mutex::new(s), office, error, placed: Mutex::new(HashMap::new()), main_screen: Mutex::new(String::new()),
        desk_shown: AtomicBool::new(true), syncing: Mutex::new(()), pause_item: Mutex::new(None) });

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_settings(app)))
        .manage(shared.clone())
        .invoke_handler(tauri::generate_handler![get_settings, set_settings, monitors, screen, state, focus, app_info, install_hooks, remove_hooks, open_settings_window, quit])
        .setup(move |app| {
            let h = app.handle().clone();
            let sh = shared.clone();
            if !sh.error.is_empty() { eprintln!("{}", sh.error); }
            if installed() {
                autostart::set(sh.settings.lock().unwrap().autostart);
                deploy_hook(&h, &sh);
            }
            watch_wallpapers(h.clone());
            forward_mouse(h.clone());
            watch_desk(h.clone());

            let paused = sh.settings.lock().unwrap().paused;
            let open = MenuItem::with_id(app, "settings", "Настройки", true, None::<&str>)?;
            let pause = CheckMenuItem::with_id(app, "pause", "Пауза", true, paused, None::<&str>)?;
            let exit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &pause, &PredefinedMenuItem::separator(app)?, &exit])?;
            *sh.pause_item.lock().unwrap() = Some(pause);
            TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().cloned().ok_or("нет значка")?)
                .tooltip("DeskBots")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, ev| match ev.id().as_ref() {
                    "settings" => show_settings(app),
                    "pause" => {
                        let st = app.state::<Arc<Shared>>();
                        let p = !st.settings.lock().unwrap().paused;
                        let _ = set_settings(app.clone(), st, json!({ "paused": p }));
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, ev| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev { show_settings(tray.app_handle()); }
                })
                .build(app)?;
            if first_run || !quiet { show_settings(&h); }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("не удалось запустить DeskBots")
        .run(|_app, ev| {
            // закрыли окно настроек — приложение живёт дальше в трее вместе с обоями
            if let tauri::RunEvent::ExitRequested { code: None, api, .. } = ev { api.prevent_exit(); }
        });
}
