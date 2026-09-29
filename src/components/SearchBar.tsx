import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useSearchStore } from "../stores/searchStore";
import { useT } from "../lib/i18n";
import { cn } from "../lib/cn";

const SUGGESTIONS = [
  "gradient",
  "curl",
  "divergence",
  "Fourier transform",
  "standing wave",
  "electromagnetic field",
  "harmonic oscillator",
  "quantum well",
  "Gauss theorem",
  "Stokes theorem",
  "梯度",
  "旋度",
  "散度",
  "驻波",
  "简谐振动",
  "电磁感应",
];

export default function SearchBar() {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const runSearch = useSearchStore((s) => s.runSearch);
  const history = useSearchStore((s) => s.history);
  const t = useT();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = [
      ...history.map((h) => h.query),
      ...SUGGESTIONS,
    ];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of pool) {
      if (!s || seen.has(s.toLowerCase())) continue;
      if (q.length === 0 || s.toLowerCase().includes(q)) {
        seen.add(s.toLowerCase());
        out.push(s);
      }
      if (out.length >= 8) break;
    }
    return out;
  }, [query, history]);

  useEffect(() => setActive(-1), [query]);

  const submit = (value = query) => {
    void runSearch(value); setOpen(false); setActive(-1); inputRef.current?.blur();
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-white px-3 dark:bg-surface-dark",
          focused
            ? "border-indigo-500/60 ring-2 ring-indigo-500/20"
            : "border-edge-light dark:border-edge-dark"
        )}
      >
        <button type="button" aria-label={t("nav.search")} onClick={() => submit()} className="shrink-0 text-zinc-400 hover:text-indigo-500"><Search className="h-4 w-4" /></button>
        <input
          id="search-input"
          role="combobox"
          aria-label={t("nav.search")}
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          aria-controls="search-suggestions"
          aria-activedescendant={active >= 0 && open ? `suggestion-${active}` : undefined}
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => {
            setFocused(false);
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && suggestions.length) {
              e.preventDefault(); setOpen(true);
              setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              submit(open && active >= 0 ? suggestions[active] : query);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={t("search.placeholder")}
          className="h-10 w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          spellCheck={false}
        />
      </div>

      {open && suggestions.length > 0 && (
        <div id="search-suggestions" role="listbox" className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-lg border border-edge-light bg-white shadow-lg dark:border-edge-dark dark:bg-surface-dark">
          {suggestions.map((s, i) => (
            <button
              key={s}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === active}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                submit(s);
              }}
              className={cn("block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800", i === active && "bg-indigo-500/10")}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
