import { useEffect, useState } from "react";
import { ExternalLink, RotateCw } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import * as cmd from "../lib/commands";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";

export default function Workspace() {
  const t = useT();
  const [urls, setUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      let label = "";
      try {
        label = getCurrentWebviewWindow().label;
      } catch {
        label = "";
      }
      try {
        const items = await cmd.getWorkspaceItems(label);
        if (mounted) {
          setUrls(items);
          try { setNotes(localStorage.getItem(notesKey(items)) ?? localStorage.getItem("sve-workspace-notes") ?? ""); }
          catch (e) { setError(String(e)); }
        }
      } catch (e) { if (mounted) setError(String(e)); }
      finally { if (mounted) setReady(true); }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const gridClass = urls.length <= 1 ? "grid-cols-1 grid-rows-1" : urls.length <= 2 ? "grid-cols-2 grid-rows-1" : "grid-cols-2 grid-rows-2";

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <div className="flex items-center gap-3 border-b border-zinc-700 px-3 py-2">
        <span className="text-[13px] font-semibold">{t("workspace.title")}</span>
        <span className="text-[11px] text-zinc-400">{t("workspace.panes", { n: urls.length })}</span>
        <button
          type="button"
          className="ml-auto rounded px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-700"
          onClick={() => setReload((r) => r + 1)}
        >
          {t("workspace.reloadAll")}
        </button>
        <button
          type="button"
          className="rounded px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-700"
          onClick={() => Promise.all(urls.map((u) => cmd.openExternal(u))).catch((e) => setError(String(e)))}
        >
          {t("workspace.openAll")}
        </button>
        <a
          href="?route=search"
          className="rounded px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-700"
        >
          {t("workspace.newSearch")}
        </a>
      </div>
      {error && <p role="alert" className="px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className={cn("grid min-h-0 flex-1 gap-px bg-zinc-700", gridClass)}>
        {urls.map((u, i) => (
          <Pane key={`${u}:${i}`} url={u} index={i} reload={reload} onError={setError} />
        ))}
        {urls.length === 0 && (
          <div className="flex items-center justify-center bg-zinc-900 text-sm text-zinc-500">
            {t("workspace.empty")}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-700 p-2">
        <textarea
          value={notes}
          disabled={!ready}
          aria-label={t("workspace.notes")}
          onChange={(e) => {
            const value = e.target.value; setNotes(value);
            try { localStorage.setItem(notesKey(urls), value); } catch (err) { setError(String(err)); }
          }}
          placeholder={t("workspace.notes")}
          className="h-20 w-full resize-none rounded bg-zinc-800 p-2 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-500"
        />
      </div>
    </div>
  );
}

function Pane({ url, index, reload, onError }: { url: string; index: number; reload: number; onError: (error: string) => void }) {
  const t = useT();
  const [key, setKey] = useState(0);
  const host = useHost(url);

  return (
    <div className="flex min-h-0 flex-col bg-zinc-900">
      <div className="flex items-center gap-1 border-b border-zinc-800 px-2 py-1">
        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400">{host}</span>
        <button
          type="button"
          title={t("preview.reload")}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
          onClick={() => setKey((k) => k + 1)}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title={t("preview.browser")}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
          onClick={() => cmd.openExternal(url).catch((e) => onError(String(e)))}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
      <iframe
        key={`${index}:${key}:${reload}`}
        title={`Pane ${index + 1}`}
        src={url}
        className="min-h-0 flex-1 border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
      />
    </div>
  );
}

function notesKey(urls: string[]): string { return `sve-workspace-notes:${JSON.stringify([...urls].sort())}`; }

function useHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
