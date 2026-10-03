use super::common::{self, CachedIndex, IndexEntry};
use super::{SearchContext, SearchOptions, SearchProvider};
use crate::error::{AppError, Result};
use crate::models::{NormalizedQuery, ResultType, SearchResult};
use async_trait::async_trait;
use scraper::{Html, Selector};
use std::sync::Mutex;
use url::Url;

const BASE: &str = "https://maotian.nomaki.jp/";
const INDEX_URL: &str = "https://maotian.nomaki.jp/";

pub struct MaotianProvider {
    index: Mutex<Option<CachedIndex>>,
}

impl MaotianProvider {
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
        let entries = parse_home(&body)?;
        if entries.is_empty() {
            return Err(AppError::Parse("maotian homepage had no entries".into()));
        }
        Ok(CachedIndex::new(common::dedupe(entries)))
    }
}

#[async_trait]
impl SearchProvider for MaotianProvider {
    fn id(&self) -> &'static str {
        "maotian"
    }
    fn name(&self) -> &'static str {
        "猫田の物理"
    }
    fn homepage(&self) -> &'static str {
        BASE
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

fn parse_home(body: &str) -> Result<Vec<IndexEntry>> {
    let base = Url::parse(BASE).unwrap();
    let doc = Html::parse_document(body);
    let sel = Selector::parse("a[href]").map_err(|e| AppError::Parse(e.to_string()))?;
    let mut out = Vec::new();

    for el in doc.select(&sel) {
        let Some(href) = el.value().attr("href") else {
            continue;
        };
        if href.is_empty()
            || href == "index.html"
            || href == "links.html"
            || href.starts_with('#')
            || href.starts_with("http")
            || href.starts_with("javascript:")
        {
            continue;
        }
        let text = el.text().collect::<Vec<_>>().concat();
        let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
        if text.is_empty() {
            continue;
        }
        let Ok(url) = base.join(href) else { continue };
        if url.host_str() != Some("maotian.nomaki.jp") {
            continue;
        }

        let path_part = href.split('#').next().unwrap_or(href).trim_end_matches('/');
        let mut tags = common::slug_words(path_part);
        tags.retain(|t| !t.is_empty() && t != "indexhtml");
        // Preserve complete CamelCase taxonomy phrases before sorting individual tags.
        if let Some(section) = path_part.split('/').next() {
            let words = common::slug_words(section);
            if words.len() > 1 {
                tags.push(words.join(" "));
            }
        }
        tags.sort();
        tags.dedup();

        let category = tags
            .iter()
            .filter(|t| t.contains(' '))
            .cloned()
            .collect::<Vec<_>>()
            .join(" · ");
        let (description, description_source) = common::listing_description(el, &text, &category);
        out.push(IndexEntry {
            semantic: crate::models::SemanticMetadata {
                description_source,
                ..Default::default()
            },
            title: text.clone(),
            description,
            url: url.to_string(),
            result_type: ResultType::Visualization,
            tags,
            thumbnail: None,
        });
    }
    Ok(out)
}

impl Default for MaotianProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_home_fixture() {
        let fixture = include_str!("../../tests/fixtures/maotian-home.html");
        let entries = parse_home(fixture).unwrap();
        assert!(!entries.is_empty());
        assert!(entries.iter().any(|e| e.title.contains("単振動")));
        assert!(entries
            .iter()
            .all(|e| e.url.starts_with("https://maotian.nomaki.jp/")));
    }
}
