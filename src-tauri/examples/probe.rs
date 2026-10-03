//! Live provider health + multilingual retrieval coverage. No fixtures or cache reads.
use serde_json::json;
use stem_visual_explorer_lib::{
    providers::{
        common::{search_entries, validate_index, CachedIndex},
        http_client, ProviderRegistry, SearchContext,
    },
    search::{normalize, query, ranking},
};
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let registry = ProviderRegistry::new();
    let ctx = SearchContext {
        client: http_client(),
        cache_dir: std::env::temp_dir().join("sve-probe-no-cache"),
    };
    let mut indexes = Vec::new();
    let mut health = Vec::new();
    for p in registry.all() {
        let fetched =
            tokio::time::timeout(std::time::Duration::from_secs(60), p.load_index(&ctx)).await;
        match fetched {
            Ok(Ok(Some(index))) => match validate_index(p.id(), &index, None) {
                Ok(()) => {
                    health.push(json!({"provider":p.id(),"live":true,"entries":index.entries.len(),"error":null}));
                    indexes.push((p.id(), p.name(), index));
                }
                Err(e) => health.push(json!({"provider":p.id(),"live":true,"error":e.to_string()})),
            },
            other => {
                health.push(json!({"provider":p.id(),"live":true,"error":format!("{other:?}")}))
            }
        }
    }
    let ids = [
        "angular-momentum",
        "determinant",
        "taylor-series",
        "line-integral",
        "fourier-transform",
        "curl",
        "doppler-effect",
        "maxwell-equations",
        "photoelectric-effect",
        "schrodinger-equation",
        "entropy",
        "torque",
        "gradient",
        "normal-distribution",
        "laplace-transform",
        "ohm-s-law",
        "refraction",
        "heat-equation",
        "eigenvalue",
        "quantum-tunneling",
    ];
    let mut queries = Vec::new();
    for id in ids {
        let c = normalize::concepts().iter().find(|c| c.id == id).unwrap();
        queries.extend([c.en.clone(), c.zh_cn.clone(), c.zh_tw.clone()]);
    }
    queries.extend(["FT".into(), "rot".into(), "gradient curl".into()]);
    let mut rows = Vec::new();
    for raw in queries {
        let q = normalize::expand(&query::parse(&raw));
        let mut all = Vec::new();
        let mut counts = serde_json::Map::new();
        for (id, name, CachedIndex { entries, .. }) in &indexes {
            let results = search_entries(id, name, entries, &q);
            counts.insert((*id).into(), json!(results.len()));
            all.extend(results);
        }
        let results = ranking::rank(&q, all);
        println!("{raw}: {:?}; {} results", q.concept_ids, results.len());
        for r in results.iter().take(5) {
            println!("  [{}] {}", r.source_name, r.title);
        }
        rows.push(json!({"query":raw,"concept_resolution":q.concept_ids,"query_groups":q.groups,"direct_equivalent_terms":q.variants.iter().filter(|v|v.tier!="exploratory").collect::<Vec<_>>(),"provider_result_counts":counts,"count":results.len(),"top5":results.into_iter().take(5).collect::<Vec<_>>()}));
    }
    let report = json!({"verification":"live provider indexes fetched during this run; no fixtures, no disk cache","providers":health,"queries":rows});
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("artifacts/provider-probe.json");
    std::fs::create_dir_all(path.parent().unwrap())?;
    std::fs::write(path, serde_json::to_vec_pretty(&report)?)?;
    if report["providers"]
        .as_array()
        .unwrap()
        .iter()
        .any(|p| !p["error"].is_null())
    {
        return Err("live provider failure; inspect artifacts/provider-probe.json".into());
    }
    Ok(())
}
