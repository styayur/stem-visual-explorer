import { create } from "zustand";
import * as cmd from "../lib/commands";
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
  openSelectedInWindow: () => Promise<void>;
  openSelectedExternal: () => Promise<void>;
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
    const query = (q ?? get().query).trim();
    if (query.length === 0) {
      set({ response: null, loading: false, selectedId: null, selectedIndex: -1 });
      return;
    }
    set({ loading: true, error: null, query });
    try {
      const response = await cmd.runSearch(query, forceRefresh);
      set({
        response,
        loading: false,
        expandedTerms: response.expanded_terms,
        selectedId: response.results[0]?.id ?? null,
        selectedIndex: response.results.length > 0 ? 0 : -1,
      });
      await cmd.addHistory(query, response.total);
      await get().loadHistory();
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  setSiteFilter: (id) => set({ siteFilter: id, selectedIndex: -1, selectedId: null }),

  setTypeFilter: (t) => set({ typeFilter: t, selectedIndex: -1, selectedId: null }),

  select: (index) => {
    const results = visibleResults();
    if (index < 0 || index >= results.length) return;
    set({ selectedIndex: index, selectedId: results[index].id });
  },

  selectById: (id) => {
    const results = visibleResults();
    const idx = results.findIndex((r) => r.id === id);
    set({ selectedId: id, selectedIndex: idx });
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
    const isFav = get().favoriteIds.has(r.id);
    if (isFav) {
      await cmd.removeFavorite(r.id);
    } else {
      await cmd.addFavorite(r);
    }
    await get().loadFavorites();
  },

  isFavorite: (id) => get().favoriteIds.has(id),

  loadHistory: async () => {
    const history = await cmd.listHistory();
    set({ history });
  },

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
  if (!response) return [];
  let results = response.results;
  if (siteFilter) results = results.filter((r) => r.source_id === siteFilter);
  if (typeFilter !== "all") results = results.filter((r) => r.result_type === typeFilter);
  return results;
}

export function selectedResult(): SearchResult | null {
  const { selectedId, response } = useSearchStore.getState();
  if (!response || !selectedId) return null;
  return response.results.find((r) => r.id === selectedId) ?? null;
}