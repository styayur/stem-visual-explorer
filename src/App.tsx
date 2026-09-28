import { useEffect, useState } from "react";
import { BookMarked, Moon, Search, Settings, Sun, SunMoon } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useSettingsStore, type Page } from "./stores/settingsStore";
import { useSearchStore } from "./stores/searchStore";
import { installShortcuts } from "./lib/shortcuts";
import { cn } from "./lib/cn";
import { IconButton } from "./components/ui";
import Workspace from "./components/Workspace";
import SearchPage from "./pages/SearchPage";
import FavoritesPage from "./pages/FavoritesPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const page = useSettingsStore((s) => s.page);
  const setPage = useSettingsStore((s) => s.setPage);
  const theme = useSettingsStore((s) => s.settings.theme);
  const update = useSettingsStore((s) => s.update);
  const loadSettings = useSettingsStore((s) => s.load);
  const loadFavorites = useSearchStore((s) => s.loadFavorites);
  const loadHistory = useSearchStore((s) => s.loadHistory);
  const [isWorkspace, setIsWorkspace] = useState(false);

  useEffect(() => {
    loadSettings().catch(() => {});
    loadFavorites().catch(() => {});
    loadHistory().catch(() => {});
  }, [loadSettings, loadFavorites, loadHistory]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const win = getCurrentWebviewWindow();
        if (mounted) setIsWorkspace(win.label.startsWith("workspace-"));
      } catch {
        if (mounted) {
          setIsWorkspace(
            new URLSearchParams(window.location.search).get("route") === "workspace"
          );
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => installShortcuts(), []);

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
            <div className="hidden text-[10px] text-zinc-400 sm:block">
              Visual search for mathematics and physics.
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <NavButton active={page === "search"} onClick={() => setPage("search")} icon={<Search className="h-3.5 w-3.5" />} label="Search" />
          <NavButton active={page === "favorites"} onClick={() => setPage("favorites")} icon={<BookMarked className="h-3.5 w-3.5" />} label="Favorites" />
          <NavButton active={page === "settings"} onClick={() => setPage("settings")} icon={<Settings className="h-3.5 w-3.5" />} label="Settings" />
        </nav>

        <div className="ml-auto">
          <ThemeButton
            theme={theme}
            onCycle={() => {
              const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
              update({ theme: next });
            }}
          />
        </div>
      </header>

      <main className="min-h-0 flex-1">
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

function ThemeButton({ theme, onCycle }: { theme: string; onCycle: () => void }) {
  const icon = theme === "system" ? <SunMoon className="h-4 w-4" /> : theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />;
  return <IconButton title={`Theme: ${theme}`} onClick={onCycle}>{icon}</IconButton>;
}