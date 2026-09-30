// Deterministic, browser-side search: a faithful port of the Rust
// `search::{query, normalize, ranking}` modules. No AI, no network.
import type { ResultType, SearchResult } from "./types";
import { normalizeConcepts, type QueryVariant } from "./concepts.ts";

export interface ParsedQuery {
  raw: string;
  terms: string[];
  phrases: string[];
  siteFilter: string | null;
  typeFilter: ResultType | null;
}

export interface NormalizedQuery {
  raw: string;
  tokens: string[];
  variants: QueryVariant[];
  concept_ids: string[];
  phrases: string[];
  siteFilter: string | null;
  typeFilter: ResultType | null;
}

const RESULT_TYPE_VALUES: ResultType[] = [
  "article",
  "interactive",
  "simulation",
  "applet",
  "experiment",
  "visualization",
  "video",
];

function parseResultType(s: string): ResultType | null {
  const v = s as ResultType;
  return RESULT_TYPE_VALUES.includes(v) ? v : null;
}

/** Tiny command-syntax parser: site:/source:/type:/"exact phrase". */
export function parseQuery(raw: string): ParsedQuery {
  const out: ParsedQuery = {
    raw: raw.trim(),
    terms: [],
    phrases: [],
    siteFilter: null,
    typeFilter: null,
  };

  const tokens: string[] = [];
  let i = 0;
  const s = raw;

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"') {
      i++;
      let phrase = "";
      while (i < s.length && s[i] !== '"') {
        phrase += s[i++];
      }
      if (i < s.length) i++;
      if (phrase.trim()) out.phrases.push(whitespace(phrase).toLowerCase());
      continue;
    }
    let start = i;
    while (i < s.length && !/\s/.test(s[i])) i++;
    tokens.push(s.slice(start, i));
  }

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.startsWith("site:") && lower.length > 5) {
      out.siteFilter = lower.slice(5);
    } else if (lower.startsWith("source:") && lower.length > 7) {
      out.siteFilter = lower.slice(7);
    } else if (lower.startsWith("type:") && lower.length > 5) {
      out.typeFilter = parseResultType(lower.slice(5));
    } else {
      out.terms.push(token);
    }
  }
  return out;
}

export function expand(parsed: ParsedQuery): NormalizedQuery {
  const normalized = normalizeConcepts(parsed.terms, parsed.phrases);
  // Preserve expanded_terms for old clients; matching/scoring uses full variants.
  const tokens = [...new Set(normalized.variants.flatMap((v) => [v.text, ...v.text.split(/\s+/)]))].sort();
  return { raw: parsed.raw, tokens, ...normalized, phrases: parsed.phrases,
    siteFilter: parsed.siteFilter, typeFilter: parsed.typeFilter };
}

export function parseAndExpand(raw: string): NormalizedQuery {
  return expand(parseQuery(raw));
}

function whitespace(s: string): string {
  return s.split(/\s+/).filter(Boolean).join(" ");
}

export interface IndexEntryLike {
  title: string;
  description: string | null;
  url: string;
  result_type: ResultType;
  tags: string[];
  thumbnail: string | null;
}

/** Candidate matching against one provider's index. */
export function matchEntries(
  entries: IndexEntryLike[],
  sourceId: string,
  sourceName: string,
  query: NormalizedQuery
): SearchResult[] {
  if (query.tokens.length === 0 && query.phrases.length === 0 && !query.siteFilter && !query.typeFilter) return [];

  const out: SearchResult[] = [];
  for (const e of entries) {
    try { if (!["http:", "https:"].includes(new URL(e.url).protocol)) continue; } catch { continue; }
    const hay = whitespace(
      `${e.title} ${e.tags.join(" ")} ${e.description ?? ""} ${e.url}`
    ).toLowerCase();

    if (!query.phrases.every((p) => hay.includes(p))) continue;

    const tokenOk =
      query.tokens.length === 0 || query.variants.some((v) => hay.includes(v.text));
    if (!tokenOk) continue;

    out.push({
      id: `${sourceId}::${e.url}`,
      source_id: sourceId,
      source_name: sourceName,
      title: e.title,
      description: e.description,
      url: e.url,
      result_type: e.result_type,
      tags: e.tags,
      score: 0,
      thumbnail: e.thumbnail,
    });
  }
  return out;
}

/** Transparent, deterministic relevance score (mirrors the Rust rules). */
export function scoreResult(query: NormalizedQuery, r: SearchResult): number {
  const title = r.title.toLowerCase();
  const tags = r.tags.map((t) => t.toLowerCase());
  const desc = (r.description ?? "").toLowerCase();
  const parsed = parseQuery(query.raw);
  const raw = [...parsed.terms, ...parsed.phrases].join(" ").toLowerCase();
  const best = (text: string, variants = query.variants) => Math.max(0, ...variants.filter((v) => text.includes(v.text)).map((v) => v.weight));
  const groups = new Map<string, QueryVariant[]>();
  for (const v of query.variants.filter((v) => v.kind !== "related")) {
    const key = v.concept_id ?? v.text;
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }
  const allWeight = groups.size && query.phrases.every((p) => title.includes(p))
    ? Math.min(...[...groups.values()].map((vs) => best(title, vs))) : 0;
  let score = raw && title.trim() === raw.trim() ? 100 : allWeight > 0 ? 60 * allWeight : 30 * best(title);
  // Each field is capped at its strongest variant, so aliases cannot inflate rank.
  score += 20 * best(tags.join(" ")) + 10 * best(desc);

  if (["interactive", "simulation", "applet", "visualization"].includes(r.result_type)) {
    score += 5;
  }
  return Math.round(score * 1000) / 1000;
}

export function rankResults(query: NormalizedQuery, results: SearchResult[]): SearchResult[] {
  for (const r of results) r.score = scoreResult(query, r);
  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.source_name !== b.source_name) return a.source_name < b.source_name ? -1 : 1;
    const at = a.title.toLowerCase();
    const bt = b.title.toLowerCase();
    return at < bt ? -1 : at > bt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
