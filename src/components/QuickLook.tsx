import { useEffect, useRef } from "react";
import { ExternalLink, Maximize2, X } from "lucide-react";
import { useSearchStore } from "../stores/searchStore";
import * as cmd from "../lib/commands";
import { useT } from "../lib/i18n";
import ResourcePreview from "./ResourcePreview";
import { attempt } from "../stores/noticeStore";

export default function QuickLook() {
  const t = useT();
  const quickLook = useSearchStore((s) => s.quickLook);
  const setQuickLook = useSearchStore((s) => s.setQuickLook);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!quickLook) return;
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQuickLook(null);
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [quickLook, setQuickLook]);

  if (!quickLook) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={() => setQuickLook(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={quickLook.title}
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
            onClick={() => attempt(() => cmd.openWindow(quickLook.url, `${quickLook.title} — ${quickLook.source_name}`))}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("quicklook.browser")}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            onClick={() => attempt(() => cmd.openExternal(quickLook.url))}
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("quicklook.close")}
            ref={closeButton}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            onClick={() => setQuickLook(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1"><ResourcePreview key={quickLook.id} result={quickLook} /></div>
      </div>
    </div>
  );
}
