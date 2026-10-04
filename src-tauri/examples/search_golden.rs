use serde_json::{json, Value};
use stem_visual_explorer_lib::{
    providers::common::{search_entries, to_result, IndexEntry},
    search::{normalize, query, ranking},
};
fn main() {
    let data: Value = serde_json::from_str(include_str!("../../tests/search-golden.json")).unwrap();
    let entries: Vec<IndexEntry> = serde_json::from_value(data["entries"].clone()).unwrap();
    let mut output = Vec::new();
    for case in data["cases"].as_array().unwrap() {
        let raw = case["query"].as_str().unwrap();
        let q = normalize::expand(&query::parse(raw));
        assert_eq!(json!(q.concept_ids), case["concept_ids"], "{raw}");
        assert_eq!(
            q.groups.len(),
            case["groups"].as_u64().unwrap() as usize,
            "{raw}"
        );
        let results = ranking::rank(&q, search_entries("test", "Test", &entries, &q));
        let titles: Vec<_> = results.iter().map(|r| r.title.as_str()).collect();
        for key in ["must_include", "must_not_include"] {
            if let Some(expected) = case[key].as_array() {
                for title in expected {
                    assert_eq!(
                        titles.contains(&title.as_str().unwrap()),
                        key == "must_include",
                        "{raw}: {key} {title}"
                    );
                }
            }
        }
        if let Some(expected) = case["must_not_expand_as_direct"].as_array() {
            for text in expected {
                assert!(!q
                    .variants
                    .iter()
                    .any(|v| v.text == text.as_str().unwrap() && v.tier != "exploratory"));
            }
        }
        if let Some(expected) = case["variants"].as_array() {
            for v in expected {
                assert!(q
                    .variants
                    .iter()
                    .any(|x| x.text == v["text"].as_str().unwrap()
                        && x.r#match == v["match"].as_str().unwrap()));
            }
        }
        if let Some(expected) = case["ranking"].as_array() {
            let input = expected
                .iter()
                .rev()
                .map(|t| {
                    to_result(
                        "test",
                        "Test",
                        entries
                            .iter()
                            .find(|e| e.title == t.as_str().unwrap())
                            .unwrap(),
                    )
                })
                .collect();
            assert_eq!(
                json!(ranking::rank(&q, input)
                    .iter()
                    .map(|r| &r.title)
                    .collect::<Vec<_>>()),
                case["ranking"]
            );
        }
        output.push(json!({"query":raw,"concept_ids":q.concept_ids,"groups":q.groups,"variants":q.variants,"phrases":q.phrases,"site_filter":q.site_filter,"type_filter":q.type_filter,"results":results.iter().map(|r|json!({"title":r.title,"score":r.score,"explanation":r.explanation})).collect::<Vec<_>>()}));
    }
    let annotations:Vec<_>=entries.iter().map(|e| {let m=stem_visual_explorer_lib::providers::common::annotate(e);json!({"concept_ids":m.concept_ids,"concept_evidence":m.concept_evidence,"subject":m.subject,"language":m.language})}).collect();
    println!("{}", json!({"cases":output,"annotations":annotations}));
}
