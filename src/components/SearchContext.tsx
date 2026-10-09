import { useEffect, useMemo, useState } from "react";
import { useSearchStore } from "../stores/searchStore";
import { useSettingsStore } from "../stores/settingsStore";
import { parseAndExpand } from "../lib/searchEngine";
import { conceptById, type Concept } from "../lib/concepts";
import { IS_TAURI } from "../lib/commands";
import { loadManifest } from "../lib/webIndex";
import { getLearningProfile } from "../learning/registry";
import { historicalAliases } from "../learning/historicalAliases";
import { learningText } from "../learning/uiText";
export default function SearchContext({
  onConcept,
}: {
  onConcept: (id: string) => void;
}) {
  const response = useSearchStore((s) => s.response),
    runSearch = useSearchStore((s) => s.runSearch);
  const explore = useSearchStore((s) => s.exploreRelated),
    setExplore = useSearchStore((s) => s.setExploreRelated);
  const locale = useSettingsStore((s) => s.settings.ui_locale);
  const [dates, setDates] = useState<string[]>([]);
  useEffect(() => {
    if (!IS_TAURI)
      void loadManifest()
        .then((m) => setDates(m.map((p) => p.updated_at).sort()))
        .catch(() => {});
  }, [response]);
  const resolved = useMemo(
    () =>
      response
        ? parseAndExpand(response.query).concept_ids.map(
            (id) => conceptById.get(id)!,
          )
        : [],
    [response],
  );
  const label = (c: Concept) =>
    locale === "zh-CN" ? c.zh_cn : locale === "zh-TW" ? c.zh_tw : c.en;
  const related = [...new Set(resolved.flatMap((c) => c.related))]
    .filter((id) => !resolved.some((c) => c.id === id))
    .map((id) => conceptById.get(id)!);
  const prerequisites = [
    ...new Set(resolved.flatMap((c) => c.prerequisites)),
  ].map((id) => conceptById.get(id)!);
  const stale = dates.some((d) => Date.now() - Date.parse(d) > 30 * 86400000);
  const text = (en: string, cn: string, tw: string) =>
    locale === "zh-CN" ? cn : locale === "zh-TW" ? tw : en;
  if (!dates.length && !resolved.length) return null;
  return (
    <div
      className="shrink-0 space-y-1 border-b border-edge-light px-3 py-2 text-xs dark:border-edge-dark"
      aria-label="Search context"
    >
      {!IS_TAURI && dates.length > 0 && (
        <div className="text-zinc-500" data-testid="snapshot-date">
          {text("Index snapshot", "索引快照", "索引快照")}: {dates[0]}
          {dates[dates.length - 1] !== dates[0]
            ? ` – ${dates[dates.length - 1]}`
            : ""}{" "}
          · {text("Static provider index", "静态来源索引", "靜態來源索引")}
          {stale && (
            <span className="ml-2 rounded bg-amber-100 px-1 text-amber-900">
              {text("Stale", "较旧", "較舊")}
            </span>
          )}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {resolved.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onConcept(c.id)}
              data-concept-id={c.id}
              className="rounded-full bg-indigo-500/10 px-2 py-1 text-indigo-600 dark:text-indigo-300"
            >
              {locale === "en"
                ? `${c.zh_cn} · ${c.en}`
                : `${label(c)} · ${c.en}`}
              {getLearningProfile(c.id) && (
                <span className="ml-2 font-semibold">
                  {learningText.learn[locale]}
                </span>
              )}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1">
            <input
              type="checkbox"
              checked={explore}
              onChange={(e) => setExplore(e.target.checked)}
            />
            {text("Expand related concepts", "扩展相关概念", "擴展相關概念")}
          </label>
        </div>
      )}
      {response &&
        historicalAliases
          .filter(
            (a) =>
              response.query.includes(a.text) &&
              resolved.some((c) => c.id === a.conceptId),
          )
          .map((a) => (
            <div key={a.text} className="text-zinc-600 dark:text-zinc-300">
              {learningText.legacy[locale]}: {a.text} →{" "}
              {label(conceptById.get(a.conceptId)!)} ·{" "}
              {conceptById.get(a.conceptId)!.en}
            </div>
          ))}
      {related.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-zinc-500">
          <span>{text("Related", "相关", "相關")}:</span>
          {related.map((c) => (
            <button
              key={c.id}
              type="button"
              className="underline"
              onClick={() => runSearch(label(c))}
            >
              {label(c)}
            </button>
          ))}
        </div>
      )}
      {prerequisites.length > 0 && (
        <details className="text-zinc-500">
          <summary className="cursor-pointer">
            {text("Prerequisites", "先修概念", "先修概念")}
          </summary>
          <div className="flex flex-wrap gap-2 pt-1">
            {prerequisites.map((c) => (
              <button
                key={c.id}
                type="button"
                className="underline"
                onClick={() => runSearch(label(c))}
              >
                {label(c)}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
