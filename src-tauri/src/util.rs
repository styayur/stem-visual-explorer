use crate::error::{AppError, Result};
use url::Url;

/// Validate that a user-provided result URL is a plain http/https URL with a
/// host. This blocks file://, javascript:, data: and other schemes.
pub fn validate_http_url(input: &str) -> Result<Url> {
    let url = Url::parse(input).map_err(|e| AppError::InvalidUrl(e.to_string()))?;
    match url.scheme() {
        "http" | "https" => {}
        other => {
            return Err(AppError::InvalidUrl(format!(
                "scheme {other} is not allowed"
            )))
        }
    }
    if url.host_str().is_none() {
        return Err(AppError::InvalidUrl("url has no host".into()));
    }
    Ok(url)
}

/// WebViewer labels are intentionally excluded even after navigation to a local URL.
pub fn is_app_window(label: &str) -> bool {
    label == "main"
        || label
            .strip_prefix("workspace-")
            .is_some_and(|suffix| !suffix.is_empty() && suffix.chars().all(|c| c.is_ascii_digit()))
}
