import { useMemo, useState } from "react";
import { Copy, ExternalLink, Maximize2, RotateCw, Star } from "lucide-react";
import { selectedResult, useSearchStore } from "../stores/searchStore";
import * as cmd from "../lib/commands";
import { Badge, IconButton } from "./ui";
import { RESULT_TYPE_LABELS } from "../lib/types";

export default function PreviewPane() {
  const result = useSearchStore((s) => {
    const r = selectedResult();
    return r;
  });
  const [reloadKey, setReloadKey] = useState(0);
  const isFav = useSearchStore((s) => (result ? s.favoriteIds.has(result.id) : false));
  const toggleFavorite = useSearchStore((s) => s.toggleFavorite);

  const iframeKey = useMemo(() => (result ? `${result.id}:${reloadKey}` : "none"), [result, reloadKey]);

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400">
        Select a result to preview it here.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge-light px-3 py-2 dark:border-edge-dark">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
              {result.source_name}
            </span>
            <Badge tone="muted">{RESULT_TYPE_LABELS[result.result_type]}</Badge>
          </div>
          <div className="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
            {result.title}
          </div>
        </div>
        <IconButton
          title={isFav ? "Remove favorite" : "Favorite"}
          active={isFav}
          onClick={() => toggleFavorite(result)}
        >
          <Star className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
        </IconButton>
        <IconButton title="Copy URL" onClick={() => navigator.clipboard?.writeText(result.url)}>
          <Copy className="h-4 w-4" />
        </IconButton>
        <IconButton title="Reload preview" onClick={() => setReloadKey((k) => k + 1)}>
          <RotateCw className="h-4 w-4" />
        </IconButton>
        <IconButton title="Open in new window" onClick={() => cmd.openWindow(result.url, `${result.title} — ${result.source_name}`)}>
          <Maximize2 className="h-4 w-4" />
        </IconButton>
        <IconButton title="Open in system browser" onClick={() => cmd.openExternal(result.url)}>
          <ExternalLink className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="relative min-h-0 flex-1 bg-white dark:bg-zinc-900">
        <iframe
          key={iframeKey}
          title={result.title}
          src={result.url}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="border-t border-edge-light px-3 py-1.5 text-[11px] text-zinc-400 dark:border-edge-dark">
        Some sites block embedded previews (X-Frame-Options/CSP). If the page does not
        load, use “Open in new window” or “Open in system browser”.
      </div>
    </div>
  );
}