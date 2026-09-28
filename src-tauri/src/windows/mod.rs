use crate::error::{AppError, Result};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

static WINDOW_COUNTER: AtomicU64 = AtomicU64::new(1);

fn next_id() -> u64 {
    WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed)
}

/// Injected into every browser window. It renders a compact floating toolbar
/// so a standalone window has Back / Forward / Reload / Copy URL / Open
/// externally / Pin / Close without relying on any site markup.
const TOOLBAR_SCRIPT: &str = r##"
(function () {
  var installed = false;
  var attempts = 0;
  function install() {
    if (installed) return;
    if (!document.body) {
      if (attempts++ < 40) setTimeout(install, 250);
      return;
    }
    installed = true;
    var bar = document.createElement('div');
    bar.id = 'sve-toolbar';
    bar.setAttribute('data-sve', 'toolbar');
    bar.style.cssText = 'position:fixed;top:10px;right:10px;z-index:2147483647;display:flex;gap:2px;background:rgba(18,20,25,0.82);border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:3px;font:12px/1 system-ui,-apple-system,Segoe UI,sans-serif;color:#e5e7eb;backdrop-filter:blur(6px);box-shadow:0 4px 16px rgba(0,0,0,0.35);';
    function add(label, title, action) {
      var b = document.createElement('button');
      b.textContent = label;
      b.title = title;
      b.style.cssText = 'background:transparent;border:0;color:#e5e7eb;cursor:pointer;padding:5px 8px;border-radius:6px;font-size:12px;line-height:1;font-family:inherit;';
      b.onmouseenter = function () { b.style.background = 'rgba(255,255,255,0.14)'; };
      b.onmouseleave = function () { b.style.background = 'transparent'; };
      b.onclick = function (e) { e.preventDefault(); e.stopPropagation(); action(); };
      bar.appendChild(b);
    }
    add('\u2190', 'Back', function () { try { history.back(); } catch (e) {} });
    add('\u2192', 'Forward', function () { try { history.forward(); } catch (e) {} });
    add('\u21bb', 'Reload', function () { try { location.reload(); } catch (e) {} });
    add('URL', 'Copy URL', function () {
      try { navigator.clipboard.writeText(location.href); }
      catch (e) {
        try {
          var t = document.createElement('textarea');
          t.value = location.href;
          document.body.appendChild(t);
          t.select();
          document.execCommand('copy');
          document.body.removeChild(t);
        } catch (err) {}
      }
    });
    add('\u2197', 'Open externally', function () { location.href = 'sve://open-external?url=' + encodeURIComponent(location.href); });
    add('\u25c8', 'Pin / unpin window', function () { location.href = 'sve://toggle-pin'; });
    add('\u00d7', 'Close window', function () { location.href = 'sve://close'; });
    document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  }
  install();
})();
"##;

/// Create a standalone browser window that loads an external http/https URL.
pub fn open_browser_window(app: &AppHandle, url: Url, title: &str) -> Result<String> {
    let label = format!("browser-{}", next_id());
    let handle = app.clone();
    let label_for_nav = label.clone();

    WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .title(title)
        .initialization_script(TOOLBAR_SCRIPT)
        .on_navigation(move |url| handle_sve_navigation(&handle, &label_for_nav, url))
        .build()
        .map_err(|e| AppError::Other(format!("failed to open window: {e}")))?;

    Ok(label)
}

/// Create a workspace window (a local app window that loads the main bundle
/// with the workspace route). Payload is stored in Rust state keyed by label.
pub fn open_workspace_window(app: &AppHandle, payload: Vec<String>) -> Result<String> {
    let label = format!("workspace-{}", next_id());
    let state = app.state::<crate::state::AppState>();
    state
        .workspace_payloads
        .lock()
        .map_err(|_| AppError::Other("lock poisoned".into()))?
        .insert(label.clone(), payload);

    WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title("Workspace")
        .inner_size(1200.0, 760.0)
        .min_inner_size(720.0, 480.0)
        .build()
        .map_err(|e| AppError::Other(format!("failed to open workspace: {e}")))?;

    Ok(label)
}

/// Route the `sve://` pseudo-scheme to window actions. Returning `false`
/// cancels the navigation so no error page is shown.
fn handle_sve_navigation(app: &AppHandle, label: &str, url: &Url) -> bool {
    if url.scheme() != "sve" {
        return true;
    }
    match url.host_str() {
        Some("open-external") => {
            if let Some(pair) = url.query_pairs().find(|(k, _)| k == "url") {
                let _ = open::that(pair.1.as_ref());
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
