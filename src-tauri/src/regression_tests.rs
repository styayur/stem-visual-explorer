use crate::{cache, database::Database, error::AppError, models::*, providers::*, search, util};
use std::sync::{Arc, Mutex};

fn entry(title: &str) -> common::IndexEntry {
    common::IndexEntry {
        title: title.into(),
        description: None,
        url: format!("https://example.com/{title}"),
        result_type: ResultType::Article,
        tags: vec![],
        thumbnail: None,
    }
}

#[test]
fn query_contract() {
    let q = search::normalize::expand(&search::query::parse("standing wave"));
    assert!(q.tokens.contains(&"驻波".into()));
    let q = search::normalize::expand(&search::query::parse("駐波"));
    assert!(q.tokens.contains(&"standing wave".into()));
    let q = search::normalize::expand(&search::query::parse("site:test curl"));
    let ranked = search::ranking::rank(
        &q,
        common::search_entries("test", "Test", &[entry("About curl"), entry("curl")], &q),
    );
    assert_eq!(ranked[0].title, "curl");
    assert!(ranked[0].score >= 100.0);
    let q = search::normalize::expand(&search::query::parse("site:test"));
    assert_eq!(
        common::search_entries("test", "Test", &[entry("curl")], &q).len(),
        1
    );
    let q = search::normalize::expand(&search::query::parse("\"standing   wave\""));
    assert_eq!(q.phrases, ["standing wave"]);
    assert_eq!(
        common::search_entries("test", "Test", &[entry("standing wave"), entry("wave")], &q).len(),
        1
    );
}

#[test]
fn unsafe_links_never_become_results() {
    for url in [
        "javascript:alert(1)",
        "file:///C:/test",
        "data:text/html,test",
        "sve://close",
    ] {
        assert!(util::validate_http_url(url).is_err());
        let mut unsafe_entry = entry("curl");
        unsafe_entry.url = url.into();
        let q = search::normalize::expand(&search::query::parse("curl"));
        assert!(common::search_entries("test", "Test", &[unsafe_entry], &q).is_empty());
    }
}

#[test]
fn history_is_unique_bounded_and_clearable() {
    let db = Database::open(std::path::Path::new(":memory:")).unwrap();
    for i in 0..205 {
        db.add_history(&format!("query {i}"), i, i as i64).unwrap();
    }
    db.add_history("query 204", 99, 206).unwrap();
    let history = db.list_history(500).unwrap();
    assert_eq!(history.len(), 200);
    assert_eq!(history[0].result_count, 99);
    assert_eq!(history.iter().filter(|h| h.query == "query 204").count(), 1);
    db.clear_history().unwrap();
    assert!(db.list_history(200).unwrap().is_empty());
}

#[test]
fn favorite_round_trip_and_partial_settings() {
    let db = Database::open(std::path::Path::new(":memory:")).unwrap();
    let result = common::to_result("test", "Test", &entry("curl"));
    db.add_favorite(result.clone(), 1).unwrap();
    db.add_favorite(result.clone(), 2).unwrap();
    assert_eq!(db.list_favorites().unwrap().len(), 1);
    db.remove_favorite(&result.id).unwrap();
    assert!(db.list_favorites().unwrap().is_empty());
    let settings: Settings = serde_json::from_str(r#"{"theme":"dark"}"#).unwrap();
    assert_eq!(settings.theme, "dark");
    assert_eq!(settings.enabled_providers.len(), 7);
}

struct Temp(std::path::PathBuf);
impl Temp {
    fn new() -> Self {
        Self(std::env::temp_dir().join(format!(
                "sve-test-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            )))
    }
}
impl Drop for Temp {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[tokio::test]
async fn cache_survives_restart_and_failed_refresh() {
    let dir = Temp::new();
    let ctx = SearchContext {
        client: http_client(),
        cache_dir: dir.0.clone(),
    };
    let memory = Mutex::new(None);
    common::cached_index(&ctx, "test", &memory, false, async {
        Ok(common::CachedIndex::new(vec![entry("curl")]))
    })
    .await
    .unwrap();
    *memory.lock().unwrap() = None;
    let cached = common::cached_index(&ctx, "test", &memory, false, async {
        panic!("fresh disk cache must avoid the network")
    })
    .await
    .unwrap();
    assert_eq!(cached.entries.len(), 1);
    memory.lock().unwrap().as_mut().unwrap().updated_at = "2000-01-01".into();
    let failed = || async { Err(AppError::Other("offline".into())) };
    assert!(common::cached_index(&ctx, "test", &memory, false, failed())
        .await
        .is_ok());
    assert!(common::cached_index(&ctx, "test", &memory, true, failed())
        .await
        .is_err());
    assert_eq!(cache::clear_all(&dir.0).unwrap(), 1);
    assert!(!cache::cache_path(&dir.0, "test").exists());
    *memory.lock().unwrap() = None;
    std::fs::write(cache::cache_path(&dir.0, "test"), "broken JSON").unwrap();
    assert!(common::cached_index(&ctx, "test", &memory, false, async {
        Ok(common::CachedIndex::new(vec![entry("gradient")]))
    })
    .await
    .is_ok());
}

struct Broken;

#[test]
fn failed_settings_write_keeps_previous_preferences() {
    let dir = Temp::new();
    let state = crate::state::AppState::load(&dir.0).unwrap();
    std::fs::create_dir(&state.settings_path).unwrap();
    assert!(state.update_settings(|s| s.theme = "dark".into()).is_err());
    assert_eq!(state.settings.lock().unwrap().theme, "system");
}

#[async_trait::async_trait]
impl SearchProvider for Broken {
    fn id(&self) -> &'static str {
        "broken"
    }
    fn name(&self) -> &'static str {
        "Broken"
    }
    fn homepage(&self) -> &'static str {
        "https://example.com"
    }
    async fn search(
        &self,
        _: &SearchContext,
        _: &NormalizedQuery,
        _: &SearchOptions,
    ) -> crate::error::Result<Vec<SearchResult>> {
        panic!("parser crashed")
    }
}

#[tokio::test]
async fn provider_panic_is_attributed_to_its_source() {
    let dir = Temp::new();
    let ctx = SearchContext {
        client: http_client(),
        cache_dir: dir.0.clone(),
    };
    let registry = ProviderRegistry::new().register(Arc::new(Broken));
    let result = search::manager::run_search(&ctx, &registry, "curl", &["broken".into()], false)
        .await
        .unwrap();
    let status = result.providers.iter().find(|p| p.id == "broken").unwrap();
    assert_eq!(status.state, ProviderState::Error);
    assert!(status.error.is_some());
}

#[test]
fn concept_dictionary_edges_and_aliases_are_valid() {
    let concepts = search::normalize::concepts();
    let ids: std::collections::BTreeSet<_> = concepts.iter().map(|c| c.id.as_str()).collect();
    assert_eq!(ids.len(), concepts.len());
    for c in concepts {
        assert!(!c.en.is_empty() && !c.zh_cn.is_empty() && !c.zh_tw.is_empty());
        for edge in c.related.iter().chain(&c.prerequisites) {
            assert!(ids.contains(edge.as_str()), "missing {edge}");
        }
    }
}

#[test]
fn concept_variants_have_weights_and_deduplicate() {
    let q = search::normalize::expand(&search::query::parse("旋度 curl rot"));
    assert_eq!(q.concept_ids, ["curl"]);
    let keys: std::collections::BTreeSet<_> = q
        .variants
        .iter()
        .map(|v| (&v.concept_id, &v.text))
        .collect();
    assert_eq!(keys.len(), q.variants.len());
    let q = search::normalize::expand(&search::query::parse("旋度"));
    for (text, weight) in [
        ("旋度", 1.0),
        ("curl", 0.95),
        ("rotation of a vector field", 0.9),
        ("rot", 0.75),
        ("divergence", 0.35),
    ] {
        assert_eq!(
            q.variants.iter().find(|v| v.text == text).unwrap().weight,
            weight
        );
    }
    assert!(!q.variants.iter().any(|v| v.text == "gradient")); // no recursive graph traversal
    assert!(!q.variants.iter().any(|v| v.text == "partial derivative")); // prerequisites are not synonyms
}

#[test]
fn weighted_ranking_prefers_direct_concepts_without_alias_inflation() {
    let q = search::normalize::expand(&search::query::parse("旋度"));
    for (title, expected) in [
        ("curl", 57.0),
        ("rotation of a vector field", 54.0),
        ("rot", 45.0),
        ("divergence", 10.5),
    ] {
        assert_eq!(
            search::ranking::score(&q, &common::to_result("test", "Test", &entry(title))),
            expected
        );
    }
    let one = common::to_result("test", "Test", &entry("curl"));
    let mut many = one.clone();
    many.title = "curl rot rotation of a vector field".into();
    assert_eq!(
        search::ranking::score(&q, &one),
        search::ranking::score(&q, &many)
    );
}

#[test]
fn longest_concept_and_exact_filters_survive_normalization() {
    let q = search::normalize::expand(&search::query::parse(
        "source:falstad type:applet partial derivative",
    ));
    assert_eq!(q.concept_ids, ["partial-derivative"]);
    assert_eq!(q.site_filter.as_deref(), Some("falstad"));
    assert_eq!(q.type_filter, Some(ResultType::Applet));
    let q = search::normalize::expand(&search::query::parse("\"standing wave\""));
    let matches = common::search_entries(
        "test",
        "Test",
        &[
            entry("standing wave"),
            entry("stationary wave"),
            entry("驻波"),
        ],
        &q,
    );
    assert_eq!(matches.len(), 1);
}

#[test]
fn all_providers_declare_conservative_preview_policy() {
    #[derive(serde::Deserialize)]
    struct Policy {
        id: String,
        capability: PreviewCapability,
        hosts: Vec<String>,
    }

    let registry = ProviderRegistry::new();
    let providers = registry.all();
    assert_eq!(providers.len(), 7);
    let ids: std::collections::BTreeSet<_> = providers.iter().map(|p| p.id()).collect();
    assert_eq!(ids.len(), providers.len(), "provider IDs must be unique");

    let policies: Vec<Policy> =
        serde_json::from_str(include_str!("../../src/lib/previewCapabilities.json"))
            .expect("preview policy JSON must deserialize");
    let policy_ids: std::collections::BTreeSet<_> =
        policies.iter().map(|p| p.id.as_str()).collect();
    assert_eq!(
        policy_ids.len(),
        policies.len(),
        "preview policy IDs must be unique"
    );

    for p in providers {
        let expected = match p.id() {
            "falstad" => PreviewCapability::Embed,
            "maotian" => PreviewCapability::ExternalOnly,
            _ => PreviewCapability::NativeCard,
        };
        assert_eq!(p.preview_capability(), expected);
        assert!(serde_json::to_string(&p.preview_capability()).is_ok());
        let policy = policies
            .iter()
            .find(|policy| policy.id == p.id())
            .unwrap_or_else(|| panic!("missing preview policy for provider {}", p.id()));
        assert!(
            !policy.hosts.is_empty(),
            "provider {} needs an explicit host policy",
            p.id()
        );
        assert_eq!(policy.capability, expected);
    }
    assert_eq!(preview_capability("unknown"), PreviewCapability::NativeCard);
}

#[test]
fn webviewer_labels_never_receive_application_ipc() {
    assert!(util::is_app_window("main"));
    assert!(util::is_app_window("workspace-12"));
    for label in ["browser-1", "workspace-", "workspace-evil", "main-1", ""] {
        assert!(!util::is_app_window(label));
    }
}
