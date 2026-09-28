import { LayoutGrid } from "lucide-react";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import SourceSidebar from "../components/SourceSidebar";
import SearchResults from "../components/SearchResults";
import PreviewPane from "../components/PreviewPane";
import QuickLook from "../components/QuickLook";
import { useSearchStore } from "../stores/searchStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { cn } from "../lib/cn";

export default function SearchPage() {
  const previewMode = useSettingsStore((s) => s.settings.preview_mode);
  const expandedTerms = useSearchStore((s) => s.expandedTerms);
  const workspaceSelected = useWorkspaceStore((s) => s.selected);
  const openWorkspace = useWorkspaceStore((s) => s.open);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-edge-light bg-white px-3 py-2 dark:border-edge-dark dark:bg-surface-dark">
        <div className="max-w-2xl flex-1">
          <SearchBar />
        </div>
        <button
          type="button"
          onClick={openWorkspace}
          disabled={workspaceSelected.length === 0}
          title={
            workspaceSelected.length === 0
              ? "Select results to build a workspace"
              : `Open workspace (${workspaceSelected.length} selected)`
          }
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-2 text-[12px] font-medium transition-colors",
            workspaceSelected.length === 0
              ? "cursor-not-allowed border-edge-light text-zinc-400 dark:border-edge-dark"
              : "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-300"
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden md:inline">Workspace</span>
          {workspaceSelected.length > 0 && (
            <span className="rounded bg-indigo-500 px-1.5 text-[10px] font-bold text-white">
              {workspaceSelected.length}
            </span>
          )}
        </button>
      </div>

      {expandedTerms.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-edge-light bg-canvas-light px-3 py-1.5 dark:border-edge-dark dark:bg-canvas-dark">
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-400">
            expanded
          </span>
          {expandedTerms.slice(0, 12).map((t) => (
            <span
              key={t}
              className="shrink-0 rounded-full bg-zinc-200/70 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="w-[210px] shrink-0">
          <SourceSidebar />
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <FilterBar />
          <div className="min-h-0 flex-1">
            <SearchResults />
          </div>
        </section>

        {previewMode === "side" && (
          <aside className="hidden w-[38%] min-w-[320px] shrink-0 border-l border-edge-light bg-white dark:border-edge-dark dark:bg-surface-dark lg:block">
            <PreviewPane />
          </aside>
        )}
      </div>

      {previewMode === "inline" && <InlinePreview />}
      <QuickLook />
    </div>
  );
}

function InlinePreview() {
  return (
    <div className="h-[42%] border-t border-edge-light bg-white dark:border-edge-dark dark:bg-surface-dark">
      <PreviewPane />
    </div>
  );
}