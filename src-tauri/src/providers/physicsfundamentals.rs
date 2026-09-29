use super::common::{self, CachedIndex, IndexEntry};
use super::{SearchContext, SearchOptions, SearchProvider};
use crate::error::{AppError, Result};
use crate::models::{NormalizedQuery, ResultType, SearchResult};
use async_trait::async_trait;
use scraper::{Html, Selector};
use std::sync::Mutex;
use url::Url;

const BASE: &str = "https://physicsfundamentalsinfo.com/";
const LABS_URL: &str = "https://physicsfundamentalsinfo.com/labs/";

pub struct PhysicsFundamentalsProvider {
    index: Mutex<Option<CachedIndex>>,
}

impl PhysicsFundamentalsProvider {
    pub fn new() -> Self {
        Self {
            index: Mutex::new(None),
        }
    }

    async fn fetch(ctx: &SearchContext) -> Result<CachedIndex> {
        let body = ctx
            .client
            .get(LABS_URL)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;
        let entries = parse_labs(&body)?;
        if entries.is_empty() {
            return Err(AppError::Parse(
                "physicsfundamentals labs had no entries".into(),
            ));
        }
        Ok(CachedIndex::new(common::dedupe(entries)))
    }
}

#[async_trait]
impl SearchProvider for PhysicsFundamentalsProvider {
    fn id(&self) -> &'static str {
        "physicsfundamentals"
    }
    fn name(&self) -> &'static str {
        "Physics Fundamentals"
    }
    fn homepage(&self) -> &'static str {
        "https://physicsfundamentalsinfo.com/labs/"
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

fn parse_labs(body: &str) -> Result<Vec<IndexEntry>> {
    let base = Url::parse(BASE).unwrap();
    let doc = Html::parse_document(body);
    let sel = Selector::parse("a[href]").map_err(|e| AppError::Parse(e.to_string()))?;
    let mut out = Vec::new();

    for el in doc.select(&sel) {
        let Some(href) = el.value().attr("href") else {
            continue;
        };
        if !href.starts_with("/labs/") || href == "/labs/" {
            continue;
        }
        let slug = href.trim_start_matches("/labs/").trim_end_matches('/');
        if slug.is_empty() {
            continue;
        }
        let text = el.text().collect::<Vec<_>>().concat();
        let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
        let Ok(url) = base.join(href) else { continue };

        let title = common::slug_to_title(slug);
        let mut tags = common::slug_words(slug);
        tags.extend(common::title_words(&title));
        tags.sort();
        tags.dedup();

        out.push(IndexEntry {
            title,
            description: if text.is_empty() { None } else { Some(text) },
            url: url.to_string(),
            result_type: ResultType::Simulation,
            tags,
            thumbnail: None,
        });
    }
    Ok(out)
}

impl Default for PhysicsFundamentalsProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_labs_fixture() {
        let fixture = include_str!("../../tests/fixtures/physicsfundamentals-labs.html");
        let entries = parse_labs(fixture).unwrap();
        assert!(!entries.is_empty());
        assert!(entries.iter().any(|e| e.title.contains("Acceleration")));
        assert!(entries.iter().all(|e| e
            .url
            .starts_with("https://physicsfundamentalsinfo.com/labs/")));
    }
}
