use crate::models::{NormalizedQuery, ResultType, SearchResult};

/// Transparent, deterministic relevance scoring.
///
/// - Exact title match: +100
/// - Title contains all tokens: +60
/// - Title contains at least one token: +30
/// - Tag match (per matched tag): +20
/// - Description match: +10
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
    let title_contains_all = !(parsed.terms.is_empty() && parsed.phrases.is_empty())
        && parsed.terms.iter().all(|term| {
            super::normalize::expand(&super::query::parse(term))
                .tokens
                .iter()
                .any(|t| title.contains(t.as_str()))
        })
        && parsed.phrases.iter().all(|p| title.contains(p.as_str()));
    let mut score = 0.0_f32;

    if !raw.is_empty() && title.trim() == raw.trim() {
        score += 100.0;
    } else if title_contains_all {
        score += 60.0;
    } else if query.tokens.iter().any(|t| title.contains(t.as_str())) {
        score += 30.0;
    }

    let tag_matches = tags
        .iter()
        .filter(|tag| {
            query
                .tokens
                .iter()
                .any(|t| t == *tag || tag.contains(t.as_str()))
        })
        .count();
    score += 20.0 * tag_matches as f32;

    if query.tokens.iter().any(|t| desc.contains(t.as_str())) {
        score += 10.0;
    }

    if matches!(
        result.result_type,
        ResultType::Interactive
            | ResultType::Simulation
            | ResultType::Applet
            | ResultType::Visualization
    ) {
        score += 5.0;
    }

    score
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
        NormalizedQuery {
            raw: terms.join(" "),
            tokens: terms.iter().map(|s| s.to_string()).collect(),
            phrases: vec![],
            site_filter: None,
            type_filter: None,
        }
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
