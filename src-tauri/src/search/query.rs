use crate::models::{ParsedQuery, ResultType};

/// Parse the small search command syntax.
///
/// Supported constructs:
/// - `site:falstad wave` or `source:phet gradient` -> provider filter
/// - `type:interactive gradient` -> result type filter
/// - `"standing wave"` -> exact phrase
///
/// Everything else is treated as free-text terms. This is intentionally a tiny
/// parser, not a query language.
pub fn parse(raw: &str) -> ParsedQuery {
    let mut q = ParsedQuery {
        raw: raw.trim().to_string(),
        ..Default::default()
    };

    let mut rest: Vec<String> = Vec::new();
    let mut i = 0;
    let chars: Vec<char> = raw.chars().collect();

    while i < chars.len() {
        let c = chars[i];

        // Skip whitespace.
        if c.is_whitespace() {
            i += 1;
            continue;
        }

        // Exact phrase.
        if c == '"' {
            i += 1;
            let mut phrase = String::new();
            while i < chars.len() && chars[i] != '"' {
                phrase.push(chars[i]);
                i += 1;
            }
            if i < chars.len() {
                i += 1; // closing quote
            }
            if !phrase.trim().is_empty() {
                q.phrases.push(
                    phrase
                        .split_whitespace()
                        .collect::<Vec<_>>()
                        .join(" ")
                        .to_lowercase(),
                );
            }
            continue;
        }

        // Read one whitespace-delimited token.
        let start = i;
        while i < chars.len() && !chars[i].is_whitespace() {
            i += 1;
        }
        let token: String = chars[start..i].iter().collect();
        let lower = token.to_lowercase();

        if let Some(rest_of) = lower.strip_prefix("site:") {
            if !rest_of.is_empty() {
                q.site_filter = Some(rest_of.to_string());
            } else {
                rest.push(token);
            }
        } else if let Some(rest_of) = lower.strip_prefix("source:") {
            if !rest_of.is_empty() {
                q.site_filter = Some(rest_of.to_string());
            } else {
                rest.push(token);
            }
        } else if let Some(rest_of) = lower.strip_prefix("type:") {
            if !rest_of.is_empty() {
                q.type_filter = parse_result_type(rest_of);
            } else {
                rest.push(token);
            }
        } else {
            rest.push(token);
        }
    }

    q.terms = rest;
    q
}

fn parse_result_type(s: &str) -> Option<ResultType> {
    match s {
        "article" => Some(ResultType::Article),
        "interactive" => Some(ResultType::Interactive),
        "simulation" => Some(ResultType::Simulation),
        "applet" => Some(ResultType::Applet),
        "experiment" => Some(ResultType::Experiment),
        "visualization" => Some(ResultType::Visualization),
        "video" => Some(ResultType::Video),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_plain_terms() {
        let q = parse("gradient curl");
        assert_eq!(q.terms, vec!["gradient", "curl"]);
        assert!(q.site_filter.is_none());
        assert!(q.type_filter.is_none());
    }

    #[test]
    fn parses_site_filter() {
        let q = parse("site:falstad wave");
        assert_eq!(q.site_filter.as_deref(), Some("falstad"));
        assert_eq!(q.terms, vec!["wave"]);
    }

    #[test]
    fn parses_source_alias() {
        let q = parse("source:mathinsight curl");
        assert_eq!(q.site_filter.as_deref(), Some("mathinsight"));
    }

    #[test]
    fn parses_type_filter() {
        let q = parse("type:interactive gradient");
        assert_eq!(q.type_filter, Some(ResultType::Interactive));
        assert_eq!(q.terms, vec!["gradient"]);
    }

    #[test]
    fn parses_exact_phrase() {
        let q = parse("\"standing wave\" harmonic");
        assert_eq!(q.phrases, vec!["standing wave"]);
        assert_eq!(q.terms, vec!["harmonic"]);
    }
}
