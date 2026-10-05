use super::{data, Evidence};
#[derive(Clone)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    pub ids: Vec<String>,
    pub weight: i32,
    pub evidence: Vec<Evidence>,
    pub ambiguous: bool,
    pub requires: Vec<String>,
}
fn word(c: Option<char>) -> bool {
    c.is_some_and(|c| c.is_alphanumeric() || c == '_')
}
pub fn generate(text: &str) -> Vec<Span> {
    let compact: String = text
        .chars()
        .filter(|c| !c.is_whitespace())
        .map(|c| if c == '*' { '×' } else { c })
        .collect();
    let mut structural = vec![];
    for (p, regex) in data::rules()
        .structures
        .iter()
        .zip(&data::patterns().structures)
    {
        if regex.is_match(&compact) {
            structural.push(Span {
                start: 0,
                end: text.len(),
                ids: p.concept_ids.clone(),
                weight: if p.kind == "formula-pattern" { 90 } else { 88 },
                evidence: vec![Evidence {
                    kind: p.kind.clone(),
                    input: text.into(),
                    matched: p.name.clone(),
                }],
                ambiguous: false,
                requires: vec![],
            });
        }
    }
    if !structural.is_empty() {
        return structural;
    }
    let mut spans: Vec<Span> = vec![];
    for (start, first) in text.char_indices() {
        for e in data::index().initials.get(&first).into_iter().flatten() {
            if !text[start..].starts_with(&e.text) {
                continue;
            }
            let end = start + e.text.len();
            if e.text.chars().count() == 1
                && (word(text[..start].chars().next_back()) || word(text[end..].chars().next()))
            {
                continue;
            }
            let cjk = e
                .text
                .chars()
                .any(|c| ('\u{3400}'..='\u{9fff}').contains(&c));
            let boundary_word = |c: Option<char>| {
                word(c)
                    && !(e.kind == "abbreviation"
                        && c.is_some_and(|c| ('\u{3400}'..='\u{9fff}').contains(&c)))
            };
            if !cjk
                && (boundary_word(text[..start].chars().next_back())
                    || boundary_word(text[end..].chars().next()))
            {
                continue;
            }
            spans.push(Span {
                start,
                end,
                ids: e.ids.clone(),
                weight: e.weight,
                evidence: vec![Evidence {
                    kind: e.kind.clone(),
                    input: text[start..end].into(),
                    matched: e.text.clone(),
                }],
                ambiguous: e.ambiguous,
                requires: e.requires.clone(),
            });
        }
    }
    let tokens: Vec<_> = data::patterns().latin_token.find_iter(text).collect();
    for i in 0..tokens.len() {
        for size in 1..=6.min(tokens.len() - i) {
            let slice = &tokens[i..i + size];
            let start = slice[0].start();
            let end = slice[size - 1].end();
            if word(text[..start].chars().next_back())
                || word(text[end..].chars().next())
                || !data::patterns().latin_phrase.is_match(&text[start..end])
            {
                continue;
            }
            if spans.iter().any(|s| s.start <= start && s.end >= end) {
                continue;
            }
            for e in data::index().typos.get(&size).into_iter().flatten() {
                let mut edits = 0;
                let valid = e.text.split_whitespace().zip(slice).all(|(w, t)| {
                    if w == t.as_str() {
                        true
                    } else {
                        edits += 1;
                        one_edit(w, t.as_str())
                    }
                });
                if !valid || edits != 1 {
                    continue;
                }
                spans.push(Span {
                    start,
                    end,
                    ids: e.ids.clone(),
                    weight: 76,
                    evidence: vec![Evidence {
                        kind: "bounded-typo".into(),
                        input: text[start..end].into(),
                        matched: e.text.clone(),
                    }],
                    ambiguous: false,
                    requires: vec![],
                });
            }
        }
    }
    spans
        .iter()
        .filter(|s| {
            s.requires.is_empty()
                || spans.iter().any(|x| {
                    x.requires.is_empty() && x.ids.iter().any(|id| s.requires.contains(id))
                })
        })
        .cloned()
        .collect()
}
fn one_edit(a: &str, b: &str) -> bool {
    if a == b {
        return true;
    }
    if a.len() <= 3 || b.len() <= 3 || a.len().abs_diff(b.len()) > 1 {
        return false;
    }
    let a = a.as_bytes();
    let b = b.as_bytes();
    let mut i = 0;
    while i < a.len().min(b.len()) && a[i] == b[i] {
        i += 1;
    }
    if a.len() == b.len() {
        a[i + 1..] == b[i + 1..]
            || (i + 1 < a.len() && a[i] == b[i + 1] && a[i + 1] == b[i] && a[i + 2..] == b[i + 2..])
    } else if a.len() > b.len() {
        a[i + 1..] == b[i..]
    } else {
        a[i..] == b[i + 1..]
    }
}
