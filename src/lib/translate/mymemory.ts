// MyMemory translation API client (free, keyless, CORS-enabled).
// Docs: https://mymemory.translated.net/doc/spec.php
const ENDPOINT = "https://api.mymemory.translated.net/get";
const CHUNK = 450; // Stay below the service's 500-byte UTF-8 query limit.

export class TranslationError extends Error {}

export function chunk(text: string, size: number): string[] {
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  const encoder = new TextEncoder();
  for (const character of text) {
    const length = encoder.encode(character).length;
    if (bytes + length > size && current) { out.push(current); current = ""; bytes = 0; }
    current += character; bytes += length;
  }
  if (current) out.push(current);
  return out.length > 0 ? out : [text];
}

/** Naive source-language guess (our sources are mostly en/ja/ko). */
export function guessSourceLanguage(text: string): string {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
  return "en";
}

export function languagePairLabel(from: string, to: string): string {
  return `${from}|${to}`;
}

export async function mymemoryTranslate(
  text: string,
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const parts: string[] = [];
  for (const piece of chunk(trimmed, CHUNK)) {
    if (signal?.aborted) throw new DOMException("Translation cancelled", "AbortError");
    const url = `${ENDPOINT}?q=${encodeURIComponent(piece)}&langpair=${encodeURIComponent(
      languagePairLabel(from, to)
    )}`;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) {
      throw new TranslationError(`translation request failed (${res.status})`);
    }
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number | string;
    };
    const out = data.responseData?.translatedText;
    if (data.responseStatus != null && Number(data.responseStatus) !== 200) {
      throw new TranslationError(`Translation service error (${data.responseStatus})`);
    }
    if (!out || typeof out !== "string") {
      throw new TranslationError("translation service returned no text");
    }
    if (/^MYMEMORY WARNING|^INVALID|QUERY LENGTH LIMIT|^NO QUERY SPECIFIED/i.test(out)) {
      throw new TranslationError(out);
    }
    parts.push(out);
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
  }
  return parts.join(" ");
}
