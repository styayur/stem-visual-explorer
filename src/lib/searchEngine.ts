// Deterministic, browser-side search: a faithful port of the Rust
// `search::{query, normalize, ranking}` modules. No AI, no network.
import type { ResultType, SearchResult } from "./types";

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

/** Bilingual (Chinese <-> English) STEM synonym groups. Deterministic. */
const SYNONYMS: Array<[string, string]> = [
  ["梯度", "gradient"],
  ["旋度", "curl"],
  ["散度", "divergence"],
  ["驻波", "standing wave"],
  ["简谐振动", "harmonic oscillator"],
  ["高斯定理", "gauss theorem"],
  ["高斯定理", "divergence theorem"],
  ["斯托克斯", "stokes theorem"],
  ["方向导数", "directional derivative"],
  ["电磁感应", "electromagnetic induction"],
  ["电磁波", "electromagnetic wave"],
  ["电磁场", "electromagnetic field"],
  ["电场", "electric field"],
  ["磁场", "magnetic field"],
  ["量子力学", "quantum mechanics"],
  ["量子", "quantum"],
  ["傅里叶", "fourier"],
  ["傅立叶", "fourier"],
  ["波动方程", "wave equation"],
  ["热力学", "thermodynamics"],
  ["力学", "mechanics"],
  ["光学", "optics"],
  ["相对论", "relativity"],
  ["导数", "derivative"],
  ["积分", "integral"],
  ["向量", "vector"],
  ["矢量", "vector"],
  ["矩阵", "matrix"],
  ["特征值", "eigenvalue"],
  ["微分方程", "differential equation"],
  ["偏导数", "partial derivative"],
  ["多重积分", "multiple integral"],
  ["傅里叶变换", "fourier transform"],
  ["简谐运动", "simple harmonic motion"],
  ["单摆", "pendulum"],
  ["波", "wave"],
  ["干涉", "interference"],
  ["衍射", "diffraction"],
  ["折射", "refraction"],
  ["反射", "reflection"],
  ["动量", "momentum"],
  ["能量", "energy"],
  ["熵", "entropy"],
  ["电势", "electric potential"],
  ["电路", "circuit"],
  ["电容", "capacitor"],
  ["电感", "inductor"],
  ["电阻", "resistance"],
  ["电流", "current"],
  ["电压", "voltage"],
  ["频率", "frequency"],
  ["波长", "wavelength"],
  ["振幅", "amplitude"],
  ["概率", "probability"],
  ["统计", "statistics"],
  ["拓扑", "topology"],
  ["流体", "fluid"],
  ["波动", "wave motion"],
  ["振动", "oscillation"],
  ["振荡", "oscillation"],
  ["谐振", "resonance"],
  ["光速", "speed of light"],
  ["加速度", "acceleration"],
  ["速度", "velocity"],
  ["位移", "displacement"],
  ["駐波", "standing wave"],
  ["簡諧振動", "harmonic oscillator"],
  ["電磁感應", "electromagnetic induction"],
  ["電場", "electric field"],
  ["磁場", "magnetic field"],
  ["傅里葉", "fourier"],
  ["傅立葉", "fourier"],
  ["導數", "derivative"],
  ["積分", "integral"],
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

function addWithSynonyms(term: string, set: Set<string>): void {
  const trimmed = term.trim();
  if (!trimmed) return;
  set.add(trimmed);

  const queue: string[] = [trimmed];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    for (const [from, to] of SYNONYMS) {
      const fromL = from.toLowerCase();
      const toL = to.toLowerCase();
      if (current === from || current === fromL) {
        for (const part of to.split(/\s+/)) {
          const p = part.toLowerCase();
          if (!set.has(p)) {
            set.add(p);
            queue.push(p);
          }
        }
        if (!set.has(toL)) {
          set.add(toL);
          queue.push(toL);
        }
      }
      if (current === to || current === toL) {
        if (!set.has(fromL)) {
          set.add(fromL);
          queue.push(fromL);
        }
      }
    }
  }
}

export function expand(parsed: ParsedQuery): NormalizedQuery {
  const set = new Set<string>();
  for (const t of parsed.terms) addWithSynonyms(t.toLowerCase(), set);
  for (const p of parsed.phrases) addWithSynonyms(p.toLowerCase(), set);
  // Match multiword English concepts even when the query is not quoted.
  for (let start = 0; start < parsed.terms.length; start++) {
    for (let size = 2; size <= 4 && start + size <= parsed.terms.length; size++) {
      const phrase = parsed.terms.slice(start, start + size).join(" ").toLowerCase();
      if (SYNONYMS.some(([from, to]) => from === phrase || to === phrase)) addWithSynonyms(phrase, set);
    }
  }
  return {
    raw: parsed.raw,
    tokens: Array.from(set).sort(),
    phrases: parsed.phrases,
    siteFilter: parsed.siteFilter,
    typeFilter: parsed.typeFilter,
  };
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
      query.tokens.length === 0 || query.tokens.some((t) => hay.includes(t));
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
  const titleContainsAll = parsed.terms.length + parsed.phrases.length > 0 &&
    parsed.terms.every((term) => expand(parseQuery(term)).tokens.some((t) => title.includes(t))) &&
    parsed.phrases.every((phrase) => title.includes(phrase));

  let score = 0;
  if (raw && title.trim() === raw.trim()) {
    score += 100;
  } else if (titleContainsAll) {
    score += 60;
  } else if (query.tokens.some((t) => title.includes(t))) {
    score += 30;
  }

  const tagMatches = tags.filter(
    (tag) => query.tokens.some((t) => tag === t || tag.includes(t))
  ).length;
  score += 20 * tagMatches;

  if (query.tokens.some((t) => desc.includes(t))) score += 10;

  if (["interactive", "simulation", "applet", "visualization"].includes(r.result_type)) {
    score += 5;
  }
  return score;
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
