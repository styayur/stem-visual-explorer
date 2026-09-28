import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import * as cmd from "../lib/commands";
import type { ProviderInfo } from "../lib/types";
import { cn } from "../lib/cn";

export default function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    setProviders(await cmd.providersInfo());
  };

  useEffect(() => {
    reload().catch(() => {});
  }, []);

  const refresh = async (id: string) => {
    setBusy(id);
    try {
      await cmd.refreshProviderIndex(id);
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const clear = async () => {
    setBusy("cache");
    try {
      await cmd.clearCache();
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (id: string, enabled: boolean) => {
    const next = enabled
      ? [...settings.enabled_providers, id]
      : settings.enabled_providers.filter((p) => p !== id);
    await update({ enabled_providers: next });
    await cmd.setProviderEnabled(id, enabled);
    await reload();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <h2 className="text-lg font-semibold">Settings</h2>

        <Section title="Appearance">
          <SettingRow label="Theme">
            <div className="flex gap-1.5">
              {(["system", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update({ theme: t })}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[12px] capitalize",
                    settings.theme === t
                      ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                      : "border-edge-light text-zinc-500 dark:border-edge-dark dark:text-zinc-400"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label="Preview mode">
            <div className="flex gap-1.5">
              {(["side", "inline", "off"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update({ preview_mode: m })}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[12px] capitalize",
                    settings.preview_mode === m
                      ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                      : "border-edge-light text-zinc-500 dark:border-edge-dark dark:text-zinc-400"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label="Mock mode (dev only)">
            <button
              type="button"
              onClick={() => update({ mock_mode: !settings.mock_mode })}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                settings.mock_mode ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-600"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                  settings.mock_mode ? "left-[18px]" : "left-0.5"
                )}
              />
            </button>
          </SettingRow>
        </Section>

        <Section title="Sources">
          <p className="mb-2 text-[12px] text-zinc-400">
            Enable or disable individual providers, refresh their local indexes and clear the
            on-disk cache. Cached indexes older than 7 days are refreshed automatically in the
            background.
          </p>
          <div className="overflow-hidden rounded-lg border border-edge-light dark:border-edge-dark">
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 border-b border-edge-light/70 px-3 py-2 last:border-0 dark:border-edge-dark/70"
              >
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => toggle(p.id, e.target.checked)}
                  className="h-4 w-4 accent-indigo-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{p.name}</span>
                    {p.experimental && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
                        experimental
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-zinc-400">{p.homepage}</div>
                  <div className="text-[11px] text-zinc-400">
                    Indexed: {p.indexed_items ?? "—"} · Last updated: {p.last_updated ?? "never"}
                  </div>
                </div>
                <button
                  type="button"
                  title="Refresh index"
                  disabled={busy === p.id}
                  className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-indigo-500 disabled:opacity-40 dark:hover:bg-zinc-800"
                  onClick={() => refresh(p.id)}
                >
                  <RefreshCw className={cn("h-4 w-4", busy === p.id && "animate-spin")} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1.5 rounded-md border border-edge-light px-2.5 py-1.5 text-[12px] text-zinc-600 hover:bg-zinc-100 dark:border-edge-dark dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear cache
            </button>
            <span className="flex items-center gap-1 text-[11px] text-zinc-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Cached indexes are stored locally only.
            </span>
          </div>
        </Section>

        <Section title="About">
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            STEM Visual Explorer is a deterministic local search client. It performs no AI
            ranking, requires no account, sends no telemetry and never talks to a cloud database.
            Network requests go directly to the source websites you search.
          </p>
          <p className="mt-2 text-[12px] text-zinc-400">
            Licensed under the GNU Affero General Public License v3.0.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[13px] text-zinc-600 dark:text-zinc-300">{label}</span>
      {children}
    </div>
  );
}