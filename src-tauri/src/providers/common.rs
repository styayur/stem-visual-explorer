use super::SearchContext;
use crate::cache;
use crate::error::{AppError, Result};
use crate::models::{NormalizedQuery, ResultType, SearchResult};
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::sync::Mutex;

pub const CACHE_VERSION: u32 = 2;
/// How many days before a cached index is considered stale and refreshed in
/// the background. Stale caches remain searchable.
pub const STALE_AFTER_DAYS: i64 = 7;

/// Load the durable cache first. Failed automatic refreshes retain usable data;
/// explicit refreshes report their failure so the settings UI cannot claim success.
pub async fn cached_index<F>(
    ctx: &SearchContext,
    id: &str,
    memory: &Mutex<Option<CachedIndex>>,
    force: bool,
    fetch: F,
) -> Result<CachedIndex>
where
    F: Future<Output = Result<CachedIndex>>,
{
    let path = cache::cache_path(&ctx.cache_dir, id);
    let cached = {
        let mut lock = memory
            .lock()
            .map_err(|_| AppError::Other("lock poisoned".into()))?;
        if lock.is_none() {
            *lock = cache::read_json::<CachedIndex>(&path)
                .ok()
                .flatten()
                .filter(|c| c.version == CACHE_VERSION && !c.entries.is_empty());
        }
        lock.clone()
    };
    if !force {
        if let Some(c) = &cached {
            if !c.is_stale(STALE_AFTER_DAYS) {
                return Ok(c.clone());
            }
        }
    }
    let outcome = tokio::time::timeout(std::time::Duration::from_secs(8), fetch)
        .await
        .unwrap_or_else(|_| Err(AppError::Other(format!("{id} index refresh timed out"))));
    let outcome = outcome.and_then(|fresh| {
        validate_index(id, &fresh, cached.as_ref())?;
        Ok(fresh)
    });
    match outcome {
        Ok(fresh) => {
            if fresh.entries.is_empty() {
                return Err(AppError::Parse(format!("{id} index is empty")));
            }
            *memory
                .lock()
                .map_err(|_| AppError::Other("lock poisoned".into()))? = Some(fresh.clone());
            if let Err(e) = cache::write_json(&path, &fresh) {
                log::warn!("Cannot persist {id} index: {e}");
            }
            Ok(fresh)
        }
        Err(error) => {
            if !force {
                if let Some(c) = cached {
                    return Ok(c);
                }
            }
            Err(error)
        }
    }
}

/// One row in a locally-indexed provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexEntry {
    #[serde(flatten)]
    pub semantic: crate::models::SemanticMetadata,
    pub title: String,
    pub description: Option<String>,
    pub url: String,
    pub result_type: ResultType,
    pub tags: Vec<String>,
    pub thumbnail: Option<String>,
}

/// A cached, parsed index for a single provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedIndex {
    pub version: u32,
    pub updated_at: String,
    pub entries: Vec<IndexEntry>,
}

impl CachedIndex {
    pub fn new(mut entries: Vec<IndexEntry>) -> Self {
        for entry in &mut entries {
            let source = entry.semantic.description_source.clone();
            entry.semantic = annotate(entry);
            entry.semantic.description_source = source;
        }
        Self {
            version: CACHE_VERSION,
            updated_at: today_iso(),
            entries,
        }
    }

    pub fn is_stale(&self, days: i64) -> bool {
        match chrono::NaiveDate::parse_from_str(&self.updated_at, "%Y-%m-%d") {
            Ok(updated) => {
                let age = chrono::Utc::now().date_naive() - updated;
                age.num_days() >= days
            }
            Err(_) => true,
        }
    }
}

pub fn today_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}

/// Build a unified `SearchResult` from a local index entry.
pub fn to_result(source_id: &str, source_name: &str, entry: &IndexEntry) -> SearchResult {
    SearchResult {
        id: format!("{source_id}::{}", entry.url),
        source_id: source_id.to_string(),
        source_name: source_name.to_string(),
        title: entry.title.clone(),
        description: entry.description.clone(),
        url: entry.url.clone(),
        result_type: entry.result_type,
        tags: entry.tags.clone(),
        score: 0.0,
        thumbnail: entry.thumbnail.clone(),
        semantic: entry.semantic.clone(),
        explanation: None,
    }
}

/// Local full-text candidate matching. Returns entries whose title, tags,
/// description or URL matches every exact phrase and at least one token.
pub fn search_entries(
    source_id: &str,
    source_name: &str,
    entries: &[IndexEntry],
    query: &NormalizedQuery,
) -> Vec<SearchResult> {
    if query.is_empty() {
        return Vec::new();
    }

    let mut out = Vec::new();
    for entry in entries {
        if crate::util::validate_http_url(&entry.url).is_err() {
            continue;
        }
        if query.site_filter.as_ref().is_some_and(|s| s != source_id)
            || query.type_filter.is_some_and(|t| t != entry.result_type)
        {
            continue;
        }
        if !query.phrases.iter().all(|p| {
            std::iter::once(&entry.title)
                .chain(&entry.tags)
                .chain(entry.description.iter())
                .any(|s| crate::search::normalize::matches(s, p, crate::search::normalize::mode(p)))
        }) {
            continue;
        }
        let mut result = to_result(source_id, source_name, entry);
        let explanation = crate::search::ranking::explain(query, &result);
        if ["all-groups", "browse"].contains(&explanation.match_tier.as_str())
            || (query.explore && explanation.matched.iter().any(|m| m.tier == "exploratory"))
        {
            result.explanation = Some(explanation);
            out.push(result);
        }
    }
    out
}

/// Deduplicate entries by URL, keeping the first occurrence.
pub fn dedupe(entries: Vec<IndexEntry>) -> Vec<IndexEntry> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::with_capacity(entries.len());
    for e in entries {
        if seen.insert(e.url.clone()) {
            out.push(e);
        }
    }
    out
}
/// Convert a kebab-case URL slug into a readable title.
pub fn slug_to_title(slug: &str) -> String {
    let cleaned = slug.replace(['-', '_'], " ");
    let mut out = String::new();
    let mut cap_next = true;
    for ch in cleaned.chars() {
        if ch.is_whitespace() {
            if !out.ends_with(' ') {
                out.push(' ');
            }
            cap_next = true;
        } else if cap_next {
            out.push(ch.to_ascii_uppercase());
            cap_next = false;
        } else {
            out.push(ch);
        }
    }
    out.trim().to_string()
}

/// Split a camel/pascal/url slug into lowercase searchable word tokens.
pub fn slug_words(slug: &str) -> Vec<String> {
    let mut words: Vec<String> = Vec::new();
    let mut current = String::new();
    for ch in slug.chars() {
        if ch.is_ascii_uppercase() && !current.is_empty() {
            words.push(current.to_lowercase());
            current.clear();
            current.push(ch.to_ascii_lowercase());
        } else if ch == '-' || ch == '_' || ch == '/' || ch == '#' {
            if !current.is_empty() {
                words.push(current.to_lowercase());
                current.clear();
            }
        } else if ch.is_ascii_alphanumeric() {
            current.push(ch.to_ascii_lowercase());
        }
    }
    if !current.is_empty() {
        words.push(current.to_lowercase());
    }
    words.retain(|w| {
        w.len() >= 2
            && !matches!(
                w.as_str(),
                "index" | "html" | "htm" | "www" | "com" | "org" | "net" | "lab"
            )
    });
    words
}

/// Keep a small, meaningful set of tag words from a title.
pub fn title_words(title: &str) -> Vec<String> {
    let stop: &[&str] = &[
        "the",
        "and",
        "for",
        "with",
        "from",
        "into",
        "your",
        "how",
        "what",
        "why",
        "a",
        "an",
        "of",
        "to",
        "in",
        "on",
        "using",
        "introduction",
        "interactive",
        "applet",
        "simulator",
        "lab",
        "calculator",
        "simulation",
    ];
    let mut out = Vec::new();
    for w in title
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|w| !w.is_empty())
    {
        let lw = w.to_lowercase();
        if lw.len() >= 3 && !stop.contains(&lw.as_str()) {
            out.push(lw);
        }
    }
    out
}

pub fn annotate(entry: &IndexEntry) -> crate::models::SemanticMetadata {
    use crate::search::normalize::{concepts, matches, mode, names};
    let mut meta = crate::models::SemanticMetadata::default();
    let mut subjects = std::collections::BTreeSet::new();
    for c in concepts() {
        let mut fields = Vec::new();
        let contains = |s: &str| {
            names(c).iter().any(|n| matches(s, n, mode(n)))
                || c.aliases
                    .iter()
                    .filter(|a| a.r#match != "exact")
                    .any(|a| matches(s, &a.text, &a.r#match))
        };
        if contains(&entry.title) {
            fields.push("title".into());
        }
        if entry.tags.iter().any(|s| contains(s)) {
            fields.push("tags".into());
        }
        if entry.description.as_ref().is_some_and(|s| contains(s)) {
            fields.push("description".into());
        }
        if !fields.is_empty() {
            meta.concept_evidence.insert(c.id.clone(), fields);
            subjects.insert(c.subject.clone());
        }
    }
    meta.concept_ids = meta.concept_evidence.keys().cloned().collect();
    meta.subject = subjects.into_iter().collect();
    meta.language = if entry.url.starts_with("https://maotian.nomaki.jp/") || entry
        .title
        .chars()
        .any(|c| ('\u{3040}'..='\u{30ff}').contains(&c))
    {
        "ja"
    } else if entry
        .title
        .chars()
        .any(|c| ('\u{3400}'..='\u{9fff}').contains(&c))
    {
        "zh"
    } else {
        "en"
    }
    .into();
    meta
}

/// Bounded adjacent text is safe listing metadata; never concatenate a whole page.
pub fn listing_description(
    el: scraper::ElementRef<'_>,
    title: &str,
    category: &str,
) -> (Option<String>, Option<String>) {
    let adjacent = el
        .next_siblings()
        .take_while(|n| n.value().is_text())
        .filter_map(|n| n.value().as_text())
        .map(|t| t.text.as_ref())
        .collect::<Vec<_>>()
        .join(" ");
    let text = adjacent.split_whitespace().collect::<Vec<_>>().join(" ");
    if text.chars().count() >= 20 && text.chars().count() <= 600 {
        return (Some(text), Some("listing-adjacent-text".into()));
    }
    if let Some(value) = el
        .value()
        .attr("title")
        .filter(|v| *v != title && v.chars().count() >= 20)
    {
        return (
            Some(value.chars().take(600).collect()),
            Some("title-attribute".into()),
        );
    }
    let description = if category.is_empty() {
        title.to_string()
    } else {
        format!("{title} — {category}")
    };
    (
        Some(description),
        Some("title-and-provider-category".into()),
    )
}
/// Fail closed before replacing usable data. Callers may retain old caches on automatic refresh failures.
pub fn validate_index(id: &str, fresh: &CachedIndex, previous: Option<&CachedIndex>) -> Result<()> {
    let n = fresh.entries.len();
    if n == 0 {
        return Err(AppError::Parse(format!("{id}: empty index")));
    }
    let ratio = |count: usize| count as f64 / n as f64;
    if ratio(
        fresh
            .entries
            .iter()
            .filter(|e| crate::util::validate_http_url(&e.url).is_err())
            .count(),
    ) > 0.05
    {
        return Err(AppError::Parse(format!("{id}: invalid URL ratio >5%")));
    }
    if ratio(
        fresh
            .entries
            .iter()
            .filter(|e| e.title.trim().is_empty())
            .count(),
    ) > 0.05
    {
        return Err(AppError::Parse(format!("{id}: missing title ratio >5%")));
    }
    let unique = fresh
        .entries
        .iter()
        .map(|e| &e.url)
        .collect::<std::collections::HashSet<_>>()
        .len();
    if ratio(n - unique) > 0.05 {
        return Err(AppError::Parse(format!("{id}: duplicate URL ratio >5%")));
    }
    if let Some(old) = previous {
        if n * 10 < old.entries.len() * 7 {
            return Err(AppError::Parse(format!(
                "{id}: count drop exceeds 30% ({} -> {n})",
                old.entries.len()
            )));
        }
        let covered = |c: &CachedIndex| {
            c.entries
                .iter()
                .filter(|e| !e.semantic.concept_ids.is_empty())
                .count() as f64
                / c.entries.len().max(1) as f64
        };
        if covered(old) > 0.1 && covered(fresh) < covered(old) * 0.7 {
            return Err(AppError::Parse(format!("{id}: semantic coverage collapse")));
        }
    }
    Ok(())
}
