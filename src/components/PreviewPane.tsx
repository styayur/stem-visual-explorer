import { useMemo, useState } from "react";
import { Copy, ExternalLink, Languages, Maximize2, RotateCw, Star } from "lucide-react";
import { selectedResult, useSearchStore } from "../stores/searchStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useT, typeLabelKey } from "../lib/i18n";
import { useTranslatedText } from "../lib/translate/useTranslatedText";
import { buildTranslatedPageUrl } from "../lib/translate/pageUrl";
import * as cmd from "../lib/commands";
import { Badge, IconButton } from "./ui";
import ResourcePreview from "./ResourcePreview";
import { cn } from "../lib/cn";

export default function PreviewPane() {
  const t = useT();
  const result = useSearchStore(() => selectedResult());
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<"original" | "translated">("original");

  const target = useSettingsStore((s) => s.settings.translate_target);
  const proxy = useSettingsStore((s) => s.settings.page_translate_proxy);
  const isFav = useSearchStore((s) => (result ? s.favoriteIds.has(result.id) : false));
  const toggleFavorite = useSearchStore((s) => s.toggleFavorite);

  const translateOn = useSettingsStore((s) => s.settings.translate_results);
  const titleT = useTranslatedText(result?.title, translateOn || view === "translated", target);
  const descT = useTranslatedText(result?.description, view === "translated", target);

  const iframeKey = useMemo(
    () => (result ? `${result.id}:${view}:${reloadKey}` : "none"),
    [result, view, reloadKey]
  );

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-400">
        {t("preview.empty")}
      </div>
    );
  }

  const translatedTitle = titleT?.text ?? result.title;
  const translatedDesc = descT?.text ?? result.description;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-edge-light px-3 py-2 dark:border-edge-dark">
        <div className="min-w-0 basis-full pb-1">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="truncate text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
              {result.source_name}
            </span>
            <Badge tone="muted">{t(typeLabelKey(result.result_type))}</Badge>
            {titleT && titleT.text !== result.title && (
              <Badge tone="accent">{t("common.translated")}</Badge>
            )}
          </div>
          <div
            className="truncate text-[13px] font-medium text-zinc-800 dark:text-zinc-100"
            title={result.title}
          >
            {translatedTitle}
          </div>
        </div>

        <button
          type="button"
          title={t("preview.translatePage")}
          onClick={() => setView((v) => (v === "translated" ? "original" : "translated"))}
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium",
            view === "translated"
              ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
              : "border-edge-light text-zinc-500 dark:border-edge-dark dark:text-zinc-400"
          )}
        >
          <Languages className="h-3.5 w-3.5" />
          {view === "translated" ? t("preview.viewTranslated") : t("preview.viewOriginal")}
        </button>
        <IconButton
          title={isFav ? t("row.unfavorite") : t("row.favorite")}
          active={isFav}
          onClick={() => toggleFavorite(result)}
        >
          <Star className="h-4 w-4" fill={isFav ? "currentColor" : "none"} />
        </IconButton>
        <IconButton title={t("preview.copy")} onClick={() => cmd.copyUrl(result.url)}>
          <Copy className="h-4 w-4" />
        </IconButton>
        <IconButton title={t("preview.reload")} onClick={() => setReloadKey((k) => k + 1)}>
          <RotateCw className="h-4 w-4" />
        </IconButton>
        <IconButton
          title={t("row.openWindow")}
          onClick={() => cmd.openWindow(result.url, `${result.title} — ${result.source_name}`)}
        >
          <Maximize2 className="h-4 w-4" />
        </IconButton>
        <IconButton title={t("preview.browser")} onClick={() => cmd.openExternal(result.url)}>
          <ExternalLink className="h-4 w-4" />
        </IconButton>
      </div>

      {view === "translated" && (
        <div className="border-b border-edge-light bg-indigo-500/5 px-3 py-2 text-[12px] text-zinc-600 dark:border-edge-dark dark:text-zinc-300">
          <div className="mb-1 flex items-center gap-2">
            <Badge tone="accent">{t("common.translated")}</Badge>
            <button
              type="button"
              className="text-[11px] text-indigo-600 underline dark:text-indigo-300"
              onClick={() => cmd.openExternal(buildTranslatedPageUrl(result.url, target, proxy))}
            >
              {t("preview.openTranslated")}
            </button>
          </div>
          {translatedDesc && <p className="line-clamp-3">{translatedDesc}</p>}
        </div>
      )}

      <div className="relative min-h-0 flex-1 bg-white dark:bg-zinc-900">
        <ResourcePreview key={result.id} result={result} reloadKey={iframeKey} />
      </div>

      <div className="border-t border-edge-light px-3 py-1.5 text-[11px] text-zinc-400 dark:border-edge-dark">
        {view === "translated"
          ? `${t("preview.translationExternal")} `
          : ""}
        {t("preview.embedNote")}
      </div>
    </div>
  );
}
