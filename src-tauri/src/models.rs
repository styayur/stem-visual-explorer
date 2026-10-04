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
    #[serde(flatten)]
    pub semantic: SemanticMetadata,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explanation: Option<SearchExplanation>,
    pub id: String,
    pub source_id: String,
    pub source_name: String,
    pub title: String,
    pub description: Option<String>,
    pub url: String,
    pub result_type: ResultType,
    pub tags: Vec<String>,
    pub score: f64,
    pub thumbnail: Option<String>,
}

/// Conservative provider policy; absent/unknown declarations never imply iframe support.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum PreviewCapability {
    Embed,
    #[default]
    NativeCard,
    ExternalOnly,
}

#[derive(Debug, Clone)]
pub struct WorkspacePayload {
    pub urls: Vec<String>,
    pub resources: Vec<SearchResult>,
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
    #[serde(default)]
    pub preview_capability: PreviewCapability,
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
    #[serde(default)]
    pub preview_capability: PreviewCapability,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryVariant {
    pub tier: String,
    pub r#match: String,
    pub text: String,
    pub concept_id: Option<String>,
    pub kind: String,
    pub weight: f64,
}

/// A normalized query after synonym expansion.
#[derive(Debug, Clone)]
pub struct NormalizedQuery {
    pub groups: Vec<ConceptGroup>,
    pub explore: bool,
    pub raw: String,
    pub tokens: Vec<String>,
    pub variants: Vec<QueryVariant>,
    pub concept_ids: Vec<String>,
    pub phrases: Vec<String>,
    pub site_filter: Option<String>,
    pub type_filter: Option<ResultType>,
}

impl NormalizedQuery {
    pub fn is_empty(&self) -> bool {
        self.tokens.is_empty()
            && self.phrases.is_empty()
            && self.site_filter.is_none()
            && self.type_filter.is_none()
    }
}

/// The full response handed to the frontend for one search.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub unfiltered_total: usize,
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
#[serde(default)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConceptGroup {
    pub id: String,
    pub concept_id: Option<String>,
    pub variants: Vec<QueryVariant>,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SemanticMetadata {
    #[serde(default)]
    pub concept_ids: Vec<String>,
    #[serde(default)]
    pub concept_evidence: std::collections::BTreeMap<String, Vec<String>>,
    #[serde(default)]
    pub subject: Vec<String>,
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub description_source: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchEvidence {
    pub concept_id: Option<String>,
    pub group: String,
    pub field: String,
    pub tier: String,
    pub text: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchExplanation {
    pub matched: Vec<MatchEvidence>,
    pub matched_concept_ids: Vec<String>,
    pub match_tier: String,
    pub groups_matched: usize,
    pub groups_total: usize,
    pub score_components: std::collections::BTreeMap<String, f64>,
}
