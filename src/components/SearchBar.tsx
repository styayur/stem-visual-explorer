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
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = [
      ...SUGGESTIONS,
      ...history.map((h) => h.query),
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

  useEffect(() => {
    const focus = () => inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "l")) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    // expose focus for external callers
    (window as unknown as { __sveFocusSearch?: () => void }).__sveFocusSearch = focus;
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        <Search className="h-4 w-4 shrink-0 text-zinc-400" />
        <input
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
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
              setOpen(false);
              inputRef.current?.blur();
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
        <div className="absolute left-0 right-0 top-11 z-30 overflow-hidden rounded-lg border border-edge-light bg-white shadow-lg dark:border-edge-dark dark:bg-surface-dark">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(s);
                runSearch(s);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}