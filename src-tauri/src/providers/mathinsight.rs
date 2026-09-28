use super::common::{self, CachedIndex, IndexEntry};
use super::{SearchContext, SearchOptions, SearchProvider};
use crate::error::{AppError, Result};
use crate::models::{NormalizedQuery, ResultType, SearchResult};
use async_trait::async_trait;
use scraper::{Html, Selector};
use std::collections::HashMap;
use std::sync::Mutex;
use url::Url;

const BASE: &str = "https://mathinsight.org/";
const PAGE_LIST: &str = "https://mathinsight.org/page/list";
const APPLET_LIST: &str = "https://mathinsight.org/applet/list";
const VIDEO_LIST: &str = "https://mathinsight.org/video/list";
const GENERAL_INDEX: &str = "https://mathinsight.org/index/general";

pub struct MathInsightProvider {
    index: Mutex<Option<CachedIndex>>,
}

impl MathInsightProvider {
    pub fn new() -> Self {
        Self {
            index: Mutex::new(None),
        }
    }

    async fn fetch(ctx: &SearchContext) -> Result<CachedIndex> {
        let (pages, applets, videos, general) = tokio::try_join!(
            fetch_text(ctx, PAGE_LIST),
            fetch_text(ctx, APPLET_LIST),
            fetch_text(ctx, VIDEO_LIST),
            fetch_text(ctx, GENERAL_INDEX),
        )?;

        let mut entries = Vec::new();
        entries.extend(parse_list(&pages, ResultType::Article)?);
        entries.extend(parse_list(&applets, ResultType::Applet)?);
        entries.extend(parse_list(&videos, ResultType::Video)?);

        // Enrich with title + description + term tags from the general index.
        let enriched = parse_general_index(&general)?;
        let mut known: HashMap<String, usize> = HashMap::new();
        for (i, e) in entries.iter().enumerate() {
            known.insert(e.url.clone(), i);
        }
        for (url, (title, desc, term)) in enriched {
            if let Some(i) = known.get(&url).copied() {
                if entries[i].description.is_none() {
                    entries[i].description = desc;
                }
                if !term.is_empty() && !entries[i].tags.iter().any(|t| t == &term) {
                    entries[i].tags.push(term);
                }
            } else if !title.is_empty() {
                entries.push(IndexEntry {
                    title,
                    description: desc,
                    url,
                    result_type: ResultType::Article,
                    tags: if term.is_empty() { vec![] } else { vec![term] },
                    thumbnail: None,
                });
            }
        }

        if entries.is_empty() {
            return Err(AppError::Parse(
                "mathinsight index contained no entries".into(),
            ));
        }
        Ok(CachedIndex::new(common::dedupe(entries)))
    }
}

async fn fetch_text(ctx: &SearchContext, url: &str) -> Result<String> {
    let resp = ctx.client.get(url).send().await?;
    if !resp.status().is_success() {
        return Err(AppError::Other(format!(
            "mathinsight returned {} for {url}",
            resp.status()
        )));
    }
    Ok(resp.text().await?)
}

fn is_nav(href: &str) -> bool {
    href == "#"
        || href.starts_with("#")
        || href.starts_with("/thread")
        || href.starts_with("/index/")
        || href.starts_with("/about/")
        || href.starts_with("/accounts")
        || href.starts_with("/search")
        || href.starts_with("/page/list")
        || href.starts_with("/applet/list")
        || href.starts_with("/video/list")
        || href.starts_with("/image/list")
        || href.is_empty()
}

fn parse_list(body: &str, default_type: ResultType) -> Result<Vec<IndexEntry>> {
    let base = Url::parse(BASE).unwrap();
    let doc = Html::parse_document(body);
    let sel = Selector::parse("a[href]").map_err(|e| AppError::Parse(e.to_string()))?;
    let mut out = Vec::new();

    for el in doc.select(&sel) {
        let Some(href) = el.value().attr("href") else {
            continue;
        };
        if is_nav(href) {
            continue;
        }
        let text = el.text().collect::<Vec<_>>().concat();
        let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
        if text.is_empty() {
            continue;
        }
        let Ok(url) = base.join(href) else { continue };

        let result_type = if href.starts_with("/applet/") {
            ResultType::Applet
        } else if href.starts_with("/video/") {
            ResultType::Video
        } else if default_type == ResultType::Applet {
            ResultType::Applet
        } else if default_type == ResultType::Video {
            ResultType::Video
        } else {
            ResultType::Article
        };

        let mut tags = common::title_words(&text);
        tags.extend(common::slug_words(href));
        tags.sort();
        tags.dedup();

        out.push(IndexEntry {
            title: text.clone(),
            description: None,
            url: url.to_string(),
            result_type,
            tags,
            thumbnail: None,
        });
    }
    Ok(out)
}

/// (url, (title, description, term)) tuples extracted from the general index.
type IndexEnrichment = (String, (String, Option<String>, String));

fn parse_general_index(body: &str) -> Result<Vec<IndexEnrichment>> {
    let base = Url::parse(BASE).unwrap();
    let doc = Html::parse_document(body);
    let sel = Selector::parse("span.indexentry, a.indexlink")
        .map_err(|e| AppError::Parse(e.to_string()))?;
    let mut current_term = String::new();
    let mut out = Vec::new();

    for el in doc.select(&sel) {
        if el.value().name() == "span" {
            current_term = el.text().collect::<Vec<_>>().concat().trim().to_string();
        } else {
            let Some(href) = el.value().attr("href") else {
                continue;
            };
            if is_nav(href) {
                continue;
            }
            let Ok(url) = base.join(href) else { continue };
            let title_attr = el.value().attr("title").unwrap_or("").trim().to_string();
            let (title, desc) = match title_attr.split_once(": ") {
                Some((t, d)) => (t.trim().to_string(), Some(d.trim().to_string())),
                None => (title_attr, None),
            };
            out.push((url.to_string(), (title, desc, current_term.clone())));
        }
    }
    Ok(out)
}

#[async_trait]
impl SearchProvider for MathInsightProvider {
    fn id(&self) -> &'static str {
        "mathinsight"
    }
    fn name(&self) -> &'static str {
        "Math Insight"
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

    async fn load_index(&self, ctx: &SearchContext) -> Result<Option<common::CachedIndex>> {
        Ok(Some(Self::fetch(ctx).await?))
    }

    async fn search(
        &self,
        ctx: &SearchContext,
        query: &NormalizedQuery,
        opts: &SearchOptions,
    ) -> Result<Vec<SearchResult>> {
        let need_fetch = {
            let lock = self
                .index
                .lock()
                .map_err(|_| AppError::Other("lock poisoned".into()))?;
            lock.as_ref()
                .map(|c| c.is_stale(common::STALE_AFTER_DAYS) || opts.force_refresh)
                .unwrap_or(true)
        };

        if need_fetch {
            match Self::fetch(ctx).await {
                Ok(fresh) => {
                    let mut lock = self
                        .index
                        .lock()
                        .map_err(|_| AppError::Other("lock poisoned".into()))?;
                    *lock = Some(fresh);
                }
                Err(e) => {
                    let lock = self
                        .index
                        .lock()
                        .map_err(|_| AppError::Other("lock poisoned".into()))?;
                    if lock.is_none() {
                        return Err(e);
                    }
                }
            }
        }

        let lock = self
            .index
            .lock()
            .map_err(|_| AppError::Other("lock poisoned".into()))?;
        let entries = lock.as_ref().map(|c| c.entries.as_slice()).unwrap_or(&[]);
        Ok(common::search_entries(
            self.id(),
            self.name(),
            entries,
            query,
        ))
    }
}

impl Default for MathInsightProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_page_list_fixture() {
        let fixture = include_str!("../../tests/fixtures/mathinsight-pagelist.html");
        let entries = parse_list(fixture, ResultType::Article).unwrap();
        assert!(!entries.is_empty());
        assert!(entries
            .iter()
            .all(|e| e.url.starts_with("https://mathinsight.org/")));
    }

    #[test]
    fn parses_general_index_fixture() {
        let fixture = include_str!("../../tests/fixtures/mathinsight-index.html");
        let out = parse_general_index(fixture).unwrap();
        assert!(!out.is_empty());
        assert!(out.iter().any(|(u, (t, d, _))| {
            u.contains("cross_product") && t.contains("cross product") && d.is_some()
        }));
    }
}
