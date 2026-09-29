import { create } from "zustand";
import * as cmd from "../lib/commands";
import type { Settings } from "../lib/types";
import { reportError } from "./noticeStore";

export type Page = "search" | "favorites" | "settings";

interface SettingsState {
  settings: Settings;
  page: Page;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Settings>) => Promise<void>;
  setPage: (page: Page) => void;
}

let saves = Promise.resolve();
let revision = 0;

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
  settings: cmd.defaultSettings(),
  page: "search",
  loaded: false,

  load: async () => {
    const started = revision;
    try {
      const settings = await cmd.getSettings();
      if (started === revision) { set({ settings }); applyTheme(settings.theme); }
    } catch (e) { reportError(e); }
    finally { set({ loaded: true }); }
  },

  update: async (patch) => {
    const version = ++revision;
    const previous = get().settings;
    const next = cmd.normalizeSettings({ ...previous, ...patch });
    set({ settings: next });
    applyTheme(next.theme);
    saves = saves.then(async () => {
      try { await cmd.saveSettings(next); }
      catch (error) {
        if (revision === version) { set({ settings: previous }); applyTheme(previous.theme); }
        reportError(error);
      }
    });
    await saves;
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
