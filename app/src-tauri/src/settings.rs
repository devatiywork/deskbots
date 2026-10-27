// Настройки приложения: один файл app-settings.json в папке данных. Ключи совпадают со свойствами обоев,
// которые раньше задавались в Wallpaper Engine, поэтому страница обоев применяет их тем же кодом.
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub monitors: Vec<String>,       // [\\.\DISPLAY1, \\.\DISPLAY2]; пусто — офис на всех мониторах
    pub season: String,
    pub weather: String,
    pub sound: bool,
    pub volume: u32,
    pub latitude: f64,
    pub longitude: f64,
    pub panel: String,
    pub panelsize: String,
    pub showclaude: bool,
    pub showcodex: bool,
    pub showgpt: bool,
    pub showollama: bool,
    pub showother: bool,
    pub afk: u32,
    pub lunchon: bool,
    pub lunch: u32,
    pub endday: u32,
    pub sleepon: bool,
    pub sleephour: u32,
    pub gamequiet: bool,
    pub callmute: bool,
    pub scale: String,
    pub oled: bool,
    pub sign1: String,               // надпись на вывеске над офисом, верхняя строка
    pub sign2: String,               // нижняя строка; пустая — одна строка по центру
    pub ermii: bool,                 // режим Grand Ermii: руководство приезжает на лимузине и ходит по офису
    pub visits: u32,                 // сколько раз за рабочий день, 1–4
    pub p1name: String,              // Андрей (пользователь), разработчик; пустое имя — не приезжает
    pub p2name: String,              // Сергей, разработчик
    pub p3name: String,              // Фёдор, владелец и начальник
    pub autostart: bool,
    pub paused: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            monitors: Vec::new(),
            season: "auto".into(),
            weather: "real".into(),
            sound: true,
            volume: 35,
            latitude: 43.12,
            longitude: 131.89,
            panel: "right".into(),
            panelsize: "normal".into(),
            showclaude: true,
            showcodex: true,
            showgpt: true,
            showollama: true,
            showother: true,
            afk: 10,
            lunchon: true,
            lunch: 13,
            endday: 19,
            sleepon: true,
            sleephour: 23,
            gamequiet: true,
            callmute: true,
            scale: "fill".into(),
            oled: false,
            sign1: "DESKBOTS".into(),
            sign2: "AI OFFICE".into(),
            ermii: true,
            visits: 2,
            p1name: "Андрей".into(),
            p2name: "Сергей".into(),
            p3name: "Фёдор".into(),
            autostart: true,
            paused: false,
        }
    }
}

pub fn load(path: &Path) -> Settings {
    std::fs::read_to_string(path).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

pub fn save(path: &Path, s: &Settings) {
    if let Ok(t) = serde_json::to_string_pretty(s) {
        let tmp = path.with_extension("json.tmp");
        if std::fs::write(&tmp, t).is_ok() {
            let _ = std::fs::rename(&tmp, path);
        }
    }
}

// изменения из окна настроек или с панели обоев: только известные ключи, неверные значения отбрасываются целиком
pub fn merge(s: &Settings, patch: &serde_json::Value) -> Option<Settings> {
    let mut v = serde_json::to_value(s).ok()?;
    let (obj, p) = (v.as_object_mut()?, patch.as_object()?);
    for (k, val) in p {
        if obj.contains_key(k) {
            obj.insert(k.clone(), val.clone());
        }
    }
    let mut s: Settings = serde_json::from_value(v).ok()?;
    // на вывеске помещается 24 знака мелким шрифтом; буквы там только заглавные
    for t in [&mut s.sign1, &mut s.sign2] { *t = t.trim().to_uppercase().chars().take(24).collect(); }
    for t in [&mut s.p1name, &mut s.p2name, &mut s.p3name] { *t = t.trim().chars().take(14).collect(); }
    s.visits = s.visits.clamp(1, 4);
    Some(s)
}
