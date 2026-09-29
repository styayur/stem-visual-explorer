use super::common::{self, CachedIndex, IndexEntry};
use super::{SearchContext, SearchOptions, SearchProvider};
use crate::error::{AppError, Result};
use crate::models::{NormalizedQuery, ResultType, SearchResult};
use async_trait::async_trait;
use scraper::{Html, Selector};
use std::collections::HashSet;
use std::sync::Mutex;
use url::Url;

const BASE: &str = "https://betterexplained.com/";
const SEARCH_URL: &str = "https://betterexplained.com/";
const ARCHIVE_URL: &str = "https://betterexplained.com/articles/";

pub struct BetterExplainedProvider {
    index: Mutex<Option<CachedIndex>>,
}

impl BetterExplainedProvider {
    pub fn new() -> Self {
        Self {
            index: Mutex::new(None),
        }
    }

    async fn fetch_archive(ctx: &SearchContext) -> Result<CachedIndex> {
        let body = ctx
            .client
            .get(ARCHIVE_URL)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;
        let entries = parse_archive(&body)?;
        if entries.is_empty() {
            return Err(AppError::Parse(
                "betterexplained archive had no entries".into(),
            ));
        }
        Ok(CachedIndex::new(common::dedupe(entries)))
    }

    async fn native_search(ctx: &SearchContext, raw: &str) -> Result<Vec<IndexEntry>> {
        let resp = ctx
            .client
            .get(SEARCH_URL)
            .query(&[("s", raw)])
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(AppError::Other(format!(
                "betterexplained returned {}",
                resp.status()
            )));
        }
        let body = resp.text().await?;
        Ok(parse_native_results(&body))
    }
}

#[async_trait]
impl SearchProvider for BetterExplainedProvider {
    fn id(&self) -> &'static str {
        "betterexplained"
    }
    fn name(&self) -> &'static str {
        "BetterExplained"
    }
    fn homepage(&self) -> &'static str {
        BASE
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
        Ok(Some(Self::fetch_archive(ctx).await?))
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
            Self::fetch_archive(ctx),
        )
        .await;
        if opts.force_refresh {
            index.as_ref().map_err(|e| AppError::Other(e.to_string()))?;
        }
        let mut results = index
            .as_ref()
            .map(|c| common::search_entries(self.id(), self.name(), &c.entries, query))
            .unwrap_or_default();
        let parsed = crate::search::query::parse(&query.raw);
        let native_query = parsed
            .terms
            .iter()
            .chain(parsed.phrases.iter())
            .cloned()
            .collect::<Vec<_>>()
            .join(" ");
        if !native_query.is_empty() {
            let native = tokio::time::timeout(
                std::time::Duration::from_secs(5),
                Self::native_search(ctx, &native_query),
            )
            .await;
            match native {
                Ok(Ok(entries)) => results.extend(common::search_entries(
                    self.id(),
                    self.name(),
                    &entries,
                    query,
                )),
                _ if index.is_err() => {
                    return Err(AppError::Other(
                        "BetterExplained archive and native search are unavailable".into(),
                    ))
                }
                _ => {}
            }
        } else {
            index?;
        }

        // Deduplicate by URL, preserving first occurrence.
        let mut seen: HashSet<String> = HashSet::new();
        results.retain(|r| seen.insert(r.url.clone()));
        Ok(results)
    }
}

fn result_type_for(title: &str) -> ResultType {
    let lower = title.to_lowercase();
    if lower.contains("interactive") || lower.contains("visual") {
        ResultType::Interactive
    } else {
        ResultType::Article
    }
}

fn parse_native_results(body: &str) -> Vec<IndexEntry> {
    let doc = Html::parse_document(body);
    let mut out = Vec::new();
    if let Ok(sel) = Selector::parse("a[rel=\"bookmark\"]") {
        for el in doc.select(&sel) {
            if let Some(href) = el.value().attr("href") {
                if !href.contains("/articles/") {
                    continue;
                }
                let title = el.text().collect::<Vec<_>>().concat();
                let title = title.split_whitespace().collect::<Vec<_>>().join(" ");
                if !title.is_empty() {
                    out.push(IndexEntry {
                        title: title.clone(),
                        description: None,
                        url: href.to_string(),
                        result_type: result_type_for(&title),
                        tags: common::title_words(&title),
                        thumbnail: None,
                    });
                }
            }
        }
    }
    out
}

fn parse_archive(body: &str) -> Result<Vec<IndexEntry>> {
    let doc = Html::parse_document(body);
    let sel = Selector::parse("a.egs-series-item-title, a.egs-posts-item-title")
        .map_err(|e| AppError::Parse(e.to_string()))?;
    let mut current_series = String::new();
    let mut out = Vec::new();

    for el in doc.select(&sel) {
        let Some(href) = el.value().attr("href") else {
            continue;
        };
        let is_series = el.value().classes().any(|c| c == "egs-series-item-title");
        let title = el
            .value()
            .attr("title")
            .map(str::to_string)
            .unwrap_or_default();
        let text = el.text().collect::<Vec<_>>().concat();
        let text = text.split_whitespace().collect::<Vec<_>>().join(" ");

        if is_series {
            current_series = text;
            continue;
        }

        if !href.contains("/articles/") || text.is_empty() {
            continue;
        }

        let mut tags = vec![current_series.clone()];
        tags.extend(common::title_words(&text));
        tags.retain(|t| !t.is_empty());
        tags.sort();
        tags.dedup();

        let final_title = if text.is_empty() { title } else { text };
        let result_type = result_type_for(&final_title);

        out.push(IndexEntry {
            title: final_title,
            description: None,
            url: Url::parse(href)
                .map(|u| u.to_string())
                .unwrap_or_else(|_| href.to_string()),
            result_type,
            tags,
            thumbnail: None,
        });
    }
    Ok(out)
}

impl Default for BetterExplainedProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_archive_fixture() {
        let fixture = include_str!("../../tests/fixtures/betterexplained-articles.html");
        let entries = parse_archive(fixture).unwrap();
        assert!(!entries.is_empty());
        assert!(entries
            .iter()
            .any(|e| e.title.contains("Fourier Transform")));
        assert!(entries.iter().all(|e| e.url.contains("/articles/")));
    }

    #[test]
    fn parses_native_results_fixture() {
        let fixture = include_str!("../../tests/fixtures/betterexplained-search.html");
        let entries = parse_native_results(fixture);
        assert!(!entries.is_empty());
        assert!(entries.iter().any(|e| e.title.contains("Curl")));
    }
}
