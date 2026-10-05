use super::super::normalize::concepts;
use regex::Regex;
use serde::Deserialize;
use std::collections::{BTreeMap, BTreeSet};
use std::sync::OnceLock;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Structure {
    pub name: String,
    pub pattern: String,
    pub concept_ids: Vec<String>,
    pub kind: String,
}
#[derive(Deserialize)]
pub struct Rules {
    pub characters: BTreeMap<String, String>,
    pub scripts: BTreeMap<String, String>,
    pub scaffolds: Vec<String>,
    pub structures: Vec<Structure>,
}
pub fn rules() -> &'static Rules {
    static RULES: OnceLock<Rules> = OnceLock::new();
    RULES.get_or_init(|| {
        serde_json::from_str(include_str!("../../../../src/query/rules.json"))
            .expect("validated query rules")
    })
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Lexicon {
    pattern: String,
    concept_ids: Vec<String>,
    kind: String,
    confidence: f64,
    #[serde(default)]
    ambiguous: bool,
    #[serde(default)]
    requires_concept_ids: Vec<String>,
}
#[derive(Clone)]
pub struct Entry {
    pub text: String,
    pub ids: Vec<String>,
    pub kind: String,
    pub weight: i32,
    pub ambiguous: bool,
    pub requires: Vec<String>,
}
pub struct Index {
    pub initials: BTreeMap<char, Vec<Entry>>,
    pub typos: BTreeMap<usize, Vec<Entry>>,
}
pub fn index() -> &'static Index {
    static INDEX: OnceLock<Index> = OnceLock::new();
    INDEX.get_or_init(|| {
        let mut terms: BTreeMap<String, Vec<Entry>> = BTreeMap::new();
        let mut insert = |text: &str,
                          ids: Vec<String>,
                          kind: &str,
                          weight: i32,
                          ambiguous: bool,
                          requires: Vec<String>| {
            let text = super::normalize::query(text);
            if !text.is_empty() {
                terms.entry(text.clone()).or_default().push(Entry {
                    text,
                    ids,
                    kind: kind.into(),
                    weight,
                    ambiguous,
                    requires,
                });
            }
        };
        for c in concepts() {
            if let Some(topic) = c.en.strip_prefix("conservation of ") {
                insert(
                    &format!("{topic} conservation"),
                    vec![c.id.clone()],
                    "multi-token-composition",
                    88,
                    false,
                    vec![],
                );
            }
            for n in [&c.en, &c.zh_cn, &c.zh_tw, &c.id] {
                insert(n, vec![c.id.clone()], "canonical-label", 100, false, vec![]);
            }
            for n in &c.synonyms {
                insert(n, vec![c.id.clone()], "ontology-alias", 96, false, vec![]);
            }
            for a in c.aliases.iter().filter(|a| a.r#match != "exact") {
                insert(
                    &a.text,
                    vec![c.id.clone()],
                    "ontology-alias",
                    96,
                    false,
                    vec![],
                );
            }
        }
        let lex: Vec<Lexicon> =
            serde_json::from_str(include_str!("../../../../src/query/lexicon.json"))
                .expect("validated query lexicon");
        for e in lex {
            let kind = match e.kind.as_str() {
                "historical" => "historical-term",
                "abbreviation" => "abbreviation",
                _ => "query-lexicon",
            };
            let weight = if e.kind == "abbreviation" {
                86
            } else {
                (e.confidence * 92.0).round() as i32
            };
            insert(
                &e.pattern,
                e.concept_ids,
                kind,
                weight,
                e.ambiguous,
                e.requires_concept_ids,
            );
        }
        let mut initials: BTreeMap<char, Vec<Entry>> = BTreeMap::new();
        let mut typos: BTreeMap<usize, Vec<Entry>> = BTreeMap::new();
        for entries in terms.into_values() {
            let explicit = entries.iter().find(|e| e.ambiguous);
            let weight = explicit.map_or_else(
                || entries.iter().map(|e| e.weight).max().unwrap_or(0),
                |e| e.weight,
            );
            let chosen: Vec<_> = explicit.map_or_else(
                || entries.iter().filter(|e| e.weight == weight).collect(),
                |e| vec![e],
            );
            let mut entry = chosen[0].clone();
            entry.ids = chosen
                .iter()
                .flat_map(|e| e.ids.clone())
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect();
            entry.ambiguous = explicit.is_some() || entry.ids.len() > 1;
            if patterns().latin_phrase.is_match(&entry.text)
                && !entry.ambiguous
                && entry.kind != "abbreviation"
            {
                typos
                    .entry(entry.text.split_whitespace().count())
                    .or_default()
                    .push(entry.clone());
            }
            initials
                .entry(entry.text.chars().next().expect("nonempty term"))
                .or_default()
                .push(entry);
        }
        Index { initials, typos }
    })
}
pub struct Patterns {
    pub scaffolds: Vec<Regex>,
    pub structures: Vec<Regex>,
    pub latin_phrase: Regex,
    pub latin_token: Regex,
    pub punctuation: Regex,
    pub tokenizer: Regex,
}
pub fn patterns() -> &'static Patterns {
    static PATTERNS: OnceLock<Patterns> = OnceLock::new();
    PATTERNS.get_or_init(|| Patterns {
        scaffolds: rules()
            .scaffolds
            .iter()
            .map(|p| Regex::new(p).expect("reviewed scaffold"))
            .collect(),
        structures: rules()
            .structures
            .iter()
            .map(|p| Regex::new(&p.pattern).expect("reviewed structure"))
            .collect(),
        latin_phrase: Regex::new("^[a-z]+( [a-z]+)*$").expect("constant regex"),
        latin_token: Regex::new("[a-z]+").expect("constant regex"),
        punctuation: Regex::new("[\\s,;:?!.\"()]+").expect("constant regex"),
        tokenizer: Regex::new("[a-z0-9]+([-'][a-z0-9]+)*|[\\x{3400}-\\x{9fff}]+|[^\\s]")
            .expect("constant regex"),
    })
}
