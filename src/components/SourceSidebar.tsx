import { memo, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useSearchStore } from "../stores/searchStore";
import { useSettingsStore } from "../stores/settingsStore";
import * as cmd from "../lib/commands";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import type { ProviderInfo } from "../lib/types";
import { reportError } from "../stores/noticeStore";

const PROVIDER_CATEGORY: Record<string, string> = {
  mathinsight: "Mathematics",
  betterexplained: "Mathematics",
  falstad: "Mathematics & Physics",
  phet: "Physics",
  physicsfundamentals: "Physics",
  physicstuff: "Physics",
  maotian: "Physics",
};

export default function SourceSidebar() {
  const siteFilter = useSearchStore((s) => s.siteFilter);
  const setSiteFilter = useSearchStore((s) => s.setSiteFilter);
  const loading = useSearchStore((s) => s.loading);
  const t = useT();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  useEffect(() => { void cmd.providersInfo().then(setProviders).catch(reportError); }, []);

  const groups = [
    { key: "cat.math", name: "Mathematics" },
    { key: "cat.mathphys", name: "Mathematics & Physics" },
    { key: "cat.phys", name: "Physics" },
    { key: "cat.other", name: "Other" },
  ];

  const toggleProvider = async (id: string, enabled: boolean) => {
    const current = useSettingsStore.getState().settings.enabled_providers;
    const next = enabled ? [...new Set([...current, id])] : current.filter((p) => p !== id);
    await update({ enabled_providers: next });
    const search = useSearchStore.getState();
    if (!enabled && search.siteFilter === id) search.setSiteFilter(null);
    if (search.response) await search.runSearch(search.response.query);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto border-r border-edge-light bg-canvas-light dark:border-edge-dark dark:bg-canvas-dark">
      <div className="px-3 py-2.5">
        <button
          type="button"
          onClick={() => setSiteFilter(null)}
          className={cn(
            "w-full rounded-md px-2 py-1.5 text-left text-[13px] font-semibold",
            siteFilter === null
              ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
              : "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
          )}
        >
          {t("sources.all")}
        </button>
      </div>

      {groups.map((group) => {
        const members = providers.filter(
          (p) => (PROVIDER_CATEGORY[p.id] ?? "Other") === group.name
        );
        if (!members.length) return null;
        return (
          <div key={group.key} className="px-3 pb-2">
            <div className="px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {t(group.key)}
            </div>
            {members.map(({ id, name }) => (
              <SourceRow
                key={id}
                id={id}
                name={name}
                enabled={settings.enabled_providers.includes(id)}
                selected={siteFilter === id}
                loading={loading && settings.enabled_providers.includes(id)}
                onToggle={(v) => toggleProvider(id, v)}
                onSelect={() => setSiteFilter(id)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

const SourceRow = memo(function SourceRow({
  id,
  name,
  enabled,
  selected,
  loading,
  onToggle,
  onSelect,
}: {
  id: string;
  name: string;
  enabled: boolean;
  selected: boolean;
  loading: boolean;
  onToggle: (v: boolean) => void;
  onSelect: () => void;
}) {
  const t = useT();
  const status = useSearchStore((s) => s.response?.providers.find((p) => p.id === id));
  const count = status?.count ?? 0;
  const error = status?.error ?? null;

  return (
    <div
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-[13px]",
        selected
          ? "bg-indigo-500/10 text-zinc-800 dark:text-zinc-100"
          : "text-zinc-600 hover:bg-zinc-200/50 dark:text-zinc-300 dark:hover:bg-zinc-800"
      )}
      onClick={onSelect}
    >
      <input
        type="checkbox"
        aria-label={`${t("settings.sources")}: ${name}`}
        checked={enabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(e.target.checked);
        }}
        className="h-3.5 w-3.5 accent-indigo-500"
      />
      <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(); }} aria-pressed={selected} className="min-w-0 flex-1 truncate text-left">{name}</button>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
      {!loading && error && <span title={error} aria-label={error}><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /></span>}
      {!loading && !error && enabled && (
        <span className="text-[11px] tabular-nums text-zinc-400">{count}</span>
      )}
    </div>
  );
});
