use crate::models::{ConceptGroup, NormalizedQuery, ParsedQuery, QueryVariant};
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::OnceLock;

#[derive(Debug, Deserialize)]
pub struct Alias {
    pub text: String,
    pub r#match: String,
}
#[derive(Debug, Deserialize)]
pub struct Concept {
    pub id: String,
    pub en: String,
    pub zh_cn: String,
    pub zh_tw: String,
    pub synonyms: Vec<String>,
    pub aliases: Vec<Alias>,
    pub subject: String,
    pub level: Vec<String>,
    pub related: Vec<String>,
    pub prerequisites: Vec<String>,
}
pub fn concepts() -> &'static [Concept] {
    static DATA: OnceLock<Vec<Concept>> = OnceLock::new();
    DATA.get_or_init(|| {
        serde_json::from_str(include_str!("../../../src/lib/concepts.json"))
            .expect("validated ontology")
    })
}
pub fn term(s: &str) -> String {
    s.replace(['’', '‘'], "'")
        .replace(['‐', '‑', '–', '—'], "-")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
pub fn mode(s: &str) -> &'static str {
    if s.chars()
        .any(|c| ('\u{3040}'..='\u{30ff}').contains(&c) || ('\u{3400}'..='\u{9fff}').contains(&c))
    {
        "cjk-substring"
    } else if term(s).contains(' ') {
        "phrase"
    } else if s.len() == 1 && s.as_bytes()[0].is_ascii_alphabetic() {
        "exact"
    } else {
        "token"
    }
}
pub fn matches(text: &str, needle: &str, mode: &str) -> bool {
    let text = term(text);
    let needle = term(needle);
    if needle.is_empty() {
        return false;
    }
    if mode == "exact" {
        return text == needle;
    }
    if mode == "cjk-substring" {
        return text.contains(&needle);
    }
    let word = |c: char| c.is_alphanumeric() || c == '_';
    text.match_indices(&needle).any(|(at, _)| {
        !text[..at].chars().next_back().is_some_and(word)
            && !text[at + needle.len()..].chars().next().is_some_and(word)
    })
}
pub fn names(c: &Concept) -> Vec<&str> {
    [&c.en, &c.zh_cn, &c.zh_tw]
        .into_iter()
        .chain(&c.synonyms)
        .map(String::as_str)
        .collect()
}
fn lookup(s: &str) -> Option<&'static Concept> {
    static LOOKUP: OnceLock<BTreeMap<String, &'static Concept>> = OnceLock::new();
    LOOKUP
        .get_or_init(|| {
            let mut out = BTreeMap::new();
            for c in concepts() {
                for n in std::iter::once(c.id.as_str()).chain(names(c)).chain(
                    c.aliases
                        .iter()
                        .filter(|a| a.r#match != "exact")
                        .map(|a| a.text.as_str()),
                ) {
                    let key = term(n);
                    if !out.contains_key(&key)
                        || [&c.en, &c.zh_cn, &c.zh_tw].iter().any(|v| v.as_str() == n)
                    {
                        out.insert(key, c);
                    }
                }
            }
            out
        })
        .get(&term(s))
        .copied()
}
fn add(
    out: &mut BTreeMap<(String, String), QueryVariant>,
    text: &str,
    id: Option<&str>,
    kind: &str,
    weight: f64,
    matching: &str,
) {
    let text = term(text);
    if text.is_empty() {
        return;
    }
    let key = (id.unwrap_or_default().to_string(), text.clone());
    if out.get(&key).map_or(true, |v| v.weight < weight) {
        let tier = match kind {
            "related" | "prerequisite" => "exploratory",
            "synonym" | "alternate" => "equivalent",
            _ => "direct",
        };
        out.insert(
            key,
            QueryVariant {
                text,
                concept_id: id.map(str::to_string),
                kind: kind.into(),
                weight,
                tier: tier.into(),
                r#match: matching.into(),
            },
        );
    }
}
pub fn expand(parsed: &ParsedQuery) -> NormalizedQuery {
    let mut out = BTreeMap::new();
    let mut ids = BTreeSet::new();
    let mut originals = Vec::new();
    let terms: Vec<_> = parsed
        .terms
        .iter()
        .filter(|t| t.to_lowercase() != "related:true")
        .cloned()
        .collect();
    let max_words = concepts()
        .iter()
        .flat_map(|c| {
            std::iter::once(c.id.as_str()).chain(names(c)).chain(
                c.aliases
                    .iter()
                    .filter(|a| a.r#match != "exact")
                    .map(|a| a.text.as_str()),
            )
        })
        .map(|n| n.split_whitespace().count())
        .max()
        .unwrap_or(1);
    let mut start = 0;
    while start < terms.len() {
        let mut size = max_words.min(terms.len() - start);
        while size > 1 && lookup(&terms[start..start + size].join(" ")).is_none() {
            size -= 1;
        }
        originals.push(terms[start..start + size].join(" "));
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
            mode(&original),
        );
    }
    for id in &ids {
        let c = concepts()
            .iter()
            .find(|c| &c.id == id)
            .expect("Resolved IDs originate from this immutable validated ontology");
        for n in [&c.en, &c.zh_cn, &c.zh_tw] {
            add(&mut out, n, Some(id), "canonical", 0.95, mode(n));
        }
        for n in &c.synonyms {
            add(&mut out, n, Some(id), "synonym", 0.9, mode(n));
        }
        for a in c.aliases.iter().filter(|a| a.r#match != "exact") {
            add(&mut out, &a.text, Some(id), "alternate", 0.75, &a.r#match);
        }
        for (kind, edges) in [("related", &c.related), ("prerequisite", &c.prerequisites)] {
            for edge in edges {
                if ids.contains(edge) {
                    continue;
                }
                let target = concepts()
                    .iter()
                    .find(|c| &c.id == edge)
                    .expect("validated edge");
                for n in [&target.en, &target.zh_cn, &target.zh_tw] {
                    add(&mut out, n, Some(edge), kind, 0.35, mode(n));
                }
            }
        }
    }
    let variants: Vec<_> = out.into_values().collect();
    let mut groups: BTreeMap<String, ConceptGroup> = BTreeMap::new();
    let mut tokens = BTreeSet::new();
    for v in &variants {
        tokens.insert(v.text.clone());
        tokens.extend(v.text.split_whitespace().map(str::to_string));
        if v.tier != "exploratory" {
            let id = v.concept_id.clone().unwrap_or_else(|| v.text.clone());
            groups
                .entry(id.clone())
                .or_insert_with(|| ConceptGroup {
                    id,
                    concept_id: v.concept_id.clone(),
                    variants: vec![],
                })
                .variants
                .push(v.clone());
        }
    }
    NormalizedQuery {
        raw: parsed.raw.clone(),
        tokens: tokens.into_iter().collect(),
        variants,
        concept_ids: ids.into_iter().collect(),
        groups: groups.into_values().collect(),
        explore: parsed
            .terms
            .iter()
            .any(|t| t.to_lowercase() == "related:true"),
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
