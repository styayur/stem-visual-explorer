use crate::database::Database;
use crate::error::{AppError, Result};
use crate::models::Settings;
use crate::providers::{self, ProviderRegistry};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub registry: ProviderRegistry,
    pub client: reqwest::Client,
    pub db: Database,
    pub cache_dir: PathBuf,
    pub settings_path: PathBuf,
    pub settings: Mutex<Settings>,
    pub workspace_payloads: Mutex<HashMap<String, Vec<String>>>,
}

impl AppState {
    pub fn load(app_dir: &std::path::Path) -> Result<Self> {
        let cache_dir = app_dir.join("cache");
        let settings_path = app_dir.join("settings.json");
        let db_path = app_dir.join("sve.db");

        let settings = if settings_path.exists() {
            let bytes = std::fs::read(&settings_path)?;
            serde_json::from_slice(&bytes).unwrap_or_default()
        } else {
            Settings::default()
        };

        Ok(Self {
            registry: ProviderRegistry::new(),
            client: providers::http_client(),
            db: Database::open(&db_path)?,
            cache_dir,
            settings_path,
            settings: Mutex::new(settings),
            workspace_payloads: Mutex::new(HashMap::new()),
        })
    }

    pub fn update_settings(&self, update: impl FnOnce(&mut Settings)) -> Result<()> {
        let mut settings = self
            .settings
            .lock()
            .map_err(|_| AppError::Other("lock poisoned".into()))?;
        let mut next = settings.clone();
        update(&mut next);
        crate::cache::write_json(&self.settings_path, &next)?;
        *settings = next;
        Ok(())
    }

    pub fn enabled_providers(&self) -> Vec<String> {
        self.settings
            .lock()
            .map(|s| s.enabled_providers.clone())
            .unwrap_or_default()
    }
}
