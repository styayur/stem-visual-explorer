use super::normalize;
use super::query;
use super::ranking;
use crate::error::{AppError, Result};
use crate::models::{ProviderState, ProviderStatus, SearchResponse, SearchResult};
use crate::providers::{ProviderRegistry, SearchContext, SearchOptions, SearchProvider};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::task::JoinSet;

const PROVIDER_TIMEOUT_SECS: u64 = 15;

/// Run one unified search across all enabled providers concurrently.
pub async fn run_search(
    ctx: &SearchContext,
    registry: &ProviderRegistry,
    raw_query: &str,
    enabled: &[String],
    force_refresh: bool,
) -> Result<SearchResponse> {
    let parsed = query::parse(raw_query);
    let query = normalize::expand(&parsed);
    let expanded_terms = query.tokens.clone();

    // Decide which providers participate.
    let mut selected: Vec<Arc<dyn SearchProvider>> = Vec::new();
    if let Some(site) = &query.site_filter {
        if let Some(p) = registry.get(site) {
            selected.push(p);
        }
    } else {
        for p in registry.all() {
            if enabled.iter().any(|id| id == p.id()) {
                selected.push(p.clone());
            }
        }
    }

    if query.is_empty() || selected.is_empty() {
        let providers = statuses_for(registry, enabled, &selected, &[], &HashMap::new());
        return Ok(SearchResponse {
            query: raw_query.trim().to_string(),
            expanded_terms,
            results: Vec::new(),
            providers,
            total: 0,
        });
    }

    // Concurrent search: each provider runs in its own task with a timeout.
    let mut set: JoinSet<(String, Result<Vec<SearchResult>>)> = JoinSet::new();
    let mut tasks = HashMap::new();
    for provider in selected.iter() {
        let provider = Arc::clone(provider);
        let ctx = ctx.clone();
        let query = query.clone();
        let opts = SearchOptions { force_refresh };
        let task_provider = provider.id().to_string();
        let task = set.spawn(async move {
            let id = provider.id().to_string();
            let result = tokio::time::timeout(
                std::time::Duration::from_secs(PROVIDER_TIMEOUT_SECS),
                provider.search(&ctx, &query, &opts),
            )
            .await
            .unwrap_or_else(|_| {
                Err(AppError::Other(format!(
                    "{} timed out after {PROVIDER_TIMEOUT_SECS}s",
                    provider.name()
                )))
            });
            (id, result)
        });
        tasks.insert(task.id(), task_provider);
    }

    let mut results: Vec<SearchResult> = Vec::new();
    let mut errors: HashMap<String, String> = HashMap::new();
    while let Some(res) = set.join_next().await {
        let (id, outcome) = match res {
            Ok(t) => t,
            Err(e) => (
                tasks
                    .get(&e.id())
                    .cloned()
                    .unwrap_or_else(|| "unknown".into()),
                Err(AppError::Other(e.to_string())),
            ),
        };
        match outcome {
            Ok(mut r) => results.append(&mut r),
            Err(e) => {
                errors.insert(id, e.to_string());
            }
        }
    }

    // Apply the optional type filter.
    if let Some(t) = query.type_filter {
        results.retain(|r| r.result_type == t);
    }

    // Rank and merge into one mixed stream.
    let results = ranking::rank(&query, results);
    let providers = statuses_for(registry, enabled, &selected, &results, &errors);
    let total = results.len();

    Ok(SearchResponse {
        query: raw_query.trim().to_string(),
        expanded_terms,
        results,
        providers,
        total,
    })
}

fn statuses_for(
    registry: &ProviderRegistry,
    enabled: &[String],
    selected: &[Arc<dyn SearchProvider>],
    results: &[SearchResult],
    errors: &HashMap<String, String>,
) -> Vec<ProviderStatus> {
    let mut statuses = Vec::new();
    for p in registry.all() {
        let is_enabled = enabled.iter().any(|id| id == p.id());
        let selected_here = selected.iter().any(|s| s.id() == p.id());
        let count = results.iter().filter(|r| r.source_id == p.id()).count();

        let (state, error) = if !selected_here {
            (ProviderState::Idle, None)
        } else if let Some(msg) = errors.get(p.id()) {
            (ProviderState::Error, Some(msg.clone()))
        } else {
            (ProviderState::Done, None)
        };

        statuses.push(ProviderStatus {
            id: p.id().to_string(),
            name: p.name().to_string(),
            homepage: p.homepage().to_string(),
            preview_capability: p.preview_capability(),
            state,
            count,
            error,
            indexed_items: p.indexed_items(),
            last_updated: p.last_updated(),
            experimental: p.experimental(),
            enabled: is_enabled,
        });
    }
    statuses
}
