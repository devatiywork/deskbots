// Автозапуск при входе в Windows: строка в HKCU\...\Run, без прав администратора.
use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
use winreg::RegKey;

const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const NAME: &str = "DeskBots";

pub fn set(on: bool) {
    let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(RUN, KEY_READ | KEY_WRITE) else { return };
    if on {
        if let Ok(exe) = std::env::current_exe() {
            let _ = key.set_value(NAME, &format!("\"{}\" --autostart", exe.display()));
        }
    } else {
        let _ = key.delete_value(NAME);
    }
}
