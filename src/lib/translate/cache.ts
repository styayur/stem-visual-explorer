// Small persistent cache for translated strings (memory + localStorage).
const mem = new Map<string, string>();
const LS_PREFIX = "sve.tr.";
const MAX_ENTRIES = 600;

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function key(lang: string, text: string): string {
  return `${lang}:${hash(text)}`;
}

export function cacheGet(lang: string, text: string): string | null {
  const k = key(lang, text);
  if (mem.has(k)) return mem.get(k) as string;
  try {
    const raw = localStorage.getItem(LS_PREFIX + k);
    if (raw !== null) {
      mem.set(k, raw);
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function cacheSet(lang: string, text: string, translated: string): void {
  const k = key(lang, text);
  mem.set(k, translated);
  try {
    localStorage.setItem(LS_PREFIX + k, translated);
    if (mem.size > MAX_ENTRIES) {
      // Best-effort pruning of the oldest persisted entries.
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const lk = localStorage.key(i);
        if (lk && lk.startsWith(LS_PREFIX)) keys.push(lk);
      }
      for (const lk of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) {
        localStorage.removeItem(lk);
      }
    }
  } catch {
    /* ignore quota errors */
  }
}

export function cacheClear(): number {
  const n = mem.size;
  mem.clear();
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const lk = localStorage.key(i);
      if (lk && lk.startsWith(LS_PREFIX)) keys.push(lk);
    }
    for (const lk of keys) localStorage.removeItem(lk);
  } catch {
    /* ignore */
  }
  return n;
}