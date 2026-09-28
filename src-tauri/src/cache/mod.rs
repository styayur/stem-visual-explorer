use crate::error::{AppError, Result};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::{Path, PathBuf};

/// Read a JSON cache file. Returns `None` when the file does not exist and
/// `Err` only for genuine parse failures (never for a missing file).
pub fn read_json<T: DeserializeOwned>(path: &Path) -> Result<Option<T>> {
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(path)?;
    let value: T = serde_json::from_slice(&bytes)
        .map_err(|e| AppError::Parse(format!("failed to parse cache {}: {e}", path.display())))?;
    Ok(Some(value))
}

/// Atomically-ish write a JSON cache file (write to temp then rename).
pub fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(value)?;
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

/// Remove all JSON cache files under `dir`.
pub fn clear_all(dir: &Path) -> Result<usize> {
    let mut removed = 0;
    if !dir.exists() {
        return Ok(removed);
    }
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let p = entry.path();
        if p.extension().and_then(|e| e.to_str()) == Some("json")
            && std::fs::remove_file(&p).is_ok()
        {
            removed += 1;
        }
    }
    Ok(removed)
}

/// List cache file paths for a provider id.
pub fn cache_path(dir: &Path, key: &str) -> PathBuf {
    dir.join(format!("{key}.json"))
}
