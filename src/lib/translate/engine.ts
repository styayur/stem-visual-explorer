import { cacheGet, cacheSet } from "./cache";
import { glossaryLookup } from "./glossary";
import { guessSourceLanguage, mymemoryTranslate } from "./mymemory";
import { enqueue } from "./queue";

export type TranslationProvider = "glossary" | "cache" | "mymemory";

export interface TranslationResult {
  text: string;
  provider: TranslationProvider;
}
const pending = new Map<string, { request: Promise<TranslationResult>; controller: AbortController; users: Set<symbol> }>();

/** Synchronous, offline path (glossary + cache). Returns null when unknown. */
export function translateInstant(text: string, target: string): TranslationResult | null {
  const cached = cacheGet(target, text);
  if (cached !== null) return { text: cached, provider: "cache" };
  const gloss = glossaryLookup(text, target);
  if (gloss !== null) return { text: gloss, provider: "glossary" };
  return null;
}

/**
 * Translate a string. Order: cache -> offline glossary -> MyMemory.
 * Throws `TranslationError` if the network service fails.
 */
export async function translateText(
  text: string,
  target: string,
  source?: string,
  signal?: AbortSignal
): Promise<TranslationResult> {
  const trimmed = text.trim();
  if (!trimmed) return { text, provider: "cache" };

  const instant = translateInstant(trimmed, target);
  if (instant) return instant;

  const from = source ?? guessSourceLanguage(trimmed);
  if (from === target) return { text: trimmed, provider: "cache" };

  const key = JSON.stringify([from, target, trimmed]);
  if (signal?.aborted) throw new DOMException("Translation cancelled", "AbortError");
  let entry = pending.get(key);
  if (!entry || entry.controller.signal.aborted) {
    const controller = new AbortController();
    const request = enqueue(async () => {
      if (controller.signal.aborted) throw new DOMException("Translation cancelled", "AbortError");
      const out = await mymemoryTranslate(trimmed, from, target, controller.signal);
      cacheSet(target, trimmed, out);
      return { text: out, provider: "mymemory" as const };
    }, controller.signal);
    entry = { request, controller, users: new Set() };
    pending.set(key, entry);
  }
  const active = entry;
  const user = Symbol();
  active.users.add(user);
  const release = () => {
    active.users.delete(user);
    if (!active.users.size) active.controller.abort();
  };
  signal?.addEventListener("abort", release, { once: true });
  try { return await active.request; }
  finally {
    signal?.removeEventListener("abort", release);
    release();
    if (pending.get(key) === active) pending.delete(key);
  }
}

/** Translate with an offline fallback (never throws). */
export async function translateSoft(
  text: string,
  target: string
): Promise<TranslationResult | null> {
  try {
    return await translateText(text, target);
  } catch {
    return translateInstant(text, target);
  }
}
