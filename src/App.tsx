import { useEffect, useRef, useState } from "react";
import {
  BookMarked,
  Check,
  Languages,
  Moon,
  Search,
  Settings,
  Sun,
  SunMoon,
} from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useSettingsStore, type Page } from "./stores/settingsStore";
import { useSearchStore } from "./stores/searchStore";
import { installShortcuts } from "./lib/shortcuts";
import { useT, UI_LOCALES } from "./lib/i18n";
import { TARGET_LANGUAGES, type UiLocale } from "./lib/types";
import { cn } from "./lib/cn";
import { IconButton } from "./components/ui";
import Workspace from "./components/Workspace";
import SearchPage from "./pages/SearchPage";
import FavoritesPage from "./pages/FavoritesPage";
import SettingsPage from "./pages/SettingsPage";
import { reportError, useNoticeStore } from "./stores/noticeStore";

export default function App() {
  const t = useT();
  const page = useSettingsStore((s) => s.page);
  const setPage = useSettingsStore((s) => s.setPage);
  const theme = useSettingsStore((s) => s.settings.theme);
  const locale = useSettingsStore((s) => s.settings.ui_locale);
  const update = useSettingsStore((s) => s.update);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadFavorites = useSearchStore((s) => s.loadFavorites);
  const loadHistory = useSearchStore((s) => s.loadHistory);
  const [isWorkspace, setIsWorkspace] = useState(false);
  const notice = useNoticeStore((s) => s.error);
  const clearNotice = useNoticeStore((s) => s.clear);

  useEffect(() => {
    loadSettings().catch(reportError);
    loadFavorites().catch(reportError);
    loadHistory().catch(reportError);
  }, [loadSettings, loadFavorites, loadHistory]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("route") === "search") return;
    if (params.get("workspace") === "1" || params.get("route") === "workspace") {
      setIsWorkspace(true);
      return;
    }
    try {
      setIsWorkspace(getCurrentWebviewWindow().label.startsWith("workspace-"));
    } catch {
      setIsWorkspace(false);
    }
  }, []);

  useEffect(() => isWorkspace ? undefined : installShortcuts(), [isWorkspace]);

  if (isWorkspace) return <Workspace />;

  return (
    <div className="flex h-screen flex-col bg-canvas-light text-zinc-800 dark:bg-canvas-dark dark:text-zinc-100">
      <header className="flex items-center gap-2 border-b border-edge-light bg-white px-3 py-2 dark:border-edge-dark dark:bg-surface-dark">
        <div className="mr-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 via-indigo-500 to-purple-500 text-[12px] font-bold text-white">
            SVE
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold">STEM Visual Explorer</div>
            <div className="hidden text-[10px] text-zinc-400 sm:block">{t("app.subtitle")}</div>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <NavButton
            active={page === "search"}
            onClick={() => setPage("search")}
            icon={<Search className="h-3.5 w-3.5" />}
            label={t("nav.search")}
          />
          <NavButton
            active={page === "favorites"}
            onClick={() => setPage("favorites")}
            icon={<BookMarked className="h-3.5 w-3.5" />}
            label={t("nav.favorites")}
          />
          <NavButton
            active={page === "settings"}
            onClick={() => setPage("settings")}
            icon={<Settings className="h-3.5 w-3.5" />}
            label={t("nav.settings")}
          />
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <LanguageMenu />
          <ThemeButton
            theme={theme}
            label={t("theme.tooltip", {
              theme: t(
                theme === "system" ? "theme.system" : theme === "light" ? "theme.light" : "theme.dark"
              ),
            })}
            onCycle={() => {
              const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
              update({ theme: next });
            }}
          />
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {notice && <div role="alert" className="fixed bottom-4 left-4 right-4 z-[60] flex items-center gap-3 rounded-lg border border-red-400 bg-white p-3 text-sm text-red-700 shadow-lg dark:bg-zinc-900 dark:text-red-300">
          <span className="min-w-0 flex-1 break-words">{notice}</span>
          <button type="button" onClick={clearNotice} aria-label={t("common.close")}>×</button>
        </div>}
        {page === "search" && <SearchPage />}
        {page === "favorites" && <FavoritesPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
          : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ThemeButton({
  theme,
  label,
  onCycle,
}: {
  theme: string;
  label: string;
  onCycle: () => void;
}) {
  const icon =
    theme === "system" ? (
      <SunMoon className="h-4 w-4" />
    ) : theme === "light" ? (
      <Sun className="h-4 w-4" />
    ) : (
      <Moon className="h-4 w-4" />
    );
  return (
    <IconButton title={label} onClick={onCycle}>
      {icon}
    </IconButton>
  );
}

/** Header popover: UI language + content translation settings. */
function LanguageMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <IconButton title={t("settings.translation")} active={open} onClick={() => setOpen((v) => !v)}>
        <Languages className="h-4 w-4" />
      </IconButton>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-[268px] rounded-lg border border-edge-light bg-white p-3 text-[13px] shadow-xl dark:border-edge-dark dark:bg-surface-dark">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {t("settings.uiLanguage")}
          </div>
          <div className="mb-3 space-y-1">
            {UI_LOCALES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => update({ ui_locale: l.code as UiLocale })}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left",
                  settings.ui_locale === l.code
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                <span>{l.label}</span>
                {settings.ui_locale === l.code && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {t("settings.targetLanguage")}
          </div>
          <select
            value={settings.translate_target}
            onChange={(e) => update({ translate_target: e.target.value })}
            className="mb-3 w-full rounded-md border border-edge-light bg-white px-2 py-1.5 text-[12px] dark:border-edge-dark dark:bg-surface-dark dark:text-zinc-200"
          >
            {TARGET_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>

          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={settings.translate_results}
              onChange={(e) => update({ translate_results: e.target.checked })}
              className="mt-0.5 h-3.5 w-3.5 accent-indigo-500"
            />
            <span className="text-[12px] leading-snug">{t("settings.translateResults")}</span>
          </label>
        </div>
      )}
    </div>
  );
}
