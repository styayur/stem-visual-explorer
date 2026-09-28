import { useEffect, useState } from "react";
import { ExternalLink, RotateCw } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import * as cmd from "../lib/commands";
import { cn } from "../lib/cn";

export default function Workspace() {
  const [urls, setUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState(
    () => localStorage.getItem("sve-workspace-notes") ?? ""
  );
  const [reload, setReload] = useState(0);
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const win = getCurrentWebviewWindow();
        const l = win.label;
        setLabel(l);
        const items = await cmd.getWorkspaceItems(l);
        if (mounted) setUrls(items);
      } catch {
        // Browser fallback for `vite dev`.
        const params = new URLSearchParams(window.location.search);
        const raw = params.get("items");
        if (raw) setUrls(JSON.parse(decodeURIComponent(raw)));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("sve-workspace-notes", notes);
  }, [notes]);

  const gridClass =
    urls.length <= 1
      ? "grid-cols-1"
      : urls.length === 2
        ? "grid-cols-2"
        : urls.length === 3
          ? "grid-cols-2"
          : "grid-cols-2";

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <div className="flex items-center gap-3 border-b border-zinc-700 px-3 py-2">
        <span className="text-[13px] font-semibold">Workspace</span>
        <span className="text-[11px] text-zinc-400">{urls.length} panes</span>
        <button
          type="button"
          className="ml-auto rounded px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-700"
          onClick={() => setReload((r) => r + 1)}
        >
          Reload all
        </button>
        <button
          type="button"
          className="rounded px-2 py-1 text-[12px] text-zinc-300 hover:bg-zinc-700"
          onClick={() => urls.forEach((u) => cmd.openExternal(u))}
        >
          Open all externally
        </button>
      </div>

      <div className={cn("grid min-h-0 flex-1 gap-px bg-zinc-700", gridClass)}>
        {urls.map((u, i) => (
          <Pane key={`${u}:${i}`} url={u} index={i} reload={reload} />
        ))}
        {urls.length === 0 && (
          <div className="flex items-center justify-center bg-zinc-900 text-sm text-zinc-500">
            No items. Select results and choose “Open Workspace”.
          </div>
        )}
      </div>

      <div className="border-t border-zinc-700 p-2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for this workspace…"
          className="h-20 w-full resize-none rounded bg-zinc-800 p-2 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-500"
        />
      </div>
    </div>
  );
}

function Pane({ url, index, reload }: { url: string; index: number; reload: number }) {
  const [key, setKey] = useState(0);
  const host = useHost(url);

  return (
    <div className="flex min-h-0 flex-col bg-zinc-900">
      <div className="flex items-center gap-1 border-b border-zinc-800 px-2 py-1">
        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-400">
          {host}
        </span>
        <button
          type="button"
          title="Reload pane"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
          onClick={() => setKey((k) => k + 1)}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Open externally"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
          onClick={() => cmd.openExternal(url)}
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

function useHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}