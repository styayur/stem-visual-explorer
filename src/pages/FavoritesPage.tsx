import { useMemo, useState } from "react";
import { ExternalLink, Search, Star } from "lucide-react";
import { useSearchStore } from "../stores/searchStore";
import * as cmd from "../lib/commands";
import { Badge } from "../components/ui";
import { RESULT_TYPE_LABELS } from "../lib/types";

export default function FavoritesPage() {
  const favorites = useSearchStore((s) => s.favorites);
  const toggleFavorite = useSearchStore((s) => s.toggleFavorite);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("all");

  const sources = useMemo(
    () => Array.from(new Set(favorites.map((f) => f.result.source_id))),
    [favorites]
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return favorites.filter((f) => {
      const hay = `${f.result.title} ${f.result.source_name} ${f.result.tags.join(" ")}`.toLowerCase();
      const matchesQ = query.length === 0 || hay.includes(query);
      const matchesS = source === "all" || f.result.source_id === source;
      return matchesQ && matchesS;
    });
  }, [favorites, q, source]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge-light bg-white px-3 py-2 dark:border-edge-dark dark:bg-surface-dark">
        <div className="flex max-w-md flex-1 items-center gap-2 rounded-md border border-edge-light px-2 dark:border-edge-dark">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search favorites…"
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          />
        </div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="h-8 rounded-md border border-edge-light bg-white px-2 text-[12px] text-zinc-600 dark:border-edge-dark dark:bg-surface-dark dark:text-zinc-300"
        >
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="ml-auto text-[12px] text-zinc-400">{filtered.length} saved</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            No favorites yet. Use the star on a result or press Ctrl+D.
          </div>
        )}
        {filtered.map((f) => (
          <div
            key={f.result.id}
            className="group flex items-start gap-3 border-b border-edge-light/70 px-4 py-3 hover:bg-zinc-100/60 dark:border-edge-dark/70 dark:hover:bg-zinc-800/50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {f.result.source_name}
                </span>
                <Badge tone="muted">{RESULT_TYPE_LABELS[f.result.result_type]}</Badge>
              </div>
              <div className="truncate text-[14px] font-medium text-zinc-800 dark:text-zinc-100">
                {f.result.title}
              </div>
              <div className="truncate text-[11px] text-zinc-400">{f.result.url}</div>
            </div>
            <button
              type="button"
              title="Open in new window"
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-indigo-500 dark:hover:bg-zinc-700"
              onClick={() => cmd.openWindow(f.result.url, `${f.result.title} — ${f.result.source_name}`)}
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Remove favorite"
              className="rounded p-1.5 text-amber-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              onClick={() => toggleFavorite(f.result)}
            >
              <Star className="h-4 w-4" fill="currentColor" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}