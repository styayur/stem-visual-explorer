import data from "./concepts.json" with { type: "json" };

export interface Concept {
  id: string; en: string; zh_cn: string; zh_tw: string;
  synonyms: string[]; aliases: string[]; related: string[]; prerequisites: string[];
}
export interface QueryVariant {
  text: string;
  concept_id: string | null;
  kind: "original" | "canonical" | "synonym" | "alternate" | "related";
  weight: number;
}
export const concepts: Concept[] = data;
export const conceptById = new Map(concepts.map((c) => [c.id, c]));
export const normalizeTerm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const names = (c: Concept) => [c.id, c.en, c.zh_cn, c.zh_tw, ...c.synonyms, ...c.aliases];
const lookup = new Map(concepts.flatMap((c) => names(c).map((n) => [normalizeTerm(n), c] as const)));
const maxWords = Math.max(...[...lookup.keys()].map((n) => n.split(" ").length));

/** Greedy longest match avoids treating “partial derivative” as two concepts. */
export function normalizeConcepts(terms: string[], phrases: string[] = []) {
  const variants = new Map<string, QueryVariant>();
  const ids = new Set<string>();
  const add = (text: string, concept_id: string | null, kind: QueryVariant["kind"], weight: number) => {
    text = normalizeTerm(text);
    if (!text) return;
    const key = `${concept_id ?? ""}\0${text}`;
    if ((variants.get(key)?.weight ?? 0) < weight) variants.set(key, { text, concept_id, kind, weight });
  };
  const original = (text: string) => {
    const c = lookup.get(normalizeTerm(text));
    if (c) ids.add(c.id);
    add(text, c?.id ?? null, "original", 1);
  };
  for (let start = 0; start < terms.length;) {
    let size = Math.min(maxWords, terms.length - start);
    while (size > 1 && !lookup.has(normalizeTerm(terms.slice(start, start + size).join(" ")))) size--;
    original(terms.slice(start, start + size).join(" "));
    start += size;
  }
  phrases.forEach(original);
  for (const id of [...ids].sort()) {
    const c = conceptById.get(id)!;
    [c.en, c.zh_cn, c.zh_tw].forEach((n) => add(n, id, "canonical", .95));
    c.synonyms.forEach((n) => add(n, id, "synonym", .9));
    c.aliases.forEach((n) => add(n, id, "alternate", .75));
    // One hop only; prerequisites are explanatory metadata, not query expansion.
    for (const related of c.related) {
      if (ids.has(related)) continue;
      const target = conceptById.get(related)!;
      [target.en, target.zh_cn, target.zh_tw].forEach((n) => add(n, related, "related", .35));
    }
  }
  return { concept_ids: [...ids].sort(), variants: [...variants.values()].sort((a, b) => {
    const ak = `${a.concept_id ?? ""}\0${a.text}`, bk = `${b.concept_id ?? ""}\0${b.text}`;
    return ak < bk ? -1 : ak > bk ? 1 : 0;
  }) };
}

/** Dictionary annotations, not claims extracted from or supplied by a source. */
export function resourceConcepts(title: string, tags: string[]) {
  const text = normalizeTerm([title, ...tags].join(" "));
  const contains = (name: string) => {
    const n = normalizeTerm(name);
    if (/^[\x00-\x7f]+$/.test(n)) {
      const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(text);
    }
    return text.includes(n);
  };
  const found = concepts.filter((c) => names(c).some(contains));
  const related = [...new Set(found.flatMap((c) => c.related))].sort();
  const prerequisites = [...new Set(found.flatMap((c) => c.prerequisites))].sort();
  return { concepts: found, related: related.map((id) => conceptById.get(id)!), prerequisites: prerequisites.map((id) => conceptById.get(id)!) };
}
