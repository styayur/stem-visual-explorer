import { invoke } from "@tauri-apps/api/core";
import type {
  Favorite,
  HistoryEntry,
  ProviderInfo,
  SearchResponse,
  SearchResult,
  Settings,
} from "./types";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function runSearch(
  query: string,
  forceRefresh: boolean
): Promise<SearchResponse> {
  if (!isTauri()) return mockSearch(query);
  return invoke<SearchResponse>("search", { query, forceRefresh });
}

export async function providersInfo(): Promise<ProviderInfo[]> {
  if (!isTauri()) return [];
  return invoke<ProviderInfo[]>("providers_info");
}

export async function refreshProviderIndex(id: string): Promise<ProviderInfo> {
  return invoke<ProviderInfo>("refresh_provider_index", { id });
}

export async function setProviderEnabled(id: string, enabled: boolean): Promise<void> {
  return invoke("set_provider_enabled", { id, enabled });
}

export async function clearCache(): Promise<number> {
  return invoke<number>("clear_cache");
}

export async function getSettings(): Promise<Settings> {
  if (!isTauri()) return defaultSettings();
  return invoke<Settings>("get_settings");
}

export async function saveSettings(settings: Settings): Promise<void> {
  return invoke("save_settings", { settings });
}

export async function listFavorites(): Promise<Favorite[]> {
  if (!isTauri()) return [];
  return invoke<Favorite[]>("list_favorites");
}

export async function addFavorite(result: SearchResult): Promise<void> {
  return invoke("add_favorite", { result });
}

export async function removeFavorite(id: string): Promise<void> {
  return invoke("remove_favorite", { id });
}

export async function listHistory(): Promise<HistoryEntry[]> {
  if (!isTauri()) return [];
  return invoke<HistoryEntry[]>("list_history");
}

export async function addHistory(query: string, resultCount: number): Promise<void> {
  return invoke("add_history", { query, resultCount });
}

export async function clearHistory(): Promise<void> {
  return invoke("clear_history");
}

export async function openExternal(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke("open_external", { url });
}

export async function openWindow(url: string, title: string): Promise<string> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return "browser";
  }
  return invoke<string>("open_window", { url, title });
}

export async function closeWindow(label: string): Promise<void> {
  return invoke("close_window", { label });
}

export async function togglePin(label: string): Promise<boolean> {
  return invoke<boolean>("toggle_pin", { label });
}

export async function openWorkspace(urls: string[]): Promise<string> {
  if (!isTauri()) {
    window.open(urls[0], "_blank", "noopener,noreferrer");
    return "workspace";
  }
  return invoke<string>("open_workspace", { urls });
}

export async function getWorkspaceItems(label: string): Promise<string[]> {
  return invoke<string[]>("get_workspace_items", { label });
}

function defaultSettings(): Settings {
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
    mock_mode: true,
  };
}

// Development-only mock so `npm run dev` in a plain browser shows a working UI.
function mockSearch(query: string): SearchResponse {
  const q = query.trim().toLowerCase() || "gradient";
  const mk = (
    source_id: string,
    source_name: string,
    title: string,
    description: string,
    url: string,
    result_type: SearchResult["result_type"],
    tags: string[]
  ): SearchResult => ({
    id: `${source_id}::${url}`,
    source_id,
    source_name,
    title,
    description,
    url,
    result_type,
    tags,
    score: 0,
    thumbnail: null,
  });

  const results: SearchResult[] = [
    mk("mathinsight", "Math Insight", "The gradient vector", "An introduction to the gradient of a multivariable function.", "https://mathinsight.org/gradient", "interactive", ["gradient", "vector"]),
    mk("mathinsight", "Math Insight", "The idea of the curl of a vector field", "An intuitive introduction to microscopic rotation and circulation.", "https://mathinsight.org/curl_idea", "interactive", ["curl", "vector field", "circulation"]),
    mk("falstad", "Falstad", "2-D Vector Fields", "Interactive vector field visualization, including divergence and curl.", "https://falstad.com/vector2dc/", "applet", ["vector field", "curl", "divergence"]),
    mk("falstad", "Falstad", "Fourier Series Applet", "Visualize how sinusoidal waves combine into arbitrary waveforms.", "https://falstad.com/fourier/", "applet", ["fourier", "waves"]),
    mk("phet", "PhET", "Wave on a String", "Explore the wonderful world of waves with an interactive string.", "https://phet.colorado.edu/en/simulations/wave-on-a-string", "simulation", ["wave", "frequency", "amplitude"]),
  ];
  const filtered = results.filter((r) => {
    const hay = `${r.title} ${r.description ?? ""} ${r.tags.join(" ")}`.toLowerCase();
    return q.split(/\s+/).every((t) => hay.includes(t)) || hay.includes(q);
  });
  return {
    query,
    expanded_terms: q.split(/\s+/),
    results: filtered.length > 0 ? filtered : results,
    providers: [
      { id: "mathinsight", name: "Math Insight", homepage: "https://mathinsight.org/", state: "done", count: 2, error: null, indexed_items: 100, last_updated: "2026-09-28", experimental: false, enabled: true },
      { id: "falstad", name: "Falstad", homepage: "https://falstad.com/", state: "done", count: 2, error: null, indexed_items: 48, last_updated: "2026-09-28", experimental: false, enabled: true },
      { id: "phet", name: "PhET", homepage: "https://phet.colorado.edu/", state: "done", count: 1, error: null, indexed_items: 120, last_updated: "2026-09-28", experimental: false, enabled: true },
    ],
    total: filtered.length > 0 ? filtered.length : results.length,
  };
}