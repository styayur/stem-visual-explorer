use crate::models::{NormalizedQuery, ResultType, SearchResult};

/// Transparent, deterministic relevance scoring.
///
/// - Exact title match: +100
/// - All direct concept groups in title: 60 * weakest group weight
/// - Otherwise title: 30 * strongest matching variant
/// - Tags: 20 * strongest matching variant (capped across aliases)
/// - Description: 10 * strongest matching variant
/// - Interactive / simulation / applet / visualization bonus: +5
pub fn score(query: &NormalizedQuery, result: &SearchResult) -> f32 {
    let title = result.title.to_lowercase();
    let tags: Vec<String> = result.tags.iter().map(|t| t.to_lowercase()).collect();
    let desc = result
        .description
        .clone()
        .unwrap_or_default()
        .to_lowercase();

    let parsed = super::query::parse(&query.raw);
    let raw = parsed
        .terms
        .iter()
        .chain(parsed.phrases.iter())
        .cloned()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();
    let best = |text: &str, variants: &[&crate::models::QueryVariant]| -> f32 {
        variants
            .iter()
            .filter(|v| text.contains(&v.text))
            .map(|v| v.weight)
            .fold(0.0, f32::max)
    };
    let variants: Vec<_> = query.variants.iter().collect();
    let mut groups: std::collections::BTreeMap<String, Vec<&crate::models::QueryVariant>> =
        std::collections::BTreeMap::new();
    for v in &query.variants {
        if v.kind != "related" {
            groups
                .entry(v.concept_id.clone().unwrap_or_else(|| v.text.clone()))
                .or_default()
                .push(v);
        }
    }
    let all_weight = if !groups.is_empty() && query.phrases.iter().all(|p| title.contains(p)) {
        groups
            .values()
            .map(|vs| best(&title, vs))
            .fold(1.0, f32::min)
    } else {
        0.0
    };
    let mut score = if !raw.is_empty() && title.trim() == raw.trim() {
        100.0
    } else if all_weight > 0.0 {
        60.0 * all_weight
    } else {
        30.0 * best(&title, &variants)
    };
    score += 20.0 * best(&tags.join(" "), &variants) + 10.0 * best(&desc, &variants);

    if matches!(
        result.result_type,
        ResultType::Interactive
            | ResultType::Simulation
            | ResultType::Applet
            | ResultType::Visualization
    ) {
        score += 5.0;
    }

    (score * 1000.0).round() / 1000.0
}

/// Rank and sort results by descending score, using source name and title as
/// deterministic tie breakers so the ordering is stable.
pub fn rank(query: &NormalizedQuery, mut results: Vec<SearchResult>) -> Vec<SearchResult> {
    for r in results.iter_mut() {
        r.score = score(query, r);
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
