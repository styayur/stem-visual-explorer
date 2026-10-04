use super::normalize::{matches, term};
use crate::models::{
    MatchEvidence, NormalizedQuery, QueryVariant, ResultType, SearchExplanation, SearchResult,
};
use std::collections::{BTreeMap, BTreeSet};
fn field_evidence(r: &SearchResult, variants: &[QueryVariant], group: &str) -> Vec<MatchEvidence> {
    let mut out = Vec::new();
    let fields = [
        ("title", vec![r.title.as_str()]),
        ("tags", r.tags.iter().map(String::as_str).collect()),
        (
            "description",
            vec![r.description.as_deref().unwrap_or_default()],
        ),
    ];
    for (field, values) in fields {
        if let Some(v) = variants.iter().find(|v| {
            values
                .iter()
                .any(|value| matches(value, &v.text, &v.r#match))
        }) {
            out.push(MatchEvidence {
                concept_id: v.concept_id.clone(),
                group: group.into(),
                field: field.into(),
                tier: v.tier.clone(),
                text: v.text.clone(),
            });
        }
    }
    if let Some(v) = variants.iter().find(|v| {
        v.concept_id
            .as_ref()
            .is_some_and(|id| r.semantic.concept_ids.contains(id))
    }) {
        out.push(MatchEvidence {
            concept_id: v.concept_id.clone(),
            group: group.into(),
            field: "concepts".into(),
            tier: v.tier.clone(),
            text: v.text.clone(),
        });
    }
    out
}
pub fn explain(q: &NormalizedQuery, r: &SearchResult) -> SearchExplanation {
    let mut matched: Vec<_> = q
        .groups
        .iter()
        .flat_map(|g| field_evidence(r, &g.variants, &g.id))
        .collect();
    let groups_matched = matched
        .iter()
        .map(|m| &m.group)
        .collect::<BTreeSet<_>>()
        .len();
    let all = groups_matched == q.groups.len();
    if q.explore && !all {
        matched.extend(field_evidence(
            r,
            &q.variants
                .iter()
                .filter(|v| v.tier == "exploratory")
                .cloned()
                .collect::<Vec<_>>(),
            "exploratory",
        ));
    }
    let exploratory = matched.iter().any(|m| m.tier == "exploratory");
    let tier = if q.groups.is_empty() {
        "browse"
    } else if all {
        "all-groups"
    } else if groups_matched > 0 {
        "partial"
    } else if exploratory {
        "exploratory"
    } else {
        "none"
    };
    let title_all = !q.groups.is_empty()
        && q.groups.iter().all(|g| {
            matched
                .iter()
                .any(|m| m.group == g.id && m.field == "title")
        });
    let exact = q.groups.len() == 1
        && q.groups[0]
            .variants
            .iter()
            .any(|v| v.kind != "alternate" && term(&r.title) == v.text);
    let has = |field: &str| matched.iter().any(|m| m.field == field);
    let mut score_components: BTreeMap<String, f64> = [
        (
            "coverage",
            if tier == "all-groups" {
                1000.0
            } else if tier == "partial" {
                500.0 * groups_matched as f64 / q.groups.len() as f64
            } else {
                0.0
            },
        ),
        (
            "title",
            if exact {
                100.0
            } else if title_all {
                75.0
            } else if has("title") {
                55.0
            } else {
                0.0
            },
        ),
        ("concepts", if has("concepts") { 65.0 } else { 0.0 }),
        ("tags", if has("tags") { 30.0 } else { 0.0 }),
        ("description", if has("description") { 15.0 } else { 0.0 }),
        (
            "interactive",
            if matches!(
                r.result_type,
                ResultType::Interactive
                    | ResultType::Simulation
                    | ResultType::Applet
                    | ResultType::Visualization
            ) {
                5.0
            } else {
                0.0
            },
        ),
    ]
    .into_iter()
    .map(|(k, v)| (k.into(), v))
    .collect();
    if tier == "exploratory" {
        for v in score_components.values_mut() {
            *v *= 0.1;
        }
    }
    if tier == "none" {
        for v in score_components.values_mut() {
            *v = 0.0;
        }
    }
    let matched_concept_ids = matched
        .iter()
        .filter_map(|m| m.concept_id.clone())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    SearchExplanation {
        matched,
        matched_concept_ids,
        match_tier: tier.into(),
        groups_matched,
        groups_total: q.groups.len(),
        score_components,
    }
}
pub fn score(q: &NormalizedQuery, r: &SearchResult) -> f64 {
    (explain(q, r).score_components.values().sum::<f64>() * 1000.0).round() / 1000.0
}
pub fn rank(q: &NormalizedQuery, mut results: Vec<SearchResult>) -> Vec<SearchResult> {
    for r in &mut results {
        r.score = score(q, r);
        r.explanation = Some(explain(q, r));
    }
    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.source_name.cmp(&b.source_name))
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
            .then_with(|| a.id.cmp(&b.id))
    });
    results
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ResultType;

    fn q(terms: &[&str]) -> NormalizedQuery {
        super::super::normalize::expand(&super::super::query::parse(&terms.join(" ")))
    }

    fn result(title: &str, tags: &[&str], desc: &str, rt: ResultType) -> SearchResult {
        SearchResult {
            semantic: Default::default(),
            explanation: None,
            id: title.to_string(),
            source_id: "test".into(),
            source_name: "Test".into(),
            title: title.into(),
            description: Some(desc.into()),
            url: "https://example.com".into(),
            result_type: rt,
            tags: tags.iter().map(|s| s.to_string()).collect(),
            score: 0.0,
            thumbnail: None,
        }
    }

    #[test]
    fn exact_title_wins() {
        let query = q(&["curl"]);
        let a = result("curl", &["curl"], "", ResultType::Article);
        let b = result(
            "The idea of curl of a vector field",
            &["curl"],
            "",
            ResultType::Article,
        );
        let scored = rank(&query, vec![b, a]);
        assert_eq!(scored[0].title, "curl");
        assert!(scored[0].score >= 100.0);
    }

    #[test]
    fn interactive_bonus_applies() {
        let query = q(&["gradient"]);
        let art = result("Gradient", &[], "", ResultType::Article);
        let applet = result("Gradient", &[], "", ResultType::Applet);
        assert!(score(&query, &applet) > score(&query, &art));
    }
}
