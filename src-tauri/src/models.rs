use serde::{Deserialize, Serialize};

/// The kind of content a search result points to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResultType {
    Article,
    Interactive,
    Simulation,
    Applet,
    Experiment,
    Visualization,
    Video,
    Unknown,
}

/// A unified search result produced by every provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub source_id: String,
    pub source_name: String,
    pub title: String,
    pub description: Option<String>,
    pub url: String,
    pub result_type: ResultType,
    pub tags: Vec<String>,
    pub score: f32,
    pub thumbnail: Option<String>,
}

/// Lifecycle state of a provider during a search.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderState {
    Idle,
    Loading,
    Done,
    Error,
}

/// Per-provider status returned to the UI after a search.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStatus {
    pub id: String,
    pub name: String,
    pub homepage: String,
    pub state: ProviderState,
    pub count: usize,
    pub error: Option<String>,
    pub indexed_items: Option<usize>,
    pub last_updated: Option<String>,
    pub experimental: bool,
    pub enabled: bool,
}

/// Provider metadata for the sources panel.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub homepage: String,
    pub experimental: bool,
    pub indexed_items: Option<usize>,
    pub last_updated: Option<String>,
    pub enabled: bool,
}

/// A parsed user query before normalization.
#[derive(Debug, Clone, Default)]
pub struct ParsedQuery {
    pub raw: String,
    pub terms: Vec<String>,
    pub phrases: Vec<String>,
    pub site_filter: Option<String>,
    pub type_filter: Option<ResultType>,
}

/// A normalized query after synonym expansion.
#[derive(Debug, Clone)]
pub struct NormalizedQuery {
    pub raw: String,
    pub tokens: Vec<String>,
    pub phrases: Vec<String>,
    pub site_filter: Option<String>,
    pub type_filter: Option<ResultType>,
}

impl NormalizedQuery {
    pub fn is_empty(&self) -> bool {
        self.tokens.is_empty() && self.phrases.is_empty()
    }
}

/// The full response handed to the frontend for one search.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub query: String,
    pub expanded_terms: Vec<String>,
    pub results: Vec<SearchResult>,
    pub providers: Vec<ProviderStatus>,
    pub total: usize,
}

/// A saved favorite.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Favorite {
    pub result: SearchResult,
    pub created_at: i64,
}

/// A search history entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: i64,
    pub query: String,
    pub result_count: usize,
    pub created_at: i64,
}

/// User preferences persisted as JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    pub preview_mode: String,
    pub enabled_providers: Vec<String>,
    pub mock_mode: bool,
    /// UI language: "en" | "zh-CN" | "zh-TW".
    #[serde(default = "default_ui_locale")]
    pub ui_locale: String,
    /// Translation target language for content/pages (e.g. "zh-CN", "ja").
    #[serde(default = "default_translate_target")]
    pub translate_target: String,
    /// Translate search result titles/descriptions in the UI.
    #[serde(default)]
    pub translate_results: bool,
    /// Optional user-supplied page-translation proxy template. Supports the
    /// `{url}` and `{lang}` placeholders, e.g.
    /// `https://my-proxy.example/?url={url}&lang={lang}`.
    #[serde(default)]
    pub page_translate_proxy: String,
}

fn default_ui_locale() -> String {
    "en".to_string()
}

fn default_translate_target() -> String {
    "zh-CN".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            preview_mode: "side".to_string(),
            enabled_providers: vec![
                "mathinsight".into(),
                "falstad".into(),
                "phet".into(),
                "betterexplained".into(),
                "physicsfundamentals".into(),
                "physicstuff".into(),
                "maotian".into(),
            ],
            mock_mode: false,
            ui_locale: default_ui_locale(),
            translate_target: default_translate_target(),
            translate_results: false,
            page_translate_proxy: String::new(),
        }
    }
}
