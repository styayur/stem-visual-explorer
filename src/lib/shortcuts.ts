import { selectedResult, useSearchStore } from "../stores/searchStore";
import * as cmd from "./commands";
import { useSettingsStore } from "../stores/settingsStore";
import { attempt } from "../stores/noticeStore";

function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}

export function installShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.defaultPrevented || e.isComposing) return;

    // Focus search.
    if (mod && (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "l")) {
      e.preventDefault();
      useSettingsStore.getState().setPage("search");
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>("#search-input");
        input?.focus(); input?.select();
      });
      return;
    }

    if (useSettingsStore.getState().page !== "search") return;
    const state = useSearchStore.getState();
    if (e.key === "Escape" || (state.quickLook && mod && e.key.toLowerCase() === "w")) {
      if (state.quickLook) { e.preventDefault(); state.setQuickLook(null); }
      return;
    }
    if (state.loading || isTyping() || (e.target instanceof Element && e.target.closest("button, a, [role=menu]"))) return;

    // Arrow navigation on the result list.
    if (!isTyping() && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      if (state.quickLook) return;
      e.preventDefault();
      useSearchStore.getState().moveSelection(e.key === "ArrowDown" ? 1 : -1);
      return;
    }

    // Esc closes quick look.
    if (e.key === "Escape") {
      useSearchStore.getState().setQuickLook(null);
      return;
    }

    if (isTyping()) return;

    const r = state.quickLook ?? selectedResult();

    if (mod && e.key === "Enter" && r) {
      e.preventDefault();
      void attempt(() => cmd.openWindow(r.url, `${r.title} — ${r.source_name}`));
      return;
    }

    if (e.key === "Enter" && r) {
      e.preventDefault();
      void attempt(() => cmd.openWindow(r.url, `${r.title} — ${r.source_name}`));
      return;
    }

    if (e.key === " " && r) {
      e.preventDefault();
      const s = useSearchStore.getState();
      s.setQuickLook(s.quickLook ? null : r);
      return;
    }

    if (mod && (e.key === "d" || e.key === "D") && r) {
      e.preventDefault();
      useSearchStore.getState().toggleFavorite(r);
      return;
    }

  };

  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
