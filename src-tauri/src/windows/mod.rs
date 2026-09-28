use crate::error::{AppError, Result};
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

const TOOLBAR_SCRIPT: &str = r##"
(function () {
  var TARGET = '__SVE_TARGET__';
  var installed = false;
  var attempts = 0;
  var originals = new Map();
  var translating = false;

  function guessSource(text) {
    if (/[\u3040-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    return 'en';
  }

  function translatePage() {
    if (translating) return;
    var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1, CANVAS: 1, SVG: 1 };
    var nodes = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || SKIP[p.nodeName]) return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest('[data-sve]')) return NodeFilter.FILTER_REJECT;
        var txt = n.nodeValue ? n.nodeValue.trim() : '';
        if (txt.length < 2 || !/[A-Za-z\u3040-\u30ff\uac00-\ud7af]/.test(txt)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      nodes.push(node);
      if (nodes.length >= 90) break;
    }
    if (nodes.length === 0) return;

    translating = true;
    var btn = document.getElementById('sve-translate');
    var done = 0;
    var i = 0;

    function step() {
      if (i >= nodes.length) {
        translating = false;
        if (btn) btn.textContent = 'A/文';
        return;
      }
      var n = nodes[i++];
      var src = n.nodeValue || '';
      var trimmed = src.trim();
      if (!trimmed || originals.has(n)) { step(); return; }
      var from = guessSource(trimmed);
      if (from === TARGET) { step(); return; }
      var url = 'https://api.mymemory.translated.net/get?q=' +
        encodeURIComponent(trimmed.slice(0, 450)) +
        '&langpair=' + encodeURIComponent(from + '|' + TARGET);
      fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var out = j && j.responseData && j.responseData.translatedText;
          if (out && typeof out === 'string' && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) {
            originals.set(n, src);
            n.nodeValue = src.replace(trimmed, out);
            done++;
            if (btn) btn.textContent = '文 ' + done;
          }
        })
        .catch(function () {})
        .then(function () { setTimeout(step, 110); });
    }
    step();
  }

  function restorePage() {
    originals.forEach(function (value, node) { node.nodeValue = value; });
    originals.clear();
    var btn = document.getElementById('sve-translate');
    if (btn) btn.textContent = 'A/文';
  }

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
      return b;
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
    var tb = add('A/\u6587', 'Translate page', function () {
      if (originals.size > 0) restorePage();
      else translatePage();
    });
    tb.id = 'sve-translate';
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

    WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .title(title)
        .initialization_script(script)
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
