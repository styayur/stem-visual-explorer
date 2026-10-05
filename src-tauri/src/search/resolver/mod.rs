//! Offline Resolver v2. Static data is shared with the TypeScript implementation.
mod candidates;
mod data;
pub mod normalize;
#[cfg(test)]
mod tests;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Evidence {
    pub kind: String,
    pub input: String,
    pub matched: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub concept_id: String,
    pub score: i32,
    pub evidence: Vec<Evidence>,
    pub matched_terms: Vec<String>,
    pub penalties: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub input: String,
    pub concept_ids: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Resolution {
    pub normalized_query: String,
    pub groups: Vec<Group>,
    pub concept_ids: Vec<String>,
    pub candidates: Vec<Candidate>,
    pub status: String,
    pub confidence: f64,
    pub explanation: Vec<Evidence>,
    pub residual_terms: Vec<String>,
    pub reason: String,
}
impl Resolution {
    fn empty(reason: &str) -> Self {
        Self {
            normalized_query: String::new(),
            groups: vec![],
            concept_ids: vec![],
            candidates: vec![],
            status: "unknown".into(),
            confidence: 0.0,
            explanation: vec![],
            residual_terms: vec![],
            reason: reason.into(),
        }
    }
}
pub fn resolve(raw: &str) -> Resolution {
    if raw.encode_utf16().count() > 512 {
        return Resolution::empty("input-bound");
    }
    let text = normalize::query(raw);
    if text.is_empty() {
        return Resolution::empty("empty");
    }
    let mut depth = 0;
    for c in text.chars() {
        if c == '(' {
            depth += 1;
        }
        if c == ')' {
            depth -= 1;
        }
        if !(0..=32).contains(&depth) {
            let mut r = Resolution::empty("malformed-structure");
            r.normalized_query = text;
            return r;
        }
    }
    if depth != 0 {
        let mut r = Resolution::empty("malformed-structure");
        r.normalized_query = text;
        return r;
    }
    let mut spans = candidates::generate(&text);
    spans.sort_by(|a, b| {
        text[b.start..b.end]
            .chars()
            .count()
            .cmp(&text[a.start..a.end].chars().count())
            .then(b.weight.cmp(&a.weight))
            .then(a.start.cmp(&b.start))
            .then(a.ids.cmp(&b.ids))
    });
    let mut selected: Vec<candidates::Span> = vec![];
    for s in &spans {
        if selected.iter().any(|x| s.start < x.end && s.end > x.start) {
            continue;
        }
        let close: Vec<_> = spans
            .iter()
            .filter(|x| {
                x.start == s.start && x.end == s.end && x.ids != s.ids && s.weight - x.weight < 8
            })
            .collect();
        let mut next = s.clone();
        next.ambiguous |= !close.is_empty();
        next.ids = std::iter::once(s)
            .chain(close)
            .flat_map(|x| x.ids.clone())
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect();
        selected.push(next);
    }
    selected.sort_by_key(|s| s.start);
    let mut remainder = text.clone();
    for s in selected.iter().rev() {
        remainder.replace_range(s.start..s.end, &" ".repeat(s.end - s.start));
    }
    remainder = normalize::strip(&remainder);
    remainder = data::patterns()
        .punctuation
        .replace_all(&remainder, " ")
        .trim()
        .into();
    let penalty = if remainder.chars().any(|c| c.is_alphanumeric()) {
        45
    } else {
        0
    };
    let script = raw
        .chars()
        .any(|c| data::rules().scripts.contains_key(&c.to_string()));
    let mut by_id: BTreeMap<String, Candidate> = BTreeMap::new();
    for s in &selected {
        for id in &s.ids {
            let score = s.weight - penalty - if s.ambiguous { 10 } else { 0 };
            let c = by_id.entry(id.clone()).or_insert_with(|| Candidate {
                concept_id: id.clone(),
                score,
                evidence: vec![],
                matched_terms: vec![],
                penalties: vec![],
            });
            c.score = c.score.max(score);
            c.evidence.extend(s.evidence.clone());
            if script {
                c.evidence.push(Evidence {
                    kind: "script-normalization".into(),
                    input: raw.into(),
                    matched: text.clone(),
                });
            }
            c.matched_terms.push(text[s.start..s.end].into());
            c.penalties = vec![];
            if penalty > 0 {
                c.penalties.push("unexplained-content".into());
            }
            if s.ambiguous {
                c.penalties.push("competing-meaning".into());
            }
        }
    }
    let mut ranked: Vec<_> = by_id.into_values().collect();
    ranked.sort_by(|a, b| b.score.cmp(&a.score).then(a.concept_id.cmp(&b.concept_id)));
    let strong: Vec<_> = ranked.iter().filter(|c| c.score >= 70).collect();
    let ambiguous = !strong.is_empty() && selected.iter().any(|s| s.ambiguous);
    let ids: BTreeSet<String> = if ambiguous {
        BTreeSet::new()
    } else {
        strong.iter().map(|c| c.concept_id.clone()).collect()
    };
    let groups = if ambiguous {
        vec![]
    } else {
        selected
            .iter()
            .filter(|s| s.ids.iter().any(|id| ids.contains(id)))
            .map(|s| Group {
                input: text[s.start..s.end].into(),
                concept_ids: s
                    .ids
                    .iter()
                    .filter(|id| ids.contains(*id))
                    .cloned()
                    .collect(),
            })
            .collect()
    };
    let status = if ambiguous {
        "ambiguous"
    } else if ids.is_empty() {
        "unknown"
    } else {
        "resolved"
    };
    let confidence = if status == "resolved" {
        f64::from(strong.iter().map(|c| c.score).min().unwrap_or(0)) / 100.0
    } else {
        0.0
    };
    let residual_terms = if status == "resolved" {
        normalize::tokens(&remainder)
    } else {
        text.split_whitespace().map(str::to_string).collect()
    };
    let reason = if ambiguous {
        "competing-meaning"
    } else if status == "unknown" {
        if penalty > 0 {
            "unexplained-content"
        } else {
            "insufficient-evidence"
        }
    } else {
        "sufficient-evidence"
    };
    Resolution {
        normalized_query: text,
        groups,
        concept_ids: ids.into_iter().collect(),
        explanation: ranked.iter().flat_map(|c| c.evidence.clone()).collect(),
        candidates: ranked,
        status: status.into(),
        confidence,
        residual_terms,
        reason: reason.into(),
    }
}
