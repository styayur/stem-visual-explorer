import { create } from "zustand";
import * as cmd from "../lib/commands";
import { attempt, reportError } from "./noticeStore";
import type {
  Favorite,
  HistoryEntry,
  ResultType,
  SearchResponse,
  SearchResult,
} from "../lib/types";

export type TypeFilter = "all" | ResultType;

interface SearchState {
  query: string;
  response: SearchResponse | null;
  loading: boolean;
  error: string | null;
  siteFilter: string | null;
  typeFilter: TypeFilter;
  selectedId: string | null;
  selectedIndex: number;
  quickLook: SearchResult | null;
  favorites: Favorite[];
  favoriteIds: Set<string>;
  history: HistoryEntry[];
  expandedTerms: string[];

  setQuery: (q: string) => void;
  runSearch: (q?: string, forceRefresh?: boolean) => Promise<void>;
  setSiteFilter: (id: string | null) => void;
  setTypeFilter: (t: TypeFilter) => void;
  select: (index: number) => void;
  selectById: (id: string) => void;
  setQuickLook: (r: SearchResult | null) => void;
  moveSelection: (delta: number) => void;
  loadFavorites: () => Promise<void>;
  toggleFavorite: (r: SearchResult) => Promise<void>;
  isFavorite: (id: string) => boolean;
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  openSelectedInWindow: () => Promise<void>;
  openSelectedExternal: () => Promise<void>;
}

let searchVersion = 0;
let favoriteQueue = Promise.resolve();

function filterResults(response: SearchResponse | null, site: string | null, type: TypeFilter) {
  return (response?.results ?? []).filter((r) => (!site || r.source_id === site) && (type === "all" || r.result_type === type));
}

function firstSelection(results: SearchResult[]) {
  return { selectedId: results[0]?.id ?? null, selectedIndex: results.length ? 0 : -1 };
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  response: null,
  loading: false,
  error: null,
  siteFilter: null,
  typeFilter: "all",
  selectedId: null,
  selectedIndex: -1,
  quickLook: null,
  favorites: [],
  favoriteIds: new Set<string>(),
  history: [],
  expandedTerms: [],

  setQuery: (q) => set({ query: q }),

  runSearch: async (q, forceRefresh = false) => {
    const version = ++searchVersion;
    const query = (q ?? get().query).trim();
    if (query.length === 0) {
      set({ query, response: null, error: null, expandedTerms: [], quickLook: null, loading: false, selectedId: null, selectedIndex: -1 });
      return;
    }
    set({ loading: true, error: null, query, quickLook: null, selectedId: null, selectedIndex: -1 });
    try {
      const response = await cmd.runSearch(query, forceRefresh);
      if (version !== searchVersion) return;
      set({
        response,
        loading: false,
        expandedTerms: response.expanded_terms,
        ...firstSelection(filterResults(response, get().siteFilter, get().typeFilter)),
      });
      await attempt(async () => {
        await cmd.addHistory(query, response.total);
        await get().loadHistory();
      });
    } catch (e) {
      if (version === searchVersion) set({ response: null, expandedTerms: [], loading: false, error: String(e) });
    }
  },

  setSiteFilter: (id) => set({ siteFilter: id, quickLook: null, ...firstSelection(filterResults(get().response, id, get().typeFilter)) }),

  setTypeFilter: (t) => set({ typeFilter: t, quickLook: null, ...firstSelection(filterResults(get().response, get().siteFilter, t)) }),

  select: (index) => {
    const results = visibleResults();
    if (index < 0 || index >= results.length) return;
    set({ selectedIndex: index, selectedId: results[index].id });
  },

  selectById: (id) => {
    const results = visibleResults();
    const idx = results.findIndex((r) => r.id === id);
    set({ selectedId: idx >= 0 ? id : null, selectedIndex: idx });
  },

  setQuickLook: (r) => set({ quickLook: r }),

  moveSelection: (delta) => {
    const { selectedIndex } = get();
    const results = visibleResults();
    if (results.length === 0) return;
    const next = Math.max(0, Math.min(results.length - 1, selectedIndex + delta));
    get().select(next);
  },

  loadFavorites: async () => {
    const favorites = await cmd.listFavorites();
    set({
      favorites,
      favoriteIds: new Set(favorites.map((f) => f.result.id)),
    });
  },

  toggleFavorite: async (r) => {
    favoriteQueue = favoriteQueue.then(async () => {
      if (get().favoriteIds.has(r.id)) await cmd.removeFavorite(r.id);
      else await cmd.addFavorite(r);
      await get().loadFavorites();
    }).catch(reportError);
    await favoriteQueue;
  },

  isFavorite: (id) => get().favoriteIds.has(id),

  loadHistory: async () => {
    const history = await cmd.listHistory();
    set({ history });
  },

  clearHistory: async () => { await attempt(async () => { await cmd.clearHistory(); set({ history: [] }); }); },

  openSelectedInWindow: async () => {
    const r = selectedResult();
    if (r) await cmd.openWindow(r.url, `${r.title} — ${r.source_name}`);
  },

  openSelectedExternal: async () => {
    const r = selectedResult();
    if (r) await cmd.openExternal(r.url);
  },
}));

// Helpers attached to the store prototype for reuse across components.
export function visibleResults(): SearchResult[] {
  const { response, siteFilter, typeFilter } = useSearchStore.getState();
  return filterResults(response, siteFilter, typeFilter);
}

export function selectedResult(): SearchResult | null {
  const { selectedId, response } = useSearchStore.getState();
  if (!response || !selectedId) return null;
  return visibleResults().find((r) => r.id === selectedId) ?? null;
}
