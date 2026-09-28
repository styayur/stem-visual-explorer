fn main() {
    // Only run the Tauri build pipeline when the `tauri` feature is enabled.
    // With `--no-default-features` the crate builds as a pure library and does
    // not need the Tauri config, icons or frontend assets.
    #[cfg(feature = "tauri")]
    tauri_build::build();
}