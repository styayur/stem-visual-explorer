pub mod betterexplained;
pub mod common;
pub mod falstad;
pub mod maotian;
pub mod mathinsight;
pub mod phet;
pub mod physicsfundamentals;
pub mod physicstuff;

use crate::error::Result;
use crate::models::{NormalizedQuery, SearchResult};
use async_trait::async_trait;
use std::path::PathBuf;
use std::sync::Arc;

pub use betterexplained::BetterExplainedProvider;
pub use falstad::FalstadProvider;
pub use maotian::MaotianProvider;
pub use mathinsight::MathInsightProvider;
pub use phet::PhetProvider;
pub use physicsfundamentals::PhysicsFundamentalsProvider;
pub use physicstuff::PhysicStuffProvider;

/// Shared context handed to every provider during a search.
#[derive(Clone)]
pub struct SearchContext {
    pub client: reqwest::Client,
    pub cache_dir: PathBuf,
}

/// Per-search options.
#[derive(Clone, Copy, Default)]
pub struct SearchOptions {
    pub force_refresh: bool,
}

/// The provider abstraction. Each supported website is an independent
/// implementation of this trait; the frontend has no per-site logic.
#[async_trait]
pub trait SearchProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    fn homepage(&self) -> &'static str;

    /// True when the source cannot be parsed reliably yet.
    fn experimental(&self) -> bool {
        false
    }

    /// Number of locally indexed items, when the provider maintains an index.
    fn indexed_items(&self) -> Option<usize> {
        None
    }

    /// ISO date of the last successful local index refresh.
    fn last_updated(&self) -> Option<String> {
        None
    }

    async fn search(
        &self,
        ctx: &SearchContext,
        query: &NormalizedQuery,
        opts: &SearchOptions,
    ) -> Result<Vec<SearchResult>>;
}

/// Central registry. Adding a new provider is a single `.register(...)` call.
pub struct ProviderRegistry {
    providers: Vec<Arc<dyn SearchProvider>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: Vec::new(),
        }
        .register(Arc::new(MathInsightProvider::new()))
        .register(Arc::new(FalstadProvider::new()))
        .register(Arc::new(PhetProvider::new()))
        .register(Arc::new(BetterExplainedProvider::new()))
        .register(Arc::new(PhysicsFundamentalsProvider::new()))
        .register(Arc::new(PhysicStuffProvider::new()))
        .register(Arc::new(MaotianProvider::new()))
    }

    pub fn register(mut self, provider: Arc<dyn SearchProvider>) -> Self {
        self.providers.push(provider);
        self
    }

    pub fn all(&self) -> &[Arc<dyn SearchProvider>] {
        &self.providers
    }

    pub fn get(&self, id: &str) -> Option<Arc<dyn SearchProvider>> {
        self.providers.iter().find(|p| p.id() == id).cloned()
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Build a shared HTTP client with a project User-Agent and sane timeouts.
pub fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(format!(
            "STEMVisualExplorer/{} (+https://github.com/styayur/stem-visual-explorer)",
            env!("CARGO_PKG_VERSION")
        ))
        .timeout(std::time::Duration::from_secs(20))
        .connect_timeout(std::time::Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .expect("failed to build HTTP client")
}
