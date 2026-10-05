use super::{normalize, resolve};
use crate::search::normalize::concepts;
use serde_json::Value;
#[test]
fn shared_resolver_contract() {
    let fixture: Value =
        serde_json::from_str(include_str!("../../../../tests/query-resolver-v2.json"))
            .expect("validated fixture");
    for case in fixture["cases"].as_array().expect("cases") {
        let query = case["query"].as_str().expect("query");
        let result = resolve(query);
        assert_eq!(
            serde_json::json!(result.concept_ids),
            case["ids"],
            "{query}"
        );
        assert_eq!(
            result.status,
            case["status"].as_str().expect("status"),
            "{query}"
        );
        if let Some(e) = case["evidence"].as_str() {
            assert!(result.explanation.iter().any(|x| x.kind == e), "{query}");
        }
    }
}
#[test]
fn canonical_and_normalization_invariants() {
    for c in concepts() {
        for label in [&c.en, &c.zh_cn, &c.zh_tw] {
            assert_eq!(resolve(label).concept_ids, vec![c.id.clone()], "{label}");
            assert_eq!(
                normalize::query(&normalize::query(label)),
                normalize::query(label)
            );
            assert_eq!(
                resolve(&format!("({label})!")).concept_ids,
                vec![c.id.clone()]
            );
        }
    }
    for text in [
        "位相",
        "能力",
        "分裂",
        "波",
        "定理",
        "似然",
        "井",
        "反函数",
        "光射",
    ] {
        assert_eq!(normalize::query(text), text);
    }
}
#[test]
fn bounds_and_unsafe_structures_abstain() {
    for q in [
        "x".repeat(513),
        "∇×".repeat(100000),
        "(".repeat(200),
        "det(".repeat(100),
        "eval(alert(1))".into(),
    ] {
        assert_eq!(resolve(&q).status, "unknown");
        assert!(resolve(&q).concept_ids.is_empty());
    }
}
