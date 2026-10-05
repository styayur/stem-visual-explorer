import data from "./lexicon.json" with { type: "json" };
import ontology from "../lib/concepts.json" with { type: "json" };
import { normalizeQuery } from "./normalize.ts";
import type { EvidenceKind, QueryLexiconEntry } from "./types.ts";
export const queryLexicon = data as QueryLexiconEntry[];
export interface VocabularyEntry {
  text: string;
  ids: string[];
  kind: EvidenceKind;
  weight: number;
  ambiguous: boolean;
  requiresConceptIds?: string[];
}
const byText = new Map<string, VocabularyEntry[]>();
const insert = (
  text: string,
  ids: string[],
  kind: EvidenceKind,
  weight: number,
  ambiguous = false,
  requiresConceptIds?: string[],
) => {
  text = normalizeQuery(text);
  if (!text) return;
  const entries = byText.get(text) ?? [];
  entries.push({ text, ids, kind, weight, ambiguous, requiresConceptIds });
  byText.set(text, entries);
};
for (const c of ontology) {
  for (const text of [c.en, c.zh_cn, c.zh_tw, c.id])
    insert(text, [c.id], "canonical-label", 100);
  for (const text of c.synonyms) insert(text, [c.id], "ontology-alias", 96);
  for (const a of c.aliases.filter((a) => a.match !== "exact"))
    insert(a.text, [c.id], "ontology-alias", 96);
  if (c.en.startsWith("conservation of "))
    insert(
      `${c.en.slice(16)} conservation`,
      [c.id],
      "multi-token-composition",
      88,
    );
}
for (const e of queryLexicon)
  insert(
    e.pattern,
    e.conceptIds,
    e.kind === "historical"
      ? "historical-term"
      : e.kind === "abbreviation"
        ? "abbreviation"
        : "query-lexicon",
    e.kind === "abbreviation" ? 86 : Math.round(e.confidence * 92),
    !!e.ambiguous,
    e.requiresConceptIds,
  );
export const vocabulary: VocabularyEntry[] = [];
for (const [text, entries] of byText) {
  // Canonical spelling beats incidental synonym collisions. Lexicon ambiguity remains explicit.
  const explicit = entries.find((e) => e.ambiguous);
  const weight = explicit?.weight ?? Math.max(...entries.map((e) => e.weight));
  const chosen = explicit
    ? [explicit]
    : entries.filter((e) => e.weight === weight);
  vocabulary.push({
    text,
    ids: [...new Set(chosen.flatMap((e) => e.ids))].sort(),
    kind: chosen[0].kind,
    weight,
    requiresConceptIds: chosen[0].requiresConceptIds,
    ambiguous: !!explicit || new Set(chosen.flatMap((e) => e.ids)).size > 1,
  });
}
export const vocabularyByInitial = new Map<string, VocabularyEntry[]>();
export const typoByLength = new Map<number, VocabularyEntry[]>();
for (const e of vocabulary) {
  const key = e.text[0];
  vocabularyByInitial.set(key, [...(vocabularyByInitial.get(key) ?? []), e]);
  if (
    /^[a-z]+(?: [a-z]+)*$/.test(e.text) &&
    !e.ambiguous &&
    e.kind !== "abbreviation"
  ) {
    const size = e.text.split(" ").length;
    typoByLength.set(size, [...(typoByLength.get(size) ?? []), e]);
  }
}
