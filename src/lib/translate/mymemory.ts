// MyMemory translation API client (free, keyless, CORS-enabled).
// Docs: https://mymemory.translated.net/doc/spec.php
const ENDPOINT = "https://api.mymemory.translated.net/get";
const CHUNK = 450; // anonymous requests are limited to ~500 chars

export class TranslationError extends Error {}

function chunk(text: string, size: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const token of text.split(/(\s+)/)) {
    if ((current + token).length > size && current.trim()) {
      out.push(current.trim());
      current = token;
    } else {
      current += token;
    }
    while (current.length > size) {
      out.push(current.slice(0, size));
      current = current.slice(size);
    }
  }
  if (current.trim()) out.push(current.trim());
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
  to: string
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return text;

  const parts: string[] = [];
  for (const piece of chunk(trimmed, CHUNK)) {
    const url = `${ENDPOINT}?q=${encodeURIComponent(piece)}&langpair=${encodeURIComponent(
      languagePairLabel(from, to)
    )}&de=stem-visual-explorer@users.noreply.github.com`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new TranslationError(`translation request failed (${res.status})`);
    }
    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number | string;
    };
    const out = data.responseData?.translatedText;
    if (!out || typeof out !== "string") {
      throw new TranslationError("translation service returned no text");
    }
    if (/^MYMEMORY WARNING|^INVALID|QUERY LENGTH LIMIT|^NO QUERY SPECIFIED/i.test(out)) {
      throw new TranslationError(out);
    }
    parts.push(out);
  }
  return parts.join(" ");
}