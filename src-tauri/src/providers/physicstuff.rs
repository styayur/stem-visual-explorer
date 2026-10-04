use super::common::{self, CachedIndex, IndexEntry};
use super::{SearchContext, SearchOptions, SearchProvider};
use crate::error::{AppError, Result};
use crate::models::{NormalizedQuery, ResultType, SearchResult};
use async_trait::async_trait;
use scraper::{Html, Selector};
use std::sync::Mutex;
use url::Url;

const BASE: &str = "https://physicstuff.com/";
const LAB_URL: &str = "https://physicstuff.com/lab";

pub struct PhysicStuffProvider {
    index: Mutex<Option<CachedIndex>>,
}

impl PhysicStuffProvider {
    pub fn new() -> Self {
        Self {
            index: Mutex::new(None),
        }
    }

    async fn fetch(ctx: &SearchContext) -> Result<CachedIndex> {
        let body = ctx
            .client
            .get(LAB_URL)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;
        let entries = parse_lab(&body)?;
        if entries.is_empty() {
            return Err(AppError::Parse("physicstuff lab had no entries".into()));
        }
        Ok(CachedIndex::new(common::dedupe(entries)))
    }
}

#[async_trait]
impl SearchProvider for PhysicStuffProvider {
    fn id(&self) -> &'static str {
        "physicstuff"
    }
    fn name(&self) -> &'static str {
        "PhysicStuff"
    }
    fn homepage(&self) -> &'static str {
        "https://physicstuff.com/lab"
    }

    fn experimental(&self) -> bool {
        true
    }

    fn indexed_items(&self) -> Option<usize> {
        self.index
            .lock()
            .ok()
            .and_then(|i| i.as_ref().map(|c| c.entries.len()))
    }
    fn last_updated(&self) -> Option<String> {
        self.index
            .lock()
            .ok()
            .and_then(|i| i.as_ref().map(|c| c.updated_at.clone()))
    }

    fn clear_index(&self) {
        if let Ok(mut index) = self.index.lock() {
            *index = None;
        }
    }

    async fn load_index(&self, ctx: &SearchContext) -> Result<Option<common::CachedIndex>> {
        Ok(Some(Self::fetch(ctx).await?))
    }

    async fn search(
        &self,
        ctx: &SearchContext,
        query: &NormalizedQuery,
        opts: &SearchOptions,
    ) -> Result<Vec<SearchResult>> {
        let index = common::cached_index(
            ctx,
            self.id(),
            &self.index,
            opts.force_refresh,
            Self::fetch(ctx),
        )
        .await?;
        Ok(common::search_entries(
            self.id(),
            self.name(),
            &index.entries,
            query,
        ))
    }
}

const NAV_PATHS: &[&str] = &[
    "/lab",
    "/concepts",
    "/about",
    "/contact",
    "/privacy-policy",
    "/terms",
];

fn parse_lab(body: &str) -> Result<Vec<IndexEntry>> {
    let base = Url::parse(BASE).unwrap();
    let doc = Html::parse_document(body);
    let sel = Selector::parse("a[href]").map_err(|e| AppError::Parse(e.to_string()))?;
    let mut out = Vec::new();

    for el in doc.select(&sel) {
        let Some(href) = el.value().attr("href") else {
            continue;
        };
        if !href.starts_with('/') {
            continue;
        }
        let path = href.trim_end_matches('/');
        let segments: Vec<&str> = path.trim_start_matches('/').split('/').collect();
        if segments.len() != 2 {
            continue;
        }
        if NAV_PATHS.contains(&path) {
            continue;
        }
        let category = segments[0];
        let slug = segments[1];
        if category.is_empty() || slug.is_empty() {
            continue;
        }
        let text = el.text().collect::<Vec<_>>().concat();
        let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
        let Ok(url) = base.join(href) else { continue };

        let title = common::slug_to_title(slug);
        let mut tags = vec![common::slug_to_title(category)];
        tags.extend(common::slug_words(slug));
        tags.extend(common::title_words(&title));
        tags.sort();
        tags.dedup();

        out.push(IndexEntry {
            semantic: Default::default(),
            title,
            description: if text.is_empty() { None } else { Some(text) },
            url: url.to_string(),
            result_type: ResultType::Interactive,
            tags,
            thumbnail: None,
        });
    }
    Ok(out)
}

impl Default for PhysicStuffProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_lab_fixture() {
        let fixture = include_str!("../../tests/fixtures/physicstuff-lab.html");
        let entries = parse_lab(fixture).unwrap();
        assert!(!entries.is_empty());
        assert!(entries
            .iter()
            .any(|e| e.title.contains("Simple Harmonic Motion")));
        assert!(entries
            .iter()
            .all(|e| e.url.starts_with("https://physicstuff.com/")));
    }
}
