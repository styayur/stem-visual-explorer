import { selectedResult, useSearchStore } from "../stores/searchStore";
import * as cmd from "./commands";

function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function installShortcuts(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;

    // Focus search.
    if (mod && (e.key === "k" || e.key === "l")) {
      e.preventDefault();
      const focus = (window as unknown as { __sveFocusSearch?: () => void }).__sveFocusSearch;
      focus?.();
      return;
    }

    // Arrow navigation on the result list.
    if (!isTyping() && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
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

    const r = selectedResult();

    if (mod && e.key === "Enter" && r) {
      e.preventDefault();
      cmd.openWindow(r.url, `${r.title} — ${r.source_name}`);
      return;
    }

    if (e.key === "Enter" && r) {
      e.preventDefault();
      cmd.openWindow(r.url, `${r.title} — ${r.source_name}`);
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

    if (mod && (e.key === "w" || e.key === "W")) {
      e.preventDefault();
      useSearchStore.getState().setQuickLook(null);
      return;
    }
  };

  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}