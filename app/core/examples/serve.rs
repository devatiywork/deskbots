// Проверка сервера: cargo run --release -p office-core --example serve -- <папка данных> [секунд между выводами]
// Слушает 127.0.0.1:7791 и печатает state() каждые несколько секунд.
use std::time::Duration;

fn main() {
    let mut args = std::env::args().skip(1);
    let dir = args.next().expect("укажи папку данных");
    let every: u64 = args.next().and_then(|s| s.parse().ok()).unwrap_or(5);
    let office = office_core::Office::start(dir.into(), 7791, "dev").expect("сервер не запустился");
    println!("info {}", office.info());
    loop {
        println!("{}", serde_json::to_string_pretty(&office.state()).unwrap());
        std::thread::sleep(Duration::from_secs(every));
    }
}
