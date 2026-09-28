import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { useSettingsStore } from "../stores/settingsStore";
import { useT, UI_LOCALES } from "../lib/i18n";
import { TARGET_LANGUAGES, type UiLocale } from "../lib/types";
import * as cmd from "../lib/commands";
import type { ProviderInfo } from "../lib/types";
import { cn } from "../lib/cn";

export default function SettingsPage() {
  const t = useT();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = async () => {
    setProviders(await cmd.providersInfo());
  };

  useEffect(() => {
    reload().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h2 className="text-lg font-semibold">{t("settings.title")}</h2>

        <Section title={t("settings.translation")}>
          <SettingRow label={t("settings.uiLanguage")}>
            <div className="flex gap-1.5">
              {UI_LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => update({ ui_locale: l.code as UiLocale })}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[12px]",
                    settings.ui_locale === l.code
                      ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                      : "border-edge-light text-zinc-500 dark:border-edge-dark dark:text-zinc-400"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label={t("settings.targetLanguage")}>
            <select
              value={settings.translate_target}
              onChange={(e) => update({ translate_target: e.target.value })}
              className="w-[190px] rounded-md border border-edge-light bg-white px-2 py-1 text-[12px] dark:border-edge-dark dark:bg-surface-dark dark:text-zinc-200"
            >
              {TARGET_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow label={t("settings.translateResults")}>
            <Toggle
              on={settings.translate_results}
              onToggle={() => update({ translate_results: !settings.translate_results })}
            />
          </SettingRow>
          <p className="mb-3 -mt-2 text-[11px] text-zinc-400">
            {t("settings.translateResultsHint")}
          </p>

          <div className="mb-1 text-[13px] text-zinc-600 dark:text-zinc-300">
            {t("settings.pageProxy")}
          </div>
          <input
            value={settings.page_translate_proxy}
            onChange={(e) => update({ page_translate_proxy: e.target.value })}
            placeholder="https://your-proxy/?url={url}&lang={lang}"
            spellCheck={false}
            className="mb-1 w-full rounded-md border border-edge-light bg-white px-2 py-1.5 font-mono text-[11px] dark:border-edge-dark dark:bg-surface-dark dark:text-zinc-200"
          />
          <p className="mb-3 text-[11px] text-zinc-400">{t("settings.pageProxyHint")}</p>
          <p className="text-[11px] text-zinc-400">{t("settings.engineNote")}</p>
        </Section>

        <Section title={t("settings.appearance")}>
          <SettingRow label={t("settings.theme")}>
            <div className="flex gap-1.5">
              {(["system", "light", "dark"] as const).map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => update({ theme: th })}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[12px]",
                    settings.theme === th
                      ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                      : "border-edge-light text-zinc-500 dark:border-edge-dark dark:text-zinc-400"
                  )}
                >
                  {t(th === "system" ? "theme.system" : th === "light" ? "theme.light" : "theme.dark")}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label={t("settings.previewMode")}>
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

          <SettingRow label={t("settings.mockMode")}>
            <Toggle
              on={settings.mock_mode}
              onToggle={() => update({ mock_mode: !settings.mock_mode })}
            />
          </SettingRow>
        </Section>

        <Section title={t("settings.sources")}>
          <p className="mb-2 text-[12px] text-zinc-400">{t("settings.sourcesHint")}</p>
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
                    {t("settings.indexed")}: {p.indexed_items ?? "—"} ·{" "}
                    {t("settings.lastUpdated")}: {p.last_updated ?? t("settings.never")}
                  </div>
                </div>
                <button
                  type="button"
                  title={t("settings.refreshIndex")}
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
              <Trash2 className="h-3.5 w-3.5" /> {t("settings.clearCache")}
            </button>
            <span className="flex items-center gap-1 text-[11px] text-zinc-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("settings.cacheNote")}
            </span>
          </div>
        </Section>

        <Section title={t("settings.about")}>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{t("settings.aboutText")}</p>
          <p className="mt-2 text-[12px] text-zinc-400">{t("settings.license")}</p>
        </Section>
      </div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        on ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-600"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
          on ? "left-[18px]" : "left-0.5"
        )}
      />
    </button>
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
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="text-[13px] text-zinc-600 dark:text-zinc-300">{label}</span>
      {children}
    </div>
  );
}