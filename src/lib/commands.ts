// Platform layer: the same API is backed either by the Tauri Rust backend
// (desktop app) or by the static-index web backend (GitHub Pages build).
import { invoke } from "@tauri-apps/api/core";
import type {
  Favorite,
  HistoryEntry,
  ProviderInfo,
  SearchResponse,
  SearchResult,
  Settings,
} from "./types";
import {
  clearWebCache,
  refreshWebProvider,
  webProviders,
  webSearch,
} from "./webIndex";

export const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const SETTINGS_KEY = "sve.settings";
const FAVORITES_KEY = "sve.favorites";
const HISTORY_KEY = "sve.history";

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

export async function runSearch(
  query: string,
  forceRefresh: boolean
): Promise<SearchResponse> {
  if (!IS_TAURI) {
    const settings = readLocal<Settings>(SETTINGS_KEY, defaultSettings());
    return webSearch(query, settings.enabled_providers);
  }
  return invoke<SearchResponse>("search", { query, forceRefresh });
}

export async function providersInfo(): Promise<ProviderInfo[]> {
  if (!IS_TAURI) return webProviders((await getSettings()).enabled_providers);
  return invoke<ProviderInfo[]>("providers_info");
}

export async function refreshProviderIndex(id: string): Promise<ProviderInfo> {
  if (!IS_TAURI) {
    await refreshWebProvider(id);
    const list = await webProviders((await getSettings()).enabled_providers);
    return list.find((p) => p.id === id) as ProviderInfo;
  }
  return invoke<ProviderInfo>("refresh_provider_index", { id });
}

export async function setProviderEnabled(id: string, enabled: boolean): Promise<void> {
  if (!IS_TAURI) return; // persisted via saveSettings
  return invoke("set_provider_enabled", { id, enabled });
}

export async function clearCache(): Promise<number> {
  if (!IS_TAURI) return clearWebCache();
  return invoke<number>("clear_cache");
}

export async function getSettings(): Promise<Settings> {
  if (!IS_TAURI) return readLocal<Settings>(SETTINGS_KEY, defaultSettings());
  return invoke<Settings>("get_settings");
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!IS_TAURI) {
    writeLocal(SETTINGS_KEY, settings);
    return;
  }
  return invoke("save_settings", { settings });
}

export async function listFavorites(): Promise<Favorite[]> {
  if (!IS_TAURI) return readLocal<Favorite[]>(FAVORITES_KEY, []);
  return invoke<Favorite[]>("list_favorites");
}

export async function addFavorite(result: SearchResult): Promise<void> {
  if (!IS_TAURI) {
    const favorites = readLocal<Favorite[]>(FAVORITES_KEY, []).filter(
      (f) => f.result.id !== result.id
    );
    favorites.unshift({ result, created_at: Date.now() });
    writeLocal(FAVORITES_KEY, favorites);
    return;
  }
  return invoke("add_favorite", { result });
}

export async function removeFavorite(id: string): Promise<void> {
  if (!IS_TAURI) {
    const favorites = readLocal<Favorite[]>(FAVORITES_KEY, []).filter(
      (f) => f.result.id !== id
    );
    writeLocal(FAVORITES_KEY, favorites);
    return;
  }
  return invoke("remove_favorite", { id });
}

export async function listHistory(): Promise<HistoryEntry[]> {
  if (!IS_TAURI) return readLocal<HistoryEntry[]>(HISTORY_KEY, []);
  return invoke<HistoryEntry[]>("list_history");
}

export async function addHistory(query: string, resultCount: number): Promise<void> {
  if (!IS_TAURI) {
    const history = readLocal<HistoryEntry[]>(HISTORY_KEY, []);
    const entry: HistoryEntry = {
      id: Date.now(),
      query,
      result_count: resultCount,
      created_at: Date.now(),
    };
    const next = [entry, ...history.filter((h) => h.query !== query)].slice(0, 200);
    writeLocal(HISTORY_KEY, next);
    return;
  }
  return invoke("add_history", { query, resultCount });
}

export async function clearHistory(): Promise<void> {
  if (!IS_TAURI) {
    writeLocal(HISTORY_KEY, []);
    return;
  }
  return invoke("clear_history");
}

export async function openExternal(url: string): Promise<void> {
  if (!IS_TAURI) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke("open_external", { url });
}

export async function openWindow(url: string, _title: string): Promise<string> {
  if (!IS_TAURI) {
    window.open(url, "_blank", "noopener,noreferrer");
    return "browser";
  }
  return invoke<string>("open_window", { url, title: _title });
}

export async function closeWindow(label: string): Promise<void> {
  if (!IS_TAURI) return;
  return invoke("close_window", { label });
}

export async function togglePin(label: string): Promise<boolean> {
  if (!IS_TAURI) return false;
  return invoke<boolean>("toggle_pin", { label });
}

export async function openWorkspace(urls: string[]): Promise<string> {
  if (!IS_TAURI) {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(urls))));
    const url = `${window.location.pathname}?workspace=1&items=${encodeURIComponent(payload)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return "workspace";
  }
  return invoke<string>("open_workspace", { urls });
}

export async function getWorkspaceItems(label: string): Promise<string[]> {
  if (!IS_TAURI) return workspaceItemsFromUrl();
  return invoke<string[]>("get_workspace_items", { label });
}

function workspaceItemsFromUrl(): string[] {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("items");
  if (!raw) return [];
  try {
    return JSON.parse(decodeURIComponent(escape(atob(raw)))) as string[];
  } catch {
    return [];
  }
}

export function defaultSettings(): Settings {
  return {
    theme: "system",
    preview_mode: "side",
    enabled_providers: [
      "mathinsight",
      "falstad",
      "phet",
      "betterexplained",
      "physicsfundamentals",
      "physicstuff",
      "maotian",
    ],
    mock_mode: false,
  };
}