use crate::models::{NormalizedQuery, ResultType, SearchResult};
use serde::{Deserialize, Serialize};

pub const CACHE_VERSION: u32 = 1;
/// How many days before a cached index is considered stale and refreshed in
/// the background. Stale caches remain searchable.
pub const STALE_AFTER_DAYS: i64 = 7;

/// One row in a locally-indexed provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexEntry {
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
    pub fn new(entries: Vec<IndexEntry>) -> Self {
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

fn normalize_ws(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
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
        let hay = normalize_ws(&format!(
            "{} {} {} {}",
            entry.title,
            entry.tags.join(" "),
            entry.description.clone().unwrap_or_default(),
            entry.url
        ))
        .to_lowercase();

        let phrases_ok = query.phrases.iter().all(|p| hay.contains(p.as_str()));
        if !phrases_ok {
            continue;
        }

        let token_ok =
            query.tokens.is_empty() || query.tokens.iter().any(|t| hay.contains(t.as_str()));
        if token_ok {
            out.push(to_result(source_id, source_name, entry));
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
