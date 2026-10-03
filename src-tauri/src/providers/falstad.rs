use super::common::{self, CachedIndex, IndexEntry};
use super::{SearchContext, SearchOptions, SearchProvider};
use crate::error::{AppError, Result};
use crate::models::{NormalizedQuery, ResultType, SearchResult};
use async_trait::async_trait;
use scraper::{Html, Selector};
use std::sync::Mutex;
use url::Url;

const BASE: &str = "https://falstad.com/";
const INDEX_URL: &str = "https://falstad.com/mathphysics.html";

pub struct FalstadProvider {
    index: Mutex<Option<CachedIndex>>,
}

impl FalstadProvider {
    pub fn new() -> Self {
        Self {
            index: Mutex::new(None),
        }
    }

    async fn fetch(ctx: &SearchContext) -> Result<CachedIndex> {
        let body = ctx
            .client
            .get(INDEX_URL)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;
        let entries = parse_index(&body)?;
        if entries.is_empty() {
            return Err(AppError::Parse("falstad index contained no entries".into()));
        }
        Ok(CachedIndex::new(common::dedupe(entries)))
    }
}

#[async_trait]
impl SearchProvider for FalstadProvider {
    fn id(&self) -> &'static str {
        "falstad"
    }
    fn name(&self) -> &'static str {
        "Falstad"
    }
    fn homepage(&self) -> &'static str {
        "https://falstad.com/mathphysics.html"
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

fn parse_index(body: &str) -> Result<Vec<IndexEntry>> {
    let base = Url::parse(BASE).unwrap();
    let doc = Html::parse_document(body);
    let sel = Selector::parse("h1,h2,h3,h4,a").map_err(|e| AppError::Parse(e.to_string()))?;
    let mut current_category = String::from("General");
    let mut out = Vec::new();

    for el in doc.select(&sel) {
        let name = el.value().name();
        if name == "a" {
            let Some(href) = el.value().attr("href") else {
                continue;
            };
            if href.is_empty() || href.starts_with('#') || href.starts_with("javascript:") {
                continue;
            }
            let text = el.text().collect::<Vec<_>>().concat();
            let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
            if text.is_empty() || text.len() < 3 {
                continue;
            }
            let Ok(url) = base.join(href) else { continue };
            let url = url.to_string();
            let mut tags = common::title_words(&text);
            tags.push(current_category.to_lowercase());
            tags.sort();
            tags.dedup();

            let (description, description_source) =
                common::listing_description(el, &text, &current_category);
            out.push(IndexEntry {
                semantic: crate::models::SemanticMetadata {
                    description_source,
                    ..Default::default()
                },
                title: text.clone(),
                description,
                url,
                result_type: ResultType::Applet,
                tags,
                thumbnail: None,
            });
        } else {
            let text = el.text().collect::<Vec<_>>().concat();
            let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
            if !text.is_empty() {
                current_category = text;
            }
        }
    }

    Ok(out)
}

impl Default for FalstadProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../tests/fixtures/falstad-index.html");

    #[test]
    fn parses_fixture() {
        let entries = parse_index(FIXTURE).unwrap();
        assert!(!entries.is_empty());
        assert!(entries.iter().any(|e| e.title.contains("Fourier Series")));
        assert!(entries.iter().any(|e| e.title.contains("Ripple Tank")));
        assert!(entries
            .iter()
            .all(|e| e.url.starts_with("https://falstad.com/")));
        // Every applet carries at least one tag.
        assert!(entries.iter().all(|e| !e.tags.is_empty()));
    }
}
