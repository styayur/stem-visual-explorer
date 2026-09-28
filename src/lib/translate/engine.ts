import { cacheGet, cacheSet } from "./cache";
import { glossaryLookup } from "./glossary";
import { guessSourceLanguage, mymemoryTranslate } from "./mymemory";
import { enqueue } from "./queue";

export type TranslationProvider = "glossary" | "cache" | "mymemory";

export interface TranslationResult {
  text: string;
  provider: TranslationProvider;
}

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
  source?: string
): Promise<TranslationResult> {
  const trimmed = text.trim();
  if (!trimmed) return { text, provider: "cache" };

  const instant = translateInstant(trimmed, target);
  if (instant) return instant;

  const from = source ?? guessSourceLanguage(trimmed);
  if (from === target) return { text: trimmed, provider: "cache" };

  const out = await enqueue(() => mymemoryTranslate(trimmed, from, target));
  cacheSet(target, trimmed, out);
  return { text: out, provider: "mymemory" };
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