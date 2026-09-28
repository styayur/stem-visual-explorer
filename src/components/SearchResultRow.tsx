import { memo, useRef, useState } from "react";
import { ExternalLink, LayoutPanelTop, MoreHorizontal, Star } from "lucide-react";
import type { SearchResult } from "../lib/types";
import { RESULT_TYPE_LABELS } from "../lib/types";
import { useSearchStore } from "../stores/searchStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import * as cmd from "../lib/commands";
import { cn } from "../lib/cn";
import { Badge } from "./ui";

export const RESULT_ROW_HEIGHT = 92;

const ResultRow = memo(function ResultRow({
  result,
  index,
  selected,
  onSelect,
}: {
  result: SearchResult;
  index: number;
  selected: boolean;
  onSelect: (index: number) => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const isFav = useSearchStore((s) => s.favoriteIds.has(result.id));
  const toggleFavorite = useSearchStore((s) => s.toggleFavorite);
  const setQuickLook = useSearchStore((s) => s.setQuickLook);
  const toggleWorkspace = useWorkspaceStore((s) => s.toggle);

  const openWindow = () => cmd.openWindow(result.url, `${result.title} — ${result.source_name}`);

  return (
    <div
      ref={rowRef}
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(index)}
      onDoubleClick={openWindow}
      onAuxClick={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          openWindow();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      className={cn(
        "group cursor-default border-b border-edge-light/70 px-3 py-2 transition-colors dark:border-edge-dark/70",
        selected
          ? "sve-selected bg-indigo-500/5 dark:bg-indigo-500/10"
          : "hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50"
      )}
      style={{ height: RESULT_ROW_HEIGHT }}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
          {result.source_name}
        </span>
        <Badge tone="muted">{RESULT_TYPE_LABELS[result.result_type]}</Badge>
        <button
          type="button"
          title={isFav ? "Remove favorite" : "Add favorite"}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(result);
          }}
          className={cn(
            "ml-auto rounded p-1 transition-colors",
            isFav
              ? "text-amber-500"
              : "text-zinc-300 opacity-0 hover:text-amber-500 group-hover:opacity-100 dark:text-zinc-600"
          )}
        >
          <Star className="h-3.5 w-3.5" fill={isFav ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          title="Add to workspace"
          onClick={(e) => {
            e.stopPropagation();
            toggleWorkspace(result);
          }}
          className="rounded p-1 text-zinc-300 opacity-0 hover:text-indigo-500 group-hover:opacity-100 dark:text-zinc-600"
        >
          <LayoutPanelTop className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Open in new window"
          onClick={(e) => {
            e.stopPropagation();
            openWindow();
          }}
          className="rounded p-1 text-zinc-300 opacity-0 hover:text-indigo-500 group-hover:opacity-100 dark:text-zinc-600"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-0.5 line-clamp-2 text-[14px] font-medium leading-snug text-zinc-800 dark:text-zinc-100">
        {result.title}
      </div>
      {result.description && (
        <div className="line-clamp-1 text-[12px] text-zinc-500 dark:text-zinc-400">
          {result.description}
        </div>
      )}
      {result.tags.length > 0 && (
        <div className="mt-0.5 flex items-center gap-1 overflow-hidden text-[11px] text-zinc-400 dark:text-zinc-500">
          {result.tags.slice(0, 4).map((t) => (
            <span key={t} className="truncate">
              {t}
            </span>
          ))}
        </div>
      )}

      {menu && (
        <ResultMenu
          x={menu.x}
          y={menu.y}
          result={result}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
});

function ResultMenu({
  x,
  y,
  result,
  onClose,
}: {
  x: number;
  y: number;
  result: SearchResult;
  onClose: () => void;
}) {
  const toggleFavorite = useSearchStore((s) => s.toggleFavorite);
  const isFav = useSearchStore((s) => s.favoriteIds.has(result.id));

  const items: Array<{ label: string; run: () => void }> = [
    { label: "Open", run: () => cmd.openWindow(result.url, `${result.title} — ${result.source_name}`) },
    { label: "Open in New Window", run: () => cmd.openWindow(result.url, `${result.title} — ${result.source_name}`) },
    { label: "Open in System Browser", run: () => cmd.openExternal(result.url) },
    { label: "Copy URL", run: () => navigator.clipboard?.writeText(result.url) },
    { label: isFav ? "Remove Favorite" : "Favorite", run: () => toggleFavorite(result) },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="fixed z-50 min-w-[190px] rounded-lg border border-edge-light bg-white py-1 shadow-xl dark:border-edge-dark dark:bg-surface-dark"
        style={{ left: Math.min(x, window.innerWidth - 210), top: Math.min(y, window.innerHeight - 220) }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="block w-full px-3 py-1.5 text-left text-[13px] text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            onClick={() => {
              item.run();
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

export default ResultRow;