import { memo } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useSearchStore } from "../stores/searchStore";
import { useSettingsStore } from "../stores/settingsStore";
import * as cmd from "../lib/commands";
import { cn } from "../lib/cn";
import type { ProviderStatus } from "../lib/types";

const PROVIDER_CATEGORY: Record<string, string> = {
  mathinsight: "Mathematics",
  betterexplained: "Mathematics",
  falstad: "Mathematics & Physics",
  phet: "Physics",
  physicsfundamentals: "Physics",
  physicstuff: "Physics",
  maotian: "Physics",
};

function providerStatus(id: string): ProviderStatus | null {
  const response = useSearchStore.getState().response;
  return response?.providers.find((p) => p.id === id) ?? null;
}

export default function SourceSidebar() {
  const siteFilter = useSearchStore((s) => s.siteFilter);
  const setSiteFilter = useSearchStore((s) => s.setSiteFilter);
  const loading = useSearchStore((s) => s.loading);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  const groups = ["Mathematics", "Mathematics & Physics", "Physics"];

  const toggleProvider = async (id: string, enabled: boolean) => {
    const next = enabled
      ? [...settings.enabled_providers, id]
      : settings.enabled_providers.filter((p) => p !== id);
    await update({ enabled_providers: next });
    await cmd.setProviderEnabled(id, enabled);
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
          All sources
        </button>
      </div>

      {groups.map((group) => {
        const providers = Object.keys(PROVIDER_CATEGORY).filter(
          (id) => PROVIDER_CATEGORY[id] === group
        );
        return (
          <div key={group} className="px-3 pb-2">
            <div className="px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              {group}
            </div>
            {providers.map((id) => (
              <SourceRow
                key={id}
                id={id}
                name={PROVIDER_CATEGORY[id] ? displayName(id) : id}
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

function displayName(id: string): string {
  const map: Record<string, string> = {
    mathinsight: "Math Insight",
    falstad: "Falstad",
    phet: "PhET",
    betterexplained: "BetterExplained",
    physicsfundamentals: "Physics Fundamentals",
    physicstuff: "PhysicStuff",
    maotian: "猫田の物理",
  };
  return map[id] ?? id;
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
  const status = providerStatus(id);
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
        checked={enabled}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(e.target.checked);
        }}
        className="h-3.5 w-3.5 accent-indigo-500"
      />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
      {!loading && error && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
      {!loading && !error && enabled && (
        <span className="text-[11px] tabular-nums text-zinc-400">{count}</span>
      )}
    </div>
  );
});