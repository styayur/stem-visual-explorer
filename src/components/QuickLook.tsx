import { useEffect } from "react";
import { ExternalLink, Maximize2, X } from "lucide-react";
import { useSearchStore } from "../stores/searchStore";
import * as cmd from "../lib/commands";
import { useT } from "../lib/i18n";

export default function QuickLook() {
  const t = useT();
  const quickLook = useSearchStore((s) => s.quickLook);
  const setQuickLook = useSearchStore((s) => s.setQuickLook);

  useEffect(() => {
    if (!quickLook) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuickLook(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickLook, setQuickLook]);

  if (!quickLook) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={() => setQuickLook(null)}
    >
      <div
        className="flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-edge-dark bg-surface-dark shadow-2xl dark:bg-surface-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-edge-dark px-3 py-2">
          <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-100">
            {quickLook.title}
            <span className="ml-2 text-[11px] text-zinc-400">{quickLook.source_name}</span>
          </div>
          <button
            type="button"
            title={t("quicklook.openWindow")}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            onClick={() => cmd.openWindow(quickLook.url, `${quickLook.title} — ${quickLook.source_name}`)}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("quicklook.browser")}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            onClick={() => cmd.openExternal(quickLook.url)}
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("quicklook.close")}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            onClick={() => setQuickLook(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <iframe
          title={quickLook.title}
          src={quickLook.url}
          className="min-h-0 flex-1 border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
        />
      </div>
    </div>
  );
}