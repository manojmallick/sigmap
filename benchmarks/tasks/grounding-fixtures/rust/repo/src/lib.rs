pub mod util;

/// Project configuration.
pub struct Config {
    pub path: String,
}

/// Load configuration from the given path.
pub fn load_config(path: &str) -> Config {
    Config { path: path.to_string() }
}

/// Keep the candidates that contain the query.
pub fn rank_files(query: &str, files: &[String]) -> Vec<String> {
    files.iter().filter(|f| f.contains(query)).cloned().collect()
}
