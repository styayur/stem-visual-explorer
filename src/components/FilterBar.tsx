import { useSearchStore, type TypeFilter } from "../stores/searchStore";
import { RESULT_TYPE_LABELS, RESULT_TYPES } from "../lib/types";
import { cn } from "../lib/cn";

export default function FilterBar() {
  const typeFilter = useSearchStore((s) => s.typeFilter);
  const setTypeFilter = useSearchStore((s) => s.setTypeFilter);
  const total = useSearchStore((s) => s.response?.total ?? 0);

  const chips: Array<{ value: TypeFilter; label: string }> = [
    { value: "all", label: "All" },
    ...RESULT_TYPES.map((t) => ({ value: t as TypeFilter, label: RESULT_TYPE_LABELS[t] })),
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-edge-light px-3 py-2 dark:border-edge-dark">
      {chips.map((chip) => (
        <button
          key={chip.value}
          type="button"
          onClick={() => setTypeFilter(chip.value)}
          className={cn(
            "whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            typeFilter === chip.value
              ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
              : "border-edge-light text-zinc-500 hover:bg-zinc-100 dark:border-edge-dark dark:text-zinc-400 dark:hover:bg-zinc-800"
          )}
        >
          {chip.label}
        </button>
      ))}
      <span className="ml-auto shrink-0 text-[11px] text-zinc-400">
        {total} results
      </span>
    </div>
  );
}