import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSearchStore, visibleResults } from "../stores/searchStore";
import type { SearchResult } from "../lib/types";
import ResultRow, { RESULT_ROW_HEIGHT } from "./SearchResultRow";
import { useT } from "../lib/i18n";

const SUGGESTED = [
  "Gradient",
  "Curl",
  "Divergence",
  "Fourier Transform",
  "Standing Wave",
  "Electromagnetic Field",
  "Harmonic Oscillator",
  "Quantum Well",
];

export default function SearchResults() {
  const t = useT();
  const response = useSearchStore((s) => s.response);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const siteFilter = useSearchStore((s) => s.siteFilter);
  const typeFilter = useSearchStore((s) => s.typeFilter);
  const selectedIndex = useSearchStore((s) => s.selectedIndex);
  const select = useSearchStore((s) => s.select);
  const runSearch = useSearchStore((s) => s.runSearch);

  const results = useMemo(() => visibleResults(), [
    response,
    siteFilter,
    typeFilter,
  ]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        {t("results.searching")}
      </div>
    );
  }

  if (error) return <div role="alert" className="p-6 text-sm text-red-600"><p>{error}</p><button type="button" className="mt-3 underline" onClick={() => runSearch()}>{t("common.retry")}</button></div>;

  if (!response || response.results.length === 0) {
    return <EmptyState query={response?.query ?? ""} onPick={runSearch} />;
  }

  if (results.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        {t("results.filteredOut")}
      </div>
    );
  }

  return (
    <VirtualResults
      results={results}
      selectedIndex={selectedIndex}
      onSelect={select}
    />
  );
}

function EmptyState({ query, onPick }: { query: string; onPick: (q: string) => void }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <Sparkles className="h-8 w-8 text-indigo-400" />
      <div className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">
        {t("results.explore")}
      </div>
      <div className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        {query.length > 0
          ? t("results.noResults")
          : t("results.emptyHint")}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {SUGGESTED.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-edge-light px-3 py-1.5 text-[13px] text-zinc-600 transition-colors hover:border-indigo-400 hover:text-indigo-500 dark:border-edge-dark dark:text-zinc-300"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function VirtualResults({
  results,
  selectedIndex,
  onSelect,
}: {
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = results.length * RESULT_ROW_HEIGHT;
  const start = Math.max(0, Math.floor(scrollTop / RESULT_ROW_HEIGHT) - 4);
  const end = Math.min(
    results.length,
    Math.ceil((scrollTop + height) / RESULT_ROW_HEIGHT) + 4
  );
  const visible = results.slice(start, end);

  // Keep selection scrolled into view on keyboard navigation.
  useEffect(() => {
    if (selectedIndex < 0) return;
    const el = containerRef.current;
    if (!el) return;
    const top = selectedIndex * RESULT_ROW_HEIGHT;
    const bottom = top + RESULT_ROW_HEIGHT;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (bottom > el.scrollTop + el.clientHeight)
      el.scrollTop = bottom - el.clientHeight;
  }, [selectedIndex, results]);

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Search results"
      tabIndex={0}
      className="h-full overflow-y-auto"
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div style={{ height: total, position: "relative" }}>
        {visible.map((r, i) => {
          const index = start + i;
          return (
            <div
              key={r.id}
              style={{
                position: "absolute",
                top: index * RESULT_ROW_HEIGHT,
                left: 0,
                right: 0,
              }}
            >
              <ResultRow
                result={r}
                index={index}
                selected={index === selectedIndex}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
