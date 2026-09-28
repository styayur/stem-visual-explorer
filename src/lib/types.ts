export type ResultType =
  | "article"
  | "interactive"
  | "simulation"
  | "applet"
  | "experiment"
  | "visualization"
  | "video"
  | "unknown";

export interface SearchResult {
  id: string;
  source_id: string;
  source_name: string;
  title: string;
  description: string | null;
  url: string;
  result_type: ResultType;
  tags: string[];
  score: number;
  thumbnail: string | null;
}

export type ProviderState = "idle" | "loading" | "done" | "error";

export interface ProviderStatus {
  id: string;
  name: string;
  homepage: string;
  state: ProviderState;
  count: number;
  error: string | null;
  indexed_items: number | null;
  last_updated: string | null;
  experimental: boolean;
  enabled: boolean;
}

export interface SearchResponse {
  query: string;
  expanded_terms: string[];
  results: SearchResult[];
  providers: ProviderStatus[];
  total: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  homepage: string;
  experimental: boolean;
  indexed_items: number | null;
  last_updated: string | null;
  enabled: boolean;
}

export interface Favorite {
  result: SearchResult;
  created_at: number;
}

export interface HistoryEntry {
  id: number;
  query: string;
  result_count: number;
  created_at: number;
}

export interface Settings {
  theme: "system" | "light" | "dark";
  preview_mode: "side" | "inline" | "off";
  enabled_providers: string[];
  mock_mode: boolean;
}

export const RESULT_TYPE_LABELS: Record<ResultType, string> = {
  article: "ARTICLE",
  interactive: "INTERACTIVE",
  simulation: "SIMULATION",
  applet: "APPLET",
  experiment: "EXPERIMENT",
  visualization: "VISUALIZATION",
  video: "VIDEO",
  unknown: "UNKNOWN",
};

export const RESULT_TYPES: ResultType[] = [
  "interactive",
  "simulation",
  "applet",
  "article",
  "experiment",
  "visualization",
  "video",
];