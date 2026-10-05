import type { MatchSpan } from "./types.ts";
import { compare } from "./tokenize.ts";
export const SCORE_THRESHOLD = 70;
export const SCORE_MARGIN = 8;
export const UNEXPLAINED_CONTENT_PENALTY = 45;
/** Longer lexical compositions claim their component tokens; independent spans remain AND groups. */
export function selectSpans(spans: MatchSpan[]): MatchSpan[] {
  const ordered = spans
    .slice()
    .sort(
      (a, b) =>
        b.end - b.start - (a.end - a.start) ||
        b.weight - a.weight ||
        a.start - b.start ||
        compare(a.ids.join(","), b.ids.join(",")),
    );
  const selected: MatchSpan[] = [];
  for (const s of ordered) {
    if (selected.some((x) => s.start < x.end && s.end > x.start)) continue;
    const rivals = spans.filter(
      (x) =>
        x.start === s.start &&
        x.end === s.end &&
        x.ids.join(",") !== s.ids.join(","),
    );
    const close = rivals.filter((x) => s.weight - x.weight < SCORE_MARGIN);
    selected.push({
      ...s,
      ambiguous: s.ambiguous || close.length > 0,
      ids: [...new Set([s, ...close].flatMap((x) => x.ids))].sort(),
    });
  }
  return selected.sort((a, b) => a.start - b.start);
}
