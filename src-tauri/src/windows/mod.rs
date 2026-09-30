use crate::error::{AppError, Result};
use crate::util::validate_http_url;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(1);

fn next_id() -> u64 {
    WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed)
}

/// Build the injected toolbar script with a concrete translation target.
///
/// The toolbar provides Back / Forward / Reload / Copy URL / Translate /
/// Open externally / Pin / Close. Translation happens *in place* using the
/// keyless MyMemory API (which sends `Access-Control-Allow-Origin: *`), with
/// the original text cached so the toggle can restore it.
fn toolbar_script(target_lang: &str) -> String {
    let safe_lang: String = target_lang
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(12)
        .collect();
    let lang = if safe_lang.is_empty() {
        "zh-CN".to_string()
    } else {
        safe_lang
    };

    TOOLBAR_SCRIPT.replace("__SVE_TARGET__", &lang)
}

const TOOLBAR_SCRIPT: &str = include_str!("toolbar.js");

/// Create a standalone browser window that loads an external http/https URL.
pub fn open_browser_window(
    app: &AppHandle,
    url: Url,
    title: &str,
    target_lang: &str,
) -> Result<String> {
    let label = format!("browser-{}", next_id());
    let handle = app.clone();
    let label_for_nav = label.clone();
    let script = toolbar_script(target_lang);
    let popup_app = app.clone();
    let popup_target = target_lang.to_string();

    WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .title(title)
        .initialization_script(script)
        .on_new_window(move |url, _features| {
            // Never let an external page create an unguarded WebView or inherit
            // app capabilities. Windows requires window creation off this callback.
            if let Ok(url) = validate_http_url(url.as_str()) {
                let app = popup_app.clone();
                let target = popup_target.clone();
                std::thread::spawn(move || {
                    let _ = open_browser_window(&app, url, "WebViewer", &target);
                });
            }
            tauri::webview::NewWindowResponse::Deny
        })
        .on_navigation(move |url| handle_sve_navigation(&handle, &label_for_nav, url))
        .build()
        .map_err(|e| AppError::Other(format!("failed to open window: {e}")))?;

    Ok(label)
}

/// Create a workspace window (a local app window that loads the main bundle
/// with the workspace route). Payload is stored in Rust state keyed by label.
pub fn open_workspace_window(
    app: &AppHandle,
    payload: crate::models::WorkspacePayload,
) -> Result<String> {
    let label = format!("workspace-{}", next_id());
    let state = app.state::<crate::state::AppState>();
    state
        .workspace_payloads
        .lock()
        .map_err(|_| AppError::Other("lock poisoned".into()))?
        .insert(label.clone(), payload);

    let window = WebviewWindowBuilder::new(
        app,
        &label,
        WebviewUrl::App("index.html?route=workspace".into()),
    )
    .title("Workspace")
    .inner_size(1200.0, 760.0)
    .min_inner_size(720.0, 480.0)
    .build();
    let window = match window {
        Ok(window) => window,
        Err(e) => {
            if let Ok(mut payloads) = state.workspace_payloads.lock() {
                payloads.remove(&label);
            }
            return Err(AppError::Other(format!("failed to open workspace: {e}")));
        }
    };
    let handle = app.clone();
    let cleanup_label = label.clone();
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            let state = handle.state::<crate::state::AppState>();
            if let Ok(mut payloads) = state.workspace_payloads.lock() {
                payloads.remove(&cleanup_label);
            };
        }
    });

    Ok(label)
}

/// Route the `sve://` pseudo-scheme to window actions. Returning `false`
/// cancels the navigation so no error page is shown.
fn handle_sve_navigation(app: &AppHandle, label: &str, url: &Url) -> bool {
    if url.scheme() != "sve" {
        return validate_http_url(url.as_str()).is_ok();
    }
    match url.host_str() {
        Some("open-external") => {
            if let Some(pair) = url.query_pairs().find(|(k, _)| k == "url") {
                if let Ok(target) = validate_http_url(pair.1.as_ref()) {
                    let _ = open::that(target.as_str());
                }
            }
        }
        Some("toggle-pin") => {
            if let Some(window) = app.get_webview_window(label) {
                let current = window.is_always_on_top().unwrap_or(false);
                let _ = window.set_always_on_top(!current);
            }
        }
        Some("close") => {
            if let Some(window) = app.get_webview_window(label) {
                let _ = window.close();
            }
        }
        _ => {}
    }
    false
}

/// Close a child window by label.
pub fn close_window(app: &AppHandle, label: &str) -> Result<()> {
    if let Some(window) = app.get_webview_window(label) {
        window.close().map_err(|e| AppError::Other(e.to_string()))?;
    }
    Ok(())
}

/// Toggle always-on-top for a child window by label.
pub fn toggle_pin(app: &AppHandle, label: &str) -> Result<bool> {
    if let Some(window) = app.get_webview_window(label) {
        let current = window.is_always_on_top().unwrap_or(false);
        window
            .set_always_on_top(!current)
            .map_err(|e| AppError::Other(e.to_string()))?;
        return Ok(!current);
    }
    Ok(false)
}
