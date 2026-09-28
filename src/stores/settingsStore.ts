import { create } from "zustand";
import * as cmd from "../lib/commands";
import type { Settings } from "../lib/types";

export type Page = "search" | "favorites" | "settings";

interface SettingsState {
  settings: Settings;
  page: Page;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  setPage: (page: Page) => void;
}

const DEFAULTS: Settings = {
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

function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULTS,
  page: "search",
  loaded: false,

  load: async () => {
    const settings = await cmd.getSettings();
    set({ settings, loaded: true });
    applyTheme(settings.theme);
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    applyTheme(next.theme);
    await cmd.saveSettings(next);
  },

  setPage: (page) => set({ page }),
}));

// Keep the document theme in sync with OS preference changes.
if (typeof window !== "undefined") {
  window
    .matchMedia?.("(prefers-color-scheme: dark)")
    ?.addEventListener("change", () => {
      const { settings } = useSettingsStore.getState();
      applyTheme(settings.theme);
    });
}