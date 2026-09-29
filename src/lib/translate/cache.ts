// Small persistent cache for translated strings (memory + localStorage).
const mem = new Map<string, string>();
const LS_PREFIX = "sve.tr.";
const MAX_ENTRIES = 600;

function key(lang: string, text: string): string {
  return `v2:${lang}:${text.trim()}`;
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
  if (mem.size > MAX_ENTRIES) mem.delete(mem.keys().next().value!);
  try {
    localStorage.setItem(LS_PREFIX + k, translated);
    if (localStorage.length > MAX_ENTRIES) {
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
