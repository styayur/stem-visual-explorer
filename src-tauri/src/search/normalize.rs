use crate::models::{NormalizedQuery, ParsedQuery, QueryVariant};
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::OnceLock;

#[derive(Debug, Deserialize)]
pub struct Concept {
    pub id: String,
    pub en: String,
    pub zh_cn: String,
    pub zh_tw: String,
    pub synonyms: Vec<String>,
    pub aliases: Vec<String>,
    pub related: Vec<String>,
    pub prerequisites: Vec<String>,
}

pub fn concepts() -> &'static [Concept] {
    static DATA: OnceLock<Vec<Concept>> = OnceLock::new();
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!("../../../src/lib/concepts.json"))
            .expect("valid STEM concept dictionary")
    })
}
fn term(s: &str) -> String {
    s.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
fn lookup(s: &str) -> Option<&'static Concept> {
    let s = term(s);
    concepts().iter().find(|c| {
        [&c.id, &c.en, &c.zh_cn, &c.zh_tw]
            .into_iter()
            .chain(c.synonyms.iter())
            .chain(c.aliases.iter())
            .any(|n| term(n) == s)
    })
}
fn add(
    out: &mut BTreeMap<(String, String), QueryVariant>,
    text: &str,
    id: Option<&str>,
    kind: &str,
    weight: f32,
) {
    let text = term(text);
    if text.is_empty() {
        return;
    }
    let key = (id.unwrap_or_default().to_string(), text.clone());
    if out.get(&key).map_or(true, |v| v.weight < weight) {
        out.insert(
            key,
            QueryVariant {
                text,
                concept_id: id.map(str::to_string),
                kind: kind.into(),
                weight,
            },
        );
    }
}

/// Offline, longest-match concept normalization. Expansion stops after one related edge.
pub fn expand(parsed: &ParsedQuery) -> NormalizedQuery {
    let mut out = BTreeMap::new();
    let mut ids = BTreeSet::new();
    let mut originals = Vec::new();
    let max_words = concepts()
        .iter()
        .flat_map(|c| {
            [&c.id, &c.en, &c.zh_cn, &c.zh_tw]
                .into_iter()
                .chain(c.synonyms.iter())
                .chain(c.aliases.iter())
        })
        .map(|n| n.split_whitespace().count())
        .max()
        .unwrap_or(1);
    let mut start = 0;
    while start < parsed.terms.len() {
        let mut size = max_words.min(parsed.terms.len() - start);
        while size > 1 && lookup(&parsed.terms[start..start + size].join(" ")).is_none() {
            size -= 1;
        }
        originals.push(parsed.terms[start..start + size].join(" "));
        start += size;
    }
    originals.extend(parsed.phrases.clone());
    for original in originals {
        let c = lookup(&original);
        if let Some(c) = c {
            ids.insert(c.id.clone());
        }
        add(
            &mut out,
            &original,
            c.map(|c| c.id.as_str()),
            "original",
            1.0,
        );
    }
    for id in &ids {
        let c = concepts().iter().find(|c| &c.id == id).unwrap();
        for n in [&c.en, &c.zh_cn, &c.zh_tw] {
            add(&mut out, n, Some(id), "canonical", 0.95);
        }
        for n in &c.synonyms {
            add(&mut out, n, Some(id), "synonym", 0.9);
        }
        for n in &c.aliases {
            add(&mut out, n, Some(id), "alternate", 0.75);
        }
        for related in &c.related {
            if ids.contains(related) {
                continue;
            }
            let c = concepts()
                .iter()
                .find(|c| &c.id == related)
                .expect("valid concept edge");
            for n in [&c.en, &c.zh_cn, &c.zh_tw] {
                add(&mut out, n, Some(related), "related", 0.35);
            }
        }
    }
    let variants: Vec<_> = out.into_values().collect();
    let mut tokens = BTreeSet::new();
    for v in &variants {
        tokens.insert(v.text.clone());
        tokens.extend(v.text.split_whitespace().map(str::to_string));
    }
    NormalizedQuery {
        raw: parsed.raw.clone(),
        tokens: tokens.into_iter().collect(),
        variants,
        concept_ids: ids.into_iter().collect(),
        phrases: parsed.phrases.clone(),
        site_filter: parsed.site_filter.clone(),
        type_filter: parsed.type_filter,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn expand_terms(terms: &[&str]) -> Vec<String> {
        let parsed = ParsedQuery {
            raw: terms.join(" "),
            terms: terms.iter().map(|s| s.to_string()).collect(),
            phrases: vec![],
            site_filter: None,
            type_filter: None,
        };
        expand(&parsed).tokens
    }

    #[test]
    fn expands_chinese_gradient() {
        let t = expand_terms(&["梯度"]);
        assert!(t.iter().any(|x| x == "gradient"));
        assert!(t.iter().any(|x| x == "梯度"));
    }

    #[test]
    fn expands_chinese_curl() {
        let t = expand_terms(&["旋度"]);
        assert!(t.iter().any(|x| x == "curl"));
    }

    #[test]
    fn expands_standing_wave() {
        let t = expand_terms(&["驻波"]);
        assert!(t.iter().any(|x| x == "standing"));
        assert!(t.iter().any(|x| x == "wave"));
    }

    #[test]
    fn english_term_is_kept() {
        let t = expand_terms(&["curl"]);
        assert!(t.contains(&"curl".to_string()));
    }

    #[test]
    fn mixed_query_expands_both() {
        let t = expand_terms(&["旋度", "curl"]);
        assert!(t.contains(&"旋度".to_string()));
        assert!(t.contains(&"curl".to_string()));
    }
}
