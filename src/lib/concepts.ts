import data from "./concepts.json" with { type: "json" };
import { historicalAliases } from "../learning/historicalAliases.ts";

export type MatchMode = "exact" | "phrase" | "token" | "cjk-substring";
export type MatchTier = "direct" | "equivalent" | "exploratory";
export interface Concept {
  id: string;
  en: string;
  zh_cn: string;
  zh_tw: string;
  synonyms: string[];
  aliases: { text: string; match: MatchMode }[];
  subject: string;
  level: string[];
  related: string[];
  prerequisites: string[];
}
export interface QueryVariant {
  text: string;
  concept_id: string | null;
  kind:
    | "original"
    | "canonical"
    | "synonym"
    | "alternate"
    | "related"
    | "prerequisite";
  tier: MatchTier;
  match: MatchMode;
  weight: number;
}
export interface ConceptGroup {
  id: string;
  concept_id: string | null;
  variants: QueryVariant[];
}
export const concepts = data as Concept[];
export const conceptById = new Map(concepts.map((c) => [c.id, c]));
export const normalizeTerm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ");
export const matchMode = (s: string): MatchMode =>
  /[\u3040-\u30ff\u3400-\u9fff]/.test(s)
    ? "cjk-substring"
    : normalizeTerm(s).includes(" ")
      ? "phrase"
      : /^[a-z]$/i.test(s)
        ? "exact"
        : "token";
const word = (s: string | undefined) => !!s && /[\p{L}\p{N}_]/u.test(s);
/** Both sides of an ASCII token/phrase must be word boundaries. URLs never enter this function as a search field. */
export function matches(
  text: string,
  variant: Pick<QueryVariant, "text" | "match">,
): boolean {
  text = normalizeTerm(text);
  const needle = normalizeTerm(variant.text);
  if (!needle) return false;
  if (variant.match === "exact") return text === needle;
  if (variant.match === "cjk-substring") return text.includes(needle);
  let at = text.indexOf(needle);
  while (at >= 0) {
    if (
      !word(Array.from(text.slice(0, at)).slice(-1)[0]) &&
      !word(Array.from(text.slice(at + needle.length))[0])
    )
      return true;
    at = text.indexOf(needle, at + 1);
  }
  return false;
}
export const conceptNames = (c: Concept) => [
  c.en,
  c.zh_cn,
  c.zh_tw,
  ...c.synonyms,
];
const lookup = new Map<string, Concept>();
for (const c of concepts)
  for (const n of [
    c.id,
    ...conceptNames(c),
    ...c.aliases.filter((a) => a.match !== "exact").map((a) => a.text),
  ]) {
    const key = normalizeTerm(n);
    // Canonical labels take precedence over an ambiguous synonym. Validator reports collisions.
    if (!lookup.has(key) || [c.en, c.zh_cn, c.zh_tw].includes(n))
      lookup.set(key, c);
  }
// Opt-in historical query recognition is kept outside canonical labels and recall.
for (const alias of historicalAliases) {
  const concept = conceptById.get(alias.conceptId);
  if (concept && !lookup.has(normalizeTerm(alias.text))) lookup.set(normalizeTerm(alias.text), concept);
}
const maxWords = Math.max(
  ...[...lookup.keys()].map((n) => n.split(" ").length),
);
export function normalizeConcepts(terms: string[], phrases: string[] = []) {
  const variants = new Map<string, QueryVariant>();
  const ids = new Set<string>();
  const add = (
    text: string,
    concept_id: string | null,
    kind: QueryVariant["kind"],
    weight: number,
    match = matchMode(text),
  ) => {
    text = normalizeTerm(text);
    if (!text) return;
    const key = `${concept_id ?? ""}\0${text}`;
    const tier: MatchTier =
      kind === "related" || kind === "prerequisite"
        ? "exploratory"
        : kind === "synonym" || kind === "alternate"
          ? "equivalent"
          : "direct";
    if ((variants.get(key)?.weight ?? 0) < weight)
      variants.set(key, { text, concept_id, kind, weight, tier, match });
  };
  const original = (text: string) => {
    const c = lookup.get(normalizeTerm(text));
    if (c) ids.add(c.id);
    add(text, c?.id ?? null, "original", 1);
  };
  for (let start = 0; start < terms.length; ) {
    let size = Math.min(maxWords, terms.length - start);
    while (
      size > 1 &&
      !lookup.has(normalizeTerm(terms.slice(start, start + size).join(" ")))
    )
      size--;
    original(terms.slice(start, start + size).join(" "));
    start += size;
  }
  phrases.forEach(original);
  for (const id of [...ids].sort()) {
    const c = conceptById.get(id)!;
    [c.en, c.zh_cn, c.zh_tw].forEach((n) => add(n, id, "canonical", 0.95));
    c.synonyms.forEach((n) => add(n, id, "synonym", 0.9));
    // Single-character formula symbols are stored, but disabled for free-text resolution and recall.
    c.aliases
      .filter((a) => a.match !== "exact")
      .forEach((a) => add(a.text, id, "alternate", 0.75, a.match));
    for (const [kind, edges] of [
      ["related", c.related],
      ["prerequisite", c.prerequisites],
    ] as const)
      for (const edge of edges) {
        if (ids.has(edge)) continue;
        const target = conceptById.get(edge)!;
        [target.en, target.zh_cn, target.zh_tw].forEach((n) =>
          add(n, edge, kind, 0.35),
        );
      }
  }
  const sorted = [...variants.values()].sort((a, b) => {
    const x = `${a.concept_id ?? ""}\0${a.text}`,
      y = `${b.concept_id ?? ""}\0${b.text}`;
    return x < y ? -1 : x > y ? 1 : 0;
  });
  const groups = new Map<string, ConceptGroup>();
  for (const v of sorted.filter((v) => v.tier !== "exploratory")) {
    const id = v.concept_id ?? v.text;
    if (!groups.has(id))
      groups.set(id, { id, concept_id: v.concept_id, variants: [] });
    groups.get(id)!.variants.push(v);
  }
  return {
    concept_ids: [...ids].sort(),
    variants: sorted,
    groups: [...groups.values()].sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    ),
  };
}
export function annotateResource(
  title: string,
  tags: string[],
  description: string | null = null,
  url = "",
) {
  const concept_evidence: Record<string, string[]> = {};
  for (const c of concepts) {
    const names = [
      ...conceptNames(c).map((text) => ({ text, match: matchMode(text) })),
      ...c.aliases.filter((a) => a.match !== "exact"),
    ];
    const fields: [string, string[]][] = [
      ["title", [title]],
      ["tags", tags],
      ["description", [description ?? ""]],
    ];
    const evidence = fields
      .filter(([, values]) =>
        values.some((value) => names.some((n) => matches(value, n))),
      )
      .map(([field]) => field);
    if (evidence.length) concept_evidence[c.id] = evidence;
  }
  const concept_ids = Object.keys(concept_evidence).sort();
  return {
    concept_ids,
    concept_evidence,
    subject: [
      ...new Set(concept_ids.map((id) => conceptById.get(id)!.subject)),
    ].sort(),
    language:
      /^https?:\/\/maotian\.nomaki\.jp(?:\/|$)/.test(url) ||
      /[\u3040-\u30ff]/.test(title)
        ? "ja"
        : /[\u3400-\u9fff]/.test(title)
          ? "zh"
          : "en",
  };
}
export function resourceConcepts(title: string, tags: string[]) {
  const found = annotateResource(title, tags).concept_ids.map(
    (id) => conceptById.get(id)!,
  );
  const related = [...new Set(found.flatMap((c) => c.related))].sort();
  const prerequisites = [
    ...new Set(found.flatMap((c) => c.prerequisites)),
  ].sort();
  return {
    concepts: found,
    related: related.map((id) => conceptById.get(id)!),
    prerequisites: prerequisites.map((id) => conceptById.get(id)!),
  };
}
