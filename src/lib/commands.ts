// Platform layer: the same API is backed either by the Tauri Rust backend
// (desktop app) or by the static-index web backend (GitHub Pages build).
import { invoke } from "@tauri-apps/api/core";
import { httpUrl, workspaceUrls } from "./urls";
import { TARGET_LANGUAGES } from "./types";
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
  localStorage.setItem(key, JSON.stringify(value));
}

export async function runSearch(
  query: string,
  forceRefresh: boolean
): Promise<SearchResponse> {
  if (!IS_TAURI) {
    const settings = await getSettings();
    return webSearch(query, settings.enabled_providers, forceRefresh);
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
    const provider = list.find((p) => p.id === id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
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
  return normalizeSettings(!IS_TAURI
    ? readLocal<unknown>(SETTINGS_KEY, null)
    : await invoke<Settings>("get_settings"));
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!IS_TAURI) {
    writeLocal(SETTINGS_KEY, settings);
    return;
  }
  return invoke("save_settings", { settings });
}

export async function listFavorites(): Promise<Favorite[]> {
  if (!IS_TAURI) {
    const value = readLocal<unknown>(FAVORITES_KEY, []);
    return Array.isArray(value) ? value.filter((f) => isSearchResult(f?.result)) : [];
  }
  return invoke<Favorite[]>("list_favorites");
}

export async function addFavorite(result: SearchResult): Promise<void> {
  if (!IS_TAURI) {
    const favorites = (await listFavorites()).filter(
      (f) => f.result.id !== result.id
    );
    favorites.unshift({ result, created_at: Math.floor(Date.now() / 1000) });
    writeLocal(FAVORITES_KEY, favorites);
    return;
  }
  return invoke("add_favorite", { result });
}

export async function removeFavorite(id: string): Promise<void> {
  if (!IS_TAURI) {
    const favorites = (await listFavorites()).filter(
      (f) => f.result.id !== id
    );
    writeLocal(FAVORITES_KEY, favorites);
    return;
  }
  return invoke("remove_favorite", { id });
}

export async function listHistory(): Promise<HistoryEntry[]> {
  if (!IS_TAURI) {
    const value = readLocal<unknown>(HISTORY_KEY, []);
    return Array.isArray(value) ? value.filter((h) => h && typeof h.query === "string" && typeof h.created_at === "number") : [];
  }
  return invoke<HistoryEntry[]>("list_history");
}

export async function addHistory(query: string, resultCount: number): Promise<void> {
  query = query.trim();
  if (!query) return;
  if (!IS_TAURI) {
    const history = await listHistory();
    const entry: HistoryEntry = {
      id: Math.max(Date.now(), ...history.map((h) => Number.isFinite(h.id) ? h.id + 1 : 0)),
      query,
      result_count: resultCount,
      created_at: Math.floor(Date.now() / 1000),
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
  url = httpUrl(url);
  if (!IS_TAURI) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke("open_external", { url });
}

export async function copyUrl(url: string): Promise<void> {
  httpUrl(url);
  try { await navigator.clipboard.writeText(url); return; } catch { /* legacy or denied clipboard API */ }
  const previous = document.activeElement as HTMLElement | null;
  const input = document.createElement("textarea");
  input.value = url;
  input.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(input);
  try {
    input.select();
    if (!document.execCommand("copy")) throw new Error("Could not copy URL to clipboard");
  } finally { input.remove(); previous?.focus(); }
}

export async function openWindow(url: string, _title: string): Promise<string> {
  url = httpUrl(url);
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

export async function openWorkspace(urls: string[], resources: SearchResult[] = []): Promise<string> {
  urls = workspaceUrls(urls);
  if (!urls.length) throw new Error("Select at least one page");
  if (!IS_TAURI) {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ urls, resources }))));
    const url = `${window.location.pathname}?workspace=1&items=${encodeURIComponent(payload)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return "workspace";
  }
  return invoke<string>("open_workspace", { urls, resources });
}

export async function getWorkspaceItems(label: string): Promise<string[]> {
  if (!IS_TAURI) return workspaceItemsFromUrl();
  return invoke<string[]>("get_workspace_items", { label });
}

export async function getWorkspaceResources(label: string): Promise<SearchResult[]> {
  if (IS_TAURI) return invoke<SearchResult[]>("get_workspace_resources", { label });
  try {
    const raw = new URLSearchParams(window.location.search).get("items");
    const data = raw ? JSON.parse(decodeURIComponent(escape(atob(raw)))) : null;
    const urls = workspaceItemsFromUrl();
    return Array.isArray(data?.resources) ? data.resources.filter((r: unknown) => isSearchResult(r) && urls.includes(r.url)).slice(0, 4) : [];
  } catch { return []; }
}

function workspaceItemsFromUrl(): string[] {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("items");
  if (!raw) return [];
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(raw))));
    return workspaceUrls(Array.isArray(payload) ? payload : payload.urls);
  } catch {
    return [];
  }
}

function isSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object") return false;
  const r = value as SearchResult;
  try { httpUrl(r.url); } catch { return false; }
  return [r.id, r.source_id, r.source_name, r.title, r.result_type].every((v) => typeof v === "string")
    && (r.description === null || typeof r.description === "string")
    && Array.isArray(r.tags) && r.tags.every((t) => typeof t === "string");
}

export function normalizeSettings(value: unknown): Settings {
  const defaults = defaultSettings();
  if (!value || typeof value !== "object") return defaults;
  const s = value as Partial<Settings>;
  return {
    ...defaults,
    theme: ["system", "light", "dark"].includes(s.theme ?? "") ? s.theme! : defaults.theme,
    preview_mode: ["side", "inline", "off"].includes(s.preview_mode ?? "") ? s.preview_mode! : defaults.preview_mode,
    enabled_providers: Array.isArray(s.enabled_providers)
      ? [...new Set(s.enabled_providers.filter((id) => typeof id === "string"))] : defaults.enabled_providers,
    ui_locale: ["en", "zh-CN", "zh-TW"].includes(s.ui_locale ?? "") ? s.ui_locale! : defaults.ui_locale,
    translate_target: TARGET_LANGUAGES.some((l) => l.code === s.translate_target) ? s.translate_target! : defaults.translate_target,
    translate_results: s.translate_results === true,
    page_translate_proxy: typeof s.page_translate_proxy === "string" ? s.page_translate_proxy : "",
  };
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
    ui_locale: "en",
    translate_target: "zh-CN",
    translate_results: false,
    page_translate_proxy: "",
  };
}
