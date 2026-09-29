// A tiny concurrency-limited queue so bulk translation stays within the free
// API's rate limits.
type Job = () => Promise<void>;

const MAX_CONCURRENT = 3;
const MIN_GAP_MS = 220;

let active = 0;
let lastStart = 0;
const waiting: Job[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function pump(): void {
  if (active >= MAX_CONCURRENT || waiting.length === 0) return;
  const now = Date.now();
  const wait = Math.max(0, MIN_GAP_MS - (now - lastStart));
  if (wait > 0) {
    timer ??= setTimeout(() => { timer = undefined; pump(); }, wait);
    return;
  }
  const job = waiting.shift() as Job;
  active++;
  lastStart = Date.now();
  job()
    .catch(() => undefined)
    .finally(() => {
      active--;
      pump();
    });
  pump();
}

export function enqueue<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Translation cancelled", "AbortError")); return; }
    const job = async () => {
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      } finally { signal?.removeEventListener("abort", cancel); }
    };
    const cancel = () => {
      const index = waiting.indexOf(job);
      if (index >= 0) {
        waiting.splice(index, 1);
        signal?.removeEventListener("abort", cancel);
        reject(new DOMException("Translation cancelled", "AbortError"));
      }
    };
    waiting.push(job);
    signal?.addEventListener("abort", cancel, { once: true });
    pump();
  });
}
