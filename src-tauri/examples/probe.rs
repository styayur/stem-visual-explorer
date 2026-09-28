//! Live provider probe used to verify the acceptance queries against the real
//! source websites. Run with:
//!
//! ```text
//! cargo run --no-default-features --example probe
//! ```

use std::collections::BTreeSet;
use stem_visual_explorer_lib::providers::{http_client, ProviderRegistry, SearchContext};
use stem_visual_explorer_lib::search::manager;

#[tokio::main]
async fn main() {
    let queries = [
        "gradient",
        "curl",
        "divergence",
        "standing wave",
        "harmonic oscillator",
        "electromagnetic induction",
        "quantum",
        "Fourier",
        "梯度",
        "旋度",
        "驻波",
    ];

    let registry = ProviderRegistry::new();
    let enabled: Vec<String> = registry.all().iter().map(|p| p.id().to_string()).collect();
    let ctx = SearchContext {
        client: http_client(),
        cache_dir: std::env::temp_dir().join("sve-probe-cache"),
    };

    let mut providers_with_results: BTreeSet<String> = BTreeSet::new();

    for q in queries {
        println!("\n=== query: {q} ===");
        match manager::run_search(&ctx, &registry, q, &enabled, false).await {
            Ok(resp) => {
                println!("total results: {}", resp.total);
                println!("expanded terms: {}", resp.expanded_terms.join(", "));
                for p in &resp.providers {
                    if p.error.is_some() {
                        println!("  {: <22} ERROR: {}", p.name, p.error.clone().unwrap());
                    } else {
                        if p.count > 0 {
                            providers_with_results.insert(p.id.clone());
                        }
                        let idx = p
                            .indexed_items
                            .map(|n| format!(" (indexed {n})"))
                            .unwrap_or_default();
                        println!("  {: <22} {}{}", p.name, p.count, idx);
                    }
                }
                if let Some(top) = resp.results.first() {
                    println!("  top: [{}] {}", top.source_name, top.title);
                }
            }
            Err(e) => println!("  SEARCH ERROR: {e}"),
        }
    }

    println!(
        "\nproviders that returned at least one result across all queries: {}",
        providers_with_results.len()
    );
    for id in &providers_with_results {
        println!("  - {id}");
    }
}
