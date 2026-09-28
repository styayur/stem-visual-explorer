import { create } from "zustand";
import * as cmd from "../lib/commands";
import type { SearchResult } from "../lib/types";

interface WorkspaceState {
  selected: SearchResult[];
  toggle: (result: SearchResult) => void;
  clear: () => void;
  open: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  selected: [],

  toggle: (result) => {
    const selected = get().selected;
    const exists = selected.some((r) => r.id === result.id);
    if (exists) {
      set({ selected: selected.filter((r) => r.id !== result.id) });
    } else {
      if (selected.length >= 4) return;
      set({ selected: [...selected, result] });
    }
  },

  clear: () => set({ selected: [] }),

  open: async () => {
    const selected = get().selected;
    if (selected.length === 0) return;
    await cmd.openWorkspace(selected.map((r) => r.url));
    set({ selected: [] });
  },
}));