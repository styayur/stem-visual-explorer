import { memo, useRef, useState } from "react";
import { ExternalLink, LayoutPanelTop, Star } from "lucide-react";
import type { SearchResult } from "../lib/types";
import { useSearchStore } from "../stores/searchStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useT, typeLabelKey } from "../lib/i18n";
import { useTranslatedText } from "../lib/translate/useTranslatedText";
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
  const t = useT();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const isFav = useSearchStore((s) => s.favoriteIds.has(result.id));
  const toggleFavorite = useSearchStore((s) => s.toggleFavorite);
  const toggleWorkspace = useWorkspaceStore((s) => s.toggle);

  const translateOn = useSettingsStore((s) => s.settings.translate_results);
  const target = useSettingsStore((s) => s.settings.translate_target);
  const titleT = useTranslatedText(result.title, translateOn, target);
  const descT = useTranslatedText(result.description, translateOn, target);

  const title = titleT?.text ?? result.title;
  const description = descT?.text ?? result.description;
  const translated = Boolean(titleT && titleT.text !== result.title);

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
        <Badge tone="muted">{t(typeLabelKey(result.result_type))}</Badge>
        {translated && <Badge tone="accent">{t("common.translated")}</Badge>}
        <button
          type="button"
          title={isFav ? t("row.unfavorite") : t("row.favorite")}
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
          title={t("row.workspace")}
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
          title={t("row.openWindow")}
          onClick={(e) => {
            e.stopPropagation();
            openWindow();
          }}
          className="rounded p-1 text-zinc-300 opacity-0 hover:text-indigo-500 group-hover:opacity-100 dark:text-zinc-600"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        title={translated ? result.title : undefined}
        className="mt-0.5 line-clamp-2 text-[14px] font-medium leading-snug text-zinc-800 dark:text-zinc-100"
      >
        {title}
      </div>
      {description && (
        <div
          title={translated ? result.description ?? undefined : undefined}
          className="line-clamp-1 text-[12px] text-zinc-500 dark:text-zinc-400"
        >
          {description}
        </div>
      )}
      {result.tags.length > 0 && (
        <div className="mt-0.5 flex items-center gap-1 overflow-hidden text-[11px] text-zinc-400 dark:text-zinc-500">
          {result.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="truncate">
              {tag}
            </span>
          ))}
        </div>
      )}

      {menu && (
        <ResultMenu x={menu.x} y={menu.y} result={result} onClose={() => setMenu(null)} />
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
  const t = useT();
  const toggleFavorite = useSearchStore((s) => s.toggleFavorite);
  const isFav = useSearchStore((s) => s.favoriteIds.has(result.id));

  const items: Array<{ label: string; run: () => void }> = [
    {
      label: t("ctx.open"),
      run: () => cmd.openWindow(result.url, `${result.title} — ${result.source_name}`),
    },
    {
      label: t("ctx.openWindow"),
      run: () => cmd.openWindow(result.url, `${result.title} — ${result.source_name}`),
    },
    { label: t("ctx.openBrowser"), run: () => cmd.openExternal(result.url) },
    { label: t("ctx.copyUrl"), run: () => navigator.clipboard?.writeText(result.url) },
    {
      label: isFav ? t("ctx.unfavorite") : t("ctx.favorite"),
      run: () => toggleFavorite(result),
    },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-50 min-w-[190px] rounded-lg border border-edge-light bg-white py-1 shadow-xl dark:border-edge-dark dark:bg-surface-dark"
        style={{
          left: Math.min(x, window.innerWidth - 210),
          top: Math.min(y, window.innerHeight - 220),
        }}
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