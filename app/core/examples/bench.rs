// Замер разбора логов Claude: cargo run --release -p office-core --example bench [-- <папка projects>]
fn main() {
    let dir = std::env::args().nth(1).map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from(std::env::var_os("USERPROFILE").unwrap()).join(".claude").join("projects"));
    print!("{}", office_core::bench::run(&dir));
}
