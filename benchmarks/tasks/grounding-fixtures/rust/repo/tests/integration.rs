#[test]
fn loads() {
    assert_eq!(fx::load_config("a").path, "a");
}
