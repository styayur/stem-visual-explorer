use crate::cache;
use crate::error::AppError;
use crate::models::{
    Favorite, HistoryEntry, NormalizedQuery, ProviderInfo, SearchResponse, SearchResult, Settings,
};
use crate::providers::{SearchContext, SearchOptions};
use crate::search::manager;
use crate::state::AppState;
use crate::util::validate_http_url;
use crate::windows;
use tauri::State;

fn to_err(e: AppError) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn search(
    state: State<'_, AppState>,
    query: String,
    force_refresh: Option<bool>,
) -> std::result::Result<SearchResponse, String> {
    let ctx = SearchContext {
        client: state.client.clone(),
        cache_dir: state.cache_dir.clone(),
    };
    let enabled = state.enabled_providers();
    manager::run_search(
        &ctx,
        &state.registry,
        &query,
        &enabled,
        force_refresh.unwrap_or(false),
    )
    .await
    .map_err(to_err)
}

#[tauri::command]
pub fn providers_info(
    state: State<'_, AppState>,
) -> std::result::Result<Vec<ProviderInfo>, String> {
    let enabled = state.enabled_providers();
    let out = state
        .registry
        .all()
        .iter()
        .map(|p| ProviderInfo {
            id: p.id().to_string(),
            name: p.name().to_string(),
            homepage: p.homepage().to_string(),
            preview_capability: p.preview_capability(),
            experimental: p.experimental(),
            indexed_items: p.indexed_items(),
            last_updated: p.last_updated(),
            enabled: enabled.iter().any(|id| id == p.id()),
        })
        .collect();
    Ok(out)
}

#[tauri::command]
pub async fn refresh_provider_index(
    state: State<'_, AppState>,
    id: String,
) -> std::result::Result<ProviderInfo, String> {
    let provider = state
        .registry
        .get(&id)
        .ok_or_else(|| AppError::Other(format!("unknown provider {id}")))
        .map_err(to_err)?;

    let empty = NormalizedQuery {
        raw: String::new(),
        tokens: vec![],
        variants: vec![],
        concept_ids: vec![],
        phrases: vec![],
        site_filter: None,
        type_filter: None,
    };
    let ctx = SearchContext {
        client: state.client.clone(),
        cache_dir: state.cache_dir.clone(),
    };
    let opts = SearchOptions {
        force_refresh: true,
    };
    let _ = provider.search(&ctx, &empty, &opts).await.map_err(to_err)?;

    let enabled = state.enabled_providers();
    Ok(ProviderInfo {
        id: provider.id().to_string(),
        name: provider.name().to_string(),
        homepage: provider.homepage().to_string(),
        preview_capability: provider.preview_capability(),
        experimental: provider.experimental(),
        indexed_items: provider.indexed_items(),
        last_updated: provider.last_updated(),
        enabled: enabled.iter().any(|e| e == provider.id()),
    })
}

#[tauri::command]
pub fn set_provider_enabled(
    state: State<'_, AppState>,
    id: String,
    enabled: bool,
) -> std::result::Result<(), String> {
    if state.registry.get(&id).is_none() {
        return Err(format!("unknown provider {id}"));
    }
    state
        .update_settings(|settings| {
            if enabled {
                if !settings.enabled_providers.contains(&id) {
                    settings.enabled_providers.push(id);
                }
            } else {
                settings.enabled_providers.retain(|p| p != &id);
            }
        })
        .map_err(to_err)
}

#[tauri::command]
pub fn clear_cache(state: State<'_, AppState>) -> std::result::Result<usize, String> {
    let removed = cache::clear_all(&state.cache_dir).map_err(to_err)?;
    for provider in state.registry.all() {
        provider.clear_index();
    }
    Ok(removed)
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> std::result::Result<Settings, String> {
    state
        .settings
        .lock()
        .map(|s| s.clone())
        .map_err(|_| "lock poisoned".to_string())
}

#[tauri::command]
pub fn save_settings(
    state: State<'_, AppState>,
    settings: Settings,
) -> std::result::Result<(), String> {
    state
        .update_settings(|current| *current = settings)
        .map_err(to_err)
}

#[tauri::command]
pub fn add_favorite(
    state: State<'_, AppState>,
    result: SearchResult,
) -> std::result::Result<(), String> {
    let created_at = chrono::Utc::now().timestamp();
    state.db.add_favorite(result, created_at).map_err(to_err)
}

#[tauri::command]
pub fn remove_favorite(state: State<'_, AppState>, id: String) -> std::result::Result<(), String> {
    state.db.remove_favorite(&id).map_err(to_err)
}

#[tauri::command]
pub fn list_favorites(state: State<'_, AppState>) -> std::result::Result<Vec<Favorite>, String> {
    state.db.list_favorites().map_err(to_err)
}

#[tauri::command]
pub fn add_history(
    state: State<'_, AppState>,
    query: String,
    result_count: usize,
) -> std::result::Result<(), String> {
    let created_at = chrono::Utc::now().timestamp();
    state
        .db
        .add_history(&query, result_count, created_at)
        .map_err(to_err)
}

#[tauri::command]
pub fn list_history(state: State<'_, AppState>) -> std::result::Result<Vec<HistoryEntry>, String> {
    state.db.list_history(200).map_err(to_err)
}

#[tauri::command]
pub fn clear_history(state: State<'_, AppState>) -> std::result::Result<(), String> {
    state.db.clear_history().map_err(to_err)
}

#[tauri::command]
pub fn open_external(state: State<'_, AppState>, url: String) -> std::result::Result<(), String> {
    let _ = state; // URL is validated before opening.
    let url = validate_http_url(&url).map_err(to_err)?;
    open::that(url.as_str()).map_err(|e| AppError::Other(e.to_string()).to_string())
}

#[tauri::command]
// WebView2 window creation must run outside the synchronous command handler.
pub async fn open_window(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    url: String,
    title: String,
) -> std::result::Result<String, String> {
    let url = validate_http_url(&url).map_err(to_err)?;
    let target = state
        .settings
        .lock()
        .map(|s| s.translate_target.clone())
        .unwrap_or_else(|_| "zh-CN".to_string());
    windows::open_browser_window(&app, url, &title, &target).map_err(to_err)
}

#[tauri::command]
pub fn close_window(app: tauri::AppHandle, label: String) -> std::result::Result<(), String> {
    windows::close_window(&app, &label).map_err(to_err)
}

#[tauri::command]
pub fn toggle_pin(app: tauri::AppHandle, label: String) -> std::result::Result<bool, String> {
    windows::toggle_pin(&app, &label).map_err(to_err)
}

#[tauri::command]
// Keep this asynchronous to avoid WebView2 deadlocking on Windows.
pub async fn open_workspace(
    app: tauri::AppHandle,
    urls: Vec<String>,
    resources: Option<Vec<SearchResult>>,
) -> std::result::Result<String, String> {
    if urls.is_empty() || urls.len() > 4 {
        return Err("A workspace requires one to four pages".into());
    }
    let mut valid = Vec::with_capacity(urls.len());
    for u in urls {
        valid.push(validate_http_url(&u).map_err(to_err)?.to_string());
    }
    let mut resources = resources.unwrap_or_default();
    if resources.len() > 4 {
        return Err("Too many workspace resources".into());
    }
    for resource in &mut resources {
        resource.url = validate_http_url(&resource.url)
            .map_err(to_err)?
            .to_string();
        if !valid.contains(&resource.url) {
            return Err("Workspace resource URL does not match".into());
        }
    }
    windows::open_workspace_window(
        &app,
        crate::models::WorkspacePayload {
            urls: valid,
            resources,
        },
    )
    .map_err(to_err)
}

#[tauri::command]
pub fn get_workspace_items(
    state: State<'_, AppState>,
    label: String,
) -> std::result::Result<Vec<String>, String> {
    state
        .workspace_payloads
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .get(&label)
        .map(|payload| payload.urls.clone())
        .ok_or_else(|| "workspace payload not found".to_string())
}

#[tauri::command]
pub fn get_workspace_resources(
    state: State<'_, AppState>,
    label: String,
) -> std::result::Result<Vec<SearchResult>, String> {
    state
        .workspace_payloads
        .lock()
        .map_err(|_| "lock poisoned".to_string())?
        .get(&label)
        .map(|payload| payload.resources.clone())
        .ok_or_else(|| "workspace payload not found".to_string())
}
