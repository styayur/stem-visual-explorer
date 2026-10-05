import SearchContext from "../components/SearchContext";
import { LayoutGrid } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import SourceSidebar from "../components/SourceSidebar";
import SearchResults from "../components/SearchResults";
import PreviewPane from "../components/PreviewPane";
import QuickLook from "../components/QuickLook";
import { useSettingsStore } from "../stores/settingsStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { useWorkbenchStore } from "../workbench/workbenchStore";
const ConceptWorkbench = lazy(() => import("../workbench/ConceptWorkbench"));
const CommandPalette = lazy(() => import("../commands/CommandPalette"));
import { useSearchStore } from "../stores/searchStore";

export default function SearchPage() {
  const t = useT();
  const previewMode = useSettingsStore((s) => s.settings.preview_mode);
  const response = useSearchStore((s) => s.response);
  const session = useWorkbenchStore(s=>s.session);
  const paletteOpen = useWorkbenchStore(s=>s.paletteOpen);
  const resume = useWorkbenchStore(s=>s.resume);
  const trigger = useRef<HTMLElement | null>(null);
  const openConcept = (id: string) => {
    trigger.current = document.activeElement as HTMLElement;
    useWorkbenchStore.getState().open(id, {type:"search",query:response?.query});
  };
  const closeConcept = () => {
    const id=useWorkbenchStore.getState().session?.conceptId;
    const originId=useWorkbenchStore.getState().session?.trail[0]?.conceptId;
    useWorkbenchStore.getState().close();
    requestAnimationFrame(() => {
      const chip=document.querySelector<HTMLElement>(`[data-concept-id="${originId??id}"]`);
      if(chip)chip.focus();else if(trigger.current?.isConnected)trigger.current.focus();else document.getElementById("search-input")?.focus();
    });
  };

  const workspaceSelected = useWorkspaceStore((s) => s.selected);
  const openWorkspace = useWorkspaceStore((s) => s.open);
  const [wide, setWide] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

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
              ? t("workspace.select")
              : `${t("workspace.title")} (${workspaceSelected.length})`
          }
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-2 text-[12px] font-medium transition-colors",
            workspaceSelected.length === 0
              ? "cursor-not-allowed border-edge-light text-zinc-400 dark:border-edge-dark"
              : "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-300",
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden md:inline">{t("workspace.title")}</span>
          {workspaceSelected.length > 0 && (
            <span className="rounded bg-indigo-500 px-1.5 text-[10px] font-bold text-white">
              {workspaceSelected.length}
            </span>
          )}
        </button>
      </div>

      {paletteOpen&&<Suspense fallback={null}><CommandPalette/></Suspense>}
      {!session&&<SearchContext onConcept={openConcept} />}
      {!session&&resume&&<button className="text-left text-xs px-3 py-1 text-indigo-600 dark:text-indigo-300" onClick={()=>useWorkbenchStore.getState().restore()}>{useSettingsStore.getState().settings.ui_locale==="en"?"Resume Concept Session":useSettingsStore.getState().settings.ui_locale==="zh-CN"?"继续概念会话":"繼續概念工作階段"}</button>}

      {session ? (
        <div className="min-h-0 flex-1" data-learning-surface>
          <Suspense fallback={<p role="status">{t("common.loading")}</p>}><ConceptWorkbench key={session.conceptId} onClose={closeConcept}/></Suspense>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1">
            <aside className="w-[130px] shrink-0 sm:w-[210px]">
              <SourceSidebar />
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
              <FilterBar />
              <div className="min-h-0 flex-1">
                <SearchResults />
              </div>
            </section>

            {previewMode === "side" && wide && (
              <aside className="hidden w-[38%] min-w-[320px] shrink-0 border-l border-edge-light bg-white dark:border-edge-dark dark:bg-surface-dark lg:block">
                <PreviewPane />
              </aside>
            )}
          </div>

          {previewMode === "inline" && <InlinePreview />}
          {previewMode === "side" && !wide && (
            <div className="h-[38%] min-h-0 border-t border-edge-light dark:border-edge-dark">
              <PreviewPane />
            </div>
          )}
          <QuickLook />
        </>
      )}
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
