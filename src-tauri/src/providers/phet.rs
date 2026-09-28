use super::common::{self, CachedIndex, IndexEntry};
use super::{SearchContext, SearchOptions, SearchProvider};
use crate::error::{AppError, Result};
use crate::models::{NormalizedQuery, ResultType, SearchResult};
use async_trait::async_trait;
use serde::Deserialize;
use std::sync::Mutex;

const INDEX_URL: &str =
    "https://phet.colorado.edu/services/metadata/1.0/simulations?format=json&locale=en&type=html";

pub struct PhetProvider {
    index: Mutex<Option<CachedIndex>>,
}

impl PhetProvider {
    pub fn new() -> Self {
        Self {
            index: Mutex::new(None),
        }
    }

    async fn fetch(ctx: &SearchContext) -> Result<CachedIndex> {
        let body = ctx.client.get(INDEX_URL).send().await?.text().await?;
        let data: Metadata = serde_json::from_str(&body)?;
        let mut entries = Vec::new();
        for project in data.projects {
            for sim in project.simulations {
                if let Some(entry) = sim.to_entry() {
                    entries.push(entry);
                }
            }
        }
        if entries.is_empty() {
            return Err(AppError::Parse(
                "phet metadata contained no simulations".into(),
            ));
        }
        Ok(CachedIndex::new(common::dedupe(entries)))
    }
}

#[async_trait]
impl SearchProvider for PhetProvider {
    fn id(&self) -> &'static str {
        "phet"
    }
    fn name(&self) -> &'static str {
        "PhET"
    }
    fn homepage(&self) -> &'static str {
        "https://phet.colorado.edu/"
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

#[derive(Debug, Deserialize)]
struct Metadata {
    projects: Vec<Project>,
}

#[derive(Debug, Deserialize)]
struct Project {
    simulations: Vec<Simulation>,
}

#[derive(Debug, Deserialize)]
struct Simulation {
    name: Option<String>,
    #[serde(rename = "simPageUrl")]
    sim_page_url: Option<String>,
    description: Option<Localized>,
    #[serde(rename = "thumbnailUrl")]
    thumbnail_url: Option<String>,
    #[serde(rename = "localizedSimulations")]
    localized_simulations: Vec<LocalizedSim>,
}

#[derive(Debug, Deserialize)]
struct Localized {
    en: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LocalizedSim {
    locale: Option<String>,
    title: Option<String>,
    #[serde(rename = "runUrl")]
    run_url: Option<String>,
}

impl Simulation {
    fn to_entry(&self) -> Option<IndexEntry> {
        let english = self
            .localized_simulations
            .iter()
            .find(|s| s.locale.as_deref() == Some("en"))
            .or(self.localized_simulations.first());

        let title = english
            .and_then(|s| s.title.clone())
            .or_else(|| self.name.clone().map(|n| common::slug_to_title(&n)))?;

        let url = self
            .sim_page_url
            .clone()
            .or_else(|| english.and_then(|s| s.run_url.clone()))
            .unwrap_or_else(|| {
                format!(
                    "https://phet.colorado.edu/en/simulations/{}",
                    self.name.clone().unwrap_or_default()
                )
            });

        let description = self
            .description
            .as_ref()
            .and_then(|d| d.en.clone())
            .map(|d| d.split_whitespace().collect::<Vec<_>>().join(" "));

        let mut tags = common::title_words(&title);
        if let Some(name) = &self.name {
            tags.extend(common::slug_words(name));
        }
        tags.sort();
        tags.dedup();

        Some(IndexEntry {
            title,
            description,
            url,
            result_type: ResultType::Simulation,
            tags,
            thumbnail: self.thumbnail_url.clone(),
        })
    }
}

impl Default for PhetProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_metadata_fixture() {
        let fixture = include_str!("../../tests/fixtures/phet-metadata.json");
        let data: Metadata = serde_json::from_str(fixture).unwrap();
        let entries: Vec<IndexEntry> = data
            .projects
            .into_iter()
            .flat_map(|p| p.simulations.into_iter().filter_map(|s| s.to_entry()))
            .collect();
        assert!(!entries.is_empty());
        assert!(entries
            .iter()
            .any(|e| e.title.contains("Acid-Base Solutions")));
        assert!(entries
            .iter()
            .all(|e| e.result_type == ResultType::Simulation));
    }
}
