//! Fetch every provider's local index and write it as JSON for the static web
//! build (GitHub Pages). Run with:
//!
//! ```text
//! cargo run --no-default-features --example dump_web_index
//! ```
//!
//! Output defaults to `../public/index` (override with `SVE_INDEX_OUT`).

use serde::Serialize;
use stem_visual_explorer_lib::providers::ProviderRegistry;
use stem_visual_explorer_lib::providers::{common::CachedIndex, http_client, SearchContext};

#[derive(Serialize)]
struct WebIndex<'a> {
    source_id: &'a str,
    source_name: &'a str,
    homepage: &'a str,
    experimental: bool,
    updated_at: String,
    entries: &'a [stem_visual_explorer_lib::providers::common::IndexEntry],
}

#[derive(Serialize)]
struct ManifestEntry {
    id: String,
    name: String,
    homepage: String,
    experimental: bool,
    count: usize,
    updated_at: String,
    file: String,
}

#[tokio::main]
async fn main() {
    let out_dir = std::env::var("SVE_INDEX_OUT").unwrap_or_else(|_| "../public/index".to_string());
    let out = std::path::PathBuf::from(&out_dir);
    std::fs::create_dir_all(&out).expect("create output dir");

    let registry = ProviderRegistry::new();
    let ctx = SearchContext {
        client: http_client(),
        cache_dir: std::env::temp_dir().join("sve-web-index-cache"),
    };

    let mut manifest = Vec::new();

    for provider in registry.all() {
        match provider.load_index(&ctx).await {
            Ok(Some(CachedIndex {
                updated_at,
                entries,
                ..
            })) => {
                let doc = WebIndex {
                    source_id: provider.id(),
                    source_name: provider.name(),
                    homepage: provider.homepage(),
                    experimental: provider.experimental(),
                    updated_at: updated_at.clone(),
                    entries: &entries,
                };
                let file = format!("{}.json", provider.id());
                let json = serde_json::to_vec(&doc).expect("serialize index");
                std::fs::write(out.join(&file), json).expect("write index file");
                println!(
                    "{: <22} {:>5} entries -> {file}",
                    provider.name(),
                    entries.len()
                );
                manifest.push(ManifestEntry {
                    id: provider.id().to_string(),
                    name: provider.name().to_string(),
                    homepage: provider.homepage().to_string(),
                    experimental: provider.experimental(),
                    count: entries.len(),
                    updated_at,
                    file,
                });
            }
            Ok(None) => println!("{: <22} (no local index)", provider.name()),
            Err(e) => eprintln!("{: <22} ERROR: {e}", provider.name()),
        }
    }

    let manifest_json = serde_json::to_vec_pretty(&manifest).expect("serialize manifest");
    std::fs::write(out.join("manifest.json"), manifest_json).expect("write manifest");
    println!(
        "\nwrote {} provider indexes to {}",
        manifest.len(),
        out.display()
    );
}
