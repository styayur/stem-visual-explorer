import React from "react";
import { cn } from "../lib/cn";
import { attempt } from "../stores/noticeStore";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "accent" &&
          "border-indigo-500/40 bg-indigo-500/10 text-indigo-500 dark:text-indigo-300",
        tone === "muted" &&
          "border-edge-light bg-canvas-light text-zinc-500 dark:border-edge-dark dark:bg-canvas-dark dark:text-zinc-400",
        tone === "neutral" &&
          "border-edge-light bg-white text-zinc-600 dark:border-edge-dark dark:bg-surface-dark dark:text-zinc-300",
        className
      )}
    >
      {children}
    </span>
  );
}

export function IconButton({
  title,
  onClick,
  children,
  disabled,
  active,
}: {
  title: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => { void attempt(async () => onClick?.(e)); }}
      className={cn(
        "rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-800 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100",
        active && "bg-zinc-200/80 text-zinc-900 dark:bg-zinc-700/60 dark:text-zinc-50"
      )}
    >
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-edge-light bg-white px-1 py-0.5 font-mono text-[10px] text-zinc-500 dark:border-edge-dark dark:bg-surface-dark dark:text-zinc-400">
      {children}
    </kbd>
  );
}
