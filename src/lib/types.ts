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
  concept_ids?: string[];
  concept_evidence?: Record<string,string[]>;
  subject?: string[];
  language?: string;
  explanation?: import("./searchEngine").SearchExplanation;
  score: number;
  thumbnail: string | null;
}

export type PreviewCapability = "Embed" | "NativeCard" | "ExternalOnly";

export type ProviderState = "idle" | "loading" | "done" | "error";

export interface ProviderStatus {
  id: string;
  name: string;
  homepage: string;
  preview_capability?: PreviewCapability;
  state: ProviderState;
  count: number;
  error: string | null;
  indexed_items: number | null;
  last_updated: string | null;
  experimental: boolean;
  enabled: boolean;
}

export interface SearchResponse {
  unfiltered_total?: number;
  language_mapping_gap?: boolean;
  diagnostics?: import("./searchDiagnostics").SearchDiagnostics;
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
  preview_capability?: PreviewCapability;
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

export type UiLocale = "en" | "zh-CN" | "zh-TW";

export interface Settings {
  theme: "system" | "light" | "dark";
  preview_mode: "side" | "inline" | "off";
  enabled_providers: string[];
  mock_mode: boolean;
  /** App UI language. */
  ui_locale: UiLocale;
  /** Target language for content / page translation. */
  translate_target: string;
  /** Translate search result titles & descriptions in the UI. */
  translate_results: boolean;
  /** Optional custom page-translation proxy template ({url} / {lang}). */
  page_translate_proxy: string;
}

/** Target languages offered by the translation layer. */
export const TARGET_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ru", label: "Русский" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "th", label: "ไทย" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "tr", label: "Türkçe" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "uk", label: "Українська" },
];

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