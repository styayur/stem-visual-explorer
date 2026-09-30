pub mod cache;
#[cfg(feature = "tauri")]
pub mod commands;
pub mod database;
pub mod error;
pub mod models;
pub mod providers;
pub mod search;
pub mod state;
pub mod util;
#[cfg(feature = "tauri")]
pub mod windows;

#[cfg(feature = "tauri")]
pub fn run() {
    use tauri::Manager;

    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().app_data_dir()?;
            let state = state::AppState::load(&app_dir)?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(|invoke| {
            let webview = invoke.message.webview();
            if !crate::util::is_app_window(webview.label()) {
                invoke
                    .resolver
                    .reject("WebViewer has no application IPC access");
                return true;
            }
            let handler: fn(tauri::ipc::Invoke<tauri::Wry>) -> bool = tauri::generate_handler![
                commands::search,
                commands::providers_info,
                commands::refresh_provider_index,
                commands::set_provider_enabled,
                commands::clear_cache,
                commands::get_settings,
                commands::save_settings,
                commands::add_favorite,
                commands::remove_favorite,
                commands::list_favorites,
                commands::add_history,
                commands::list_history,
                commands::clear_history,
                commands::open_external,
                commands::open_window,
                commands::close_window,
                commands::toggle_pin,
                commands::open_workspace,
                commands::get_workspace_items,
                commands::get_workspace_resources,
            ];
            handler(invoke)
        })
        .run(tauri::generate_context!())
        .expect("error while running STEM Visual Explorer");
}

/// No-op run used when the `tauri` feature is disabled (e.g. `cargo test
/// --no-default-features` for the pure-logic test suite).
#[cfg(not(feature = "tauri"))]
pub fn run() {}
#[cfg(test)]
mod regression_tests;
