//! Live-only snapshot generator. All providers must pass gates before any destination file changes.
use serde::Serialize;
use stem_visual_explorer_lib::providers::{
    common::{validate_index, CachedIndex},
    http_client, ProviderRegistry, SearchContext,
};
#[derive(Serialize)]
struct WebIndex {
    source_id: String,
    source_name: String,
    homepage: String,
    experimental: bool,
    updated_at: String,
    schema_version: u32,
    entries: Vec<stem_visual_explorer_lib::providers::common::IndexEntry>,
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
    schema_version: u32,
}
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or("Cargo manifest directory has no repository parent")?;
    let out = std::env::var("SVE_INDEX_OUT")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| root.join("public/index"));
    let base = std::env::var("SVE_INDEX_BASE")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| root.join("public/index"));
    let registry = ProviderRegistry::new();
    let ctx = SearchContext {
        client: http_client(),
        cache_dir: std::env::temp_dir().join("sve-live-refresh-unused-cache"),
    };
    let mut manifest = Vec::new();
    let mut documents = Vec::new();
    let mut errors = Vec::new();
    for p in registry.all() {
        // load_index calls the real provider fetch, never disk cache or fixtures.
        let outcome =
            tokio::time::timeout(std::time::Duration::from_secs(60), p.load_index(&ctx)).await;
        let fresh = match outcome {
            Ok(Ok(Some(index))) => index,
            other => {
                errors.push(format!("{}: {other:?}", p.id()));
                continue;
            }
        };
        let previous = std::fs::read(base.join(format!("{}.json", p.id())))
            .ok()
            .and_then(|s| serde_json::from_slice::<serde_json::Value>(&s).ok())
            .and_then(|v| serde_json::from_value(v["entries"].clone()).ok())
            .map(CachedIndex::new);
        if let Err(e) = validate_index(p.id(), &fresh, previous.as_ref()) {
            errors.push(e.to_string());
            continue;
        }
        let file = format!("{}.json", p.id());
        println!(
            "{}: {} -> {} (live)",
            p.name(),
            previous.as_ref().map_or(0, |p| p.entries.len()),
            fresh.entries.len()
        );
        manifest.push(ManifestEntry {
            id: p.id().into(),
            name: p.name().into(),
            homepage: p.homepage().into(),
            experimental: p.experimental(),
            count: fresh.entries.len(),
            updated_at: fresh.updated_at.clone(),
            file: file.clone(),
            schema_version: 2,
        });
        documents.push((
            file,
            WebIndex {
                source_id: p.id().into(),
                source_name: p.name().into(),
                homepage: p.homepage().into(),
                experimental: p.experimental(),
                updated_at: fresh.updated_at,
                schema_version: 2,
                entries: fresh.entries,
            },
        ));
    }
    if !errors.is_empty() {
        return Err(format!(
            "Refresh rejected; destination unchanged:\n{}",
            errors.join("\n")
        )
        .into());
    }
    std::fs::create_dir_all(&out)?;
    for (file, doc) in documents {
        std::fs::write(out.join(file), serde_json::to_vec(&doc)?)?;
    }
    std::fs::write(
        out.join("manifest.json"),
        serde_json::to_vec_pretty(&manifest)?,
    )?;
    println!(
        "Validated {} live providers -> {}",
        manifest.len(),
        out.display()
    );
    Ok(())
}
