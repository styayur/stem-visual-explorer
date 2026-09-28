use crate::error::{AppError, Result};
use crate::models::{Favorite, HistoryEntry, SearchResult};
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Mutex;

/// Thin SQLite wrapper for favorites and search history.
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS favorites (
               id TEXT PRIMARY KEY,
               result_json TEXT NOT NULL,
               created_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS history (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               query TEXT NOT NULL,
               result_count INTEGER NOT NULL,
               created_at INTEGER NOT NULL
             );",
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn add_favorite(&self, result: SearchResult, created_at: i64) -> Result<()> {
        let json = serde_json::to_string(&result)?;
        let conn = self
            .conn
            .lock()
            .map_err(|_| AppError::Other("lock poisoned".into()))?;
        conn.execute(
            "INSERT OR REPLACE INTO favorites (id, result_json, created_at) VALUES (?1, ?2, ?3)",
            params![result.id, json, created_at],
        )?;
        Ok(())
    }

    pub fn remove_favorite(&self, id: &str) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| AppError::Other("lock poisoned".into()))?;
        conn.execute("DELETE FROM favorites WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn is_favorite(&self, id: &str) -> Result<bool> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| AppError::Other("lock poisoned".into()))?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM favorites WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn list_favorites(&self) -> Result<Vec<Favorite>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| AppError::Other("lock poisoned".into()))?;
        let mut stmt =
            conn.prepare("SELECT result_json, created_at FROM favorites ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| {
            let json: String = row.get(0)?;
            let created_at: i64 = row.get(1)?;
            Ok((json, created_at))
        })?;
        let mut out = Vec::new();
        for row in rows {
            let (json, created_at) = row?;
            let result: SearchResult = serde_json::from_str(&json)?;
            out.push(Favorite { result, created_at });
        }
        Ok(out)
    }

    pub fn add_history(&self, query: &str, result_count: usize, created_at: i64) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| AppError::Other("lock poisoned".into()))?;
        conn.execute(
            "INSERT INTO history (query, result_count, created_at) VALUES (?1, ?2, ?3)",
            params![query, result_count as i64, created_at],
        )?;
        Ok(())
    }

    pub fn list_history(&self, limit: usize) -> Result<Vec<HistoryEntry>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| AppError::Other("lock poisoned".into()))?;
        let mut stmt = conn.prepare(
            "SELECT id, query, result_count, created_at FROM history ORDER BY created_at DESC, id DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                query: row.get(1)?,
                result_count: row.get::<_, i64>(2)? as usize,
                created_at: row.get(3)?,
            })
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        Ok(out)
    }

    pub fn clear_history(&self) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| AppError::Other("lock poisoned".into()))?;
        conn.execute("DELETE FROM history", [])?;
        Ok(())
    }
}
