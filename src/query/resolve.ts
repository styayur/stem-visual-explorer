import { normalizeQuery, MAX_QUERY_LENGTH } from "./normalize.ts";
import { stripScaffolding, tokenize, compare } from "./tokenize.ts";
import { generateCandidates } from "./candidates.ts";
import {
  selectSpans,
  SCORE_THRESHOLD,
  UNEXPLAINED_CONTENT_PENALTY,
} from "./scoring.ts";
import type { QueryResolution, RankedConceptCandidate } from "./types.ts";
import rules from "./rules.json" with { type: "json" };
export function resolveQuery(raw: string): QueryResolution {
  const empty = (reason: string): QueryResolution => ({
    normalizedQuery: "",
    groups: [],
    conceptIds: [],
    candidates: [],
    status: "unknown",
    confidence: 0,
    explanation: [],
    residualTerms: [],
    reason,
  });
  if (
    raw.length > MAX_QUERY_LENGTH ||
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
      raw,
    )
  )
    return empty("input-bound");
  const normalizedQuery = normalizeQuery(raw);
  if (!normalizedQuery) return empty("empty");
  let depth = 0;
  for (const c of normalizedQuery) {
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (depth < 0 || depth > 32)
      return { ...empty("malformed-structure"), normalizedQuery };
  }
  if (depth !== 0) return { ...empty("malformed-structure"), normalizedQuery };
  const text = normalizedQuery;
  const spans = selectSpans(generateCandidates(text));
  let remainder = text;
  for (const s of spans.slice().reverse())
    remainder =
      remainder.slice(0, s.start) +
      " ".repeat(s.end - s.start) +
      remainder.slice(s.end);
  remainder = stripScaffolding(remainder)
    .replace(/[\s,;:?!."()]+/g, " ")
    .trim();
  const penalty = /[\p{L}\p{N}]/u.test(remainder)
    ? UNEXPLAINED_CONTENT_PENALTY
    : 0;
  const byId = new Map<string, RankedConceptCandidate>();
  for (const span of spans)
    for (const id of span.ids) {
      const score = span.weight - penalty - (span.ambiguous ? 10 : 0);
      const candidate = byId.get(id) ?? {
        conceptId: id,
        score,
        evidence: [],
        matchedTerms: [],
        penalties: [],
      };
      candidate.score = Math.max(candidate.score, score);
      candidate.evidence.push(...span.evidence);
      if (
        Array.from(raw).some((c) =>
          Object.prototype.hasOwnProperty.call(rules.scripts, c),
        )
      )
        candidate.evidence.push({
          kind: "script-normalization",
          input: raw,
          matched: normalizedQuery,
        });
      candidate.matchedTerms.push(text.slice(span.start, span.end));
      candidate.penalties = [
        ...(penalty ? ["unexplained-content"] : []),
        ...(span.ambiguous ? ["competing-meaning"] : []),
      ];
      byId.set(id, candidate);
    }
  const candidates = [...byId.values()].sort(
    (a, b) => b.score - a.score || compare(a.conceptId, b.conceptId),
  );
  const strong = candidates.filter((c) => c.score >= SCORE_THRESHOLD);
  const ambiguous = strong.length > 0 && spans.some((s) => s.ambiguous);
  const conceptIds = ambiguous ? [] : strong.map((c) => c.conceptId).sort();
  const groups = ambiguous
    ? []
    : spans
        .filter((s) => s.ids.some((id) => conceptIds.includes(id)))
        .map((s) => ({
          input: text.slice(s.start, s.end),
          conceptIds: s.ids.filter((id) => conceptIds.includes(id)),
        }));
  const status = ambiguous
    ? "ambiguous"
    : conceptIds.length
      ? "resolved"
      : "unknown";
  return {
    normalizedQuery,
    groups,
    conceptIds,
    candidates,
    status,
    confidence:
      status === "resolved" ? Math.min(...strong.map((c) => c.score)) / 100 : 0,
    explanation: candidates.flatMap((c) => c.evidence),
    residualTerms:
      status === "resolved"
        ? tokenize(remainder)
        : text.split(/\s+/).filter(Boolean),
    reason: ambiguous
      ? "competing-meaning"
      : status === "unknown"
        ? penalty
          ? "unexplained-content"
          : "insufficient-evidence"
        : "sufficient-evidence",
  };
}
