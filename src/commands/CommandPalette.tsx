import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkbenchStore } from "../workbench/workbenchStore";
import { useSettingsStore } from "../stores/settingsStore";
import { workbenchText as ui } from "../workbench/uiText";
import { localize } from "../learning/types";
import { registeredCommands } from "./commandRegistry";
import { attempt } from "../stores/noticeStore";
import "./commands.css";
export default function CommandPalette() {
  const { session, lesson, setPalette, surface, open } = useWorkbenchStore();
  const locale = useSettingsStore((s) => s.settings.ui_locale);
  const [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    input.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
      else document.getElementById("search-input")?.focus();
    };
  }, []);
  const commands = useMemo(
    () =>
      registeredCommands({
        conceptId: session?.conceptId,
        locale,
        lesson,
        surface,
        navigate: (id) =>
          open(id, { type: "command", sourceConceptId: session?.conceptId }),
        focusSearch: () =>
          requestAnimationFrame(() =>
            document.getElementById("search-input")?.focus(),
          ),
        copy: (name) => void attempt(() => navigator.clipboard.writeText(name)),
      }),
    [session?.conceptId, locale, lesson, surface, open],
  );
  const list = commands.filter((c) =>
    c.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  useEffect(() => setActive(0), [query]);
  const choose = (i: number) => {
    const c = list[i];
    if (c) {
      setPalette(false);
      c.run();
    }
  };
  const t = (key: keyof typeof ui) => localize(ui[key], locale);
  return (
    <div
      className="command-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setPalette(false);
      }}
    >
      <div
        ref={dialog}
        className="command-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setPalette(false);
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) =>
              list.length
                ? (i + (e.key === "ArrowDown" ? 1 : -1) + list.length) %
                  list.length
                : 0,
            );
          }
          if (e.key === "Enter" && e.target === input.current) {
            e.preventDefault();
            choose(active);
          }
          if (e.key === "Tab") {
            const nodes =
              dialog.current?.querySelectorAll<HTMLElement>("input,button");
            if (nodes?.length) {
              const first = nodes[0],
                last = nodes[nodes.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }}
      >
        <header>
          <h2 id="command-title">{t("palette")}</h2>
          <button onClick={() => setPalette(false)} aria-label={t("close")}>
            ×
          </button>
        </header>
        <input
          ref={input}
          role="combobox"
          aria-label={t("findCommand")}
          aria-expanded="true"
          aria-controls="command-options"
          aria-activedescendant={list[active] ? `command-${active}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("findCommand")}
        />
        <div id="command-options" role="listbox">
          {list.map((c, i) => (
            <button
              key={c.id}
              id={`command-${i}`}
              role="option"
              aria-selected={active === i}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              {c.title}
            </button>
          ))}
          {!list.length && <p role="status">{t("noCommands")}</p>}
        </div>
      </div>
    </div>
  );
}
