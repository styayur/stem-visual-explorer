import type { IndexEntryLike } from "../lib/searchEngine";
import type { SearchResult } from "../lib/types";

export interface IndexedProvider {
  source_id: string;
  source_name: string;
  entries: IndexEntryLike[];
}
/** Direct semantic annotation membership, independent of any textual query. */
export function resourcesForConcept(
  conceptId: string,
  providers: IndexedProvider[],
): SearchResult[] {
  const found = new Map<string, SearchResult>();
  for (const p of providers)
    for (const e of p.entries)
      if (e.concept_ids?.includes(conceptId)) {
        const id = `${p.source_id}::${e.url}`;
        found.set(id, {
          ...e,
          id,
          source_id: p.source_id,
          source_name: p.source_name,
          score: 0,
          thumbnail: null,
        });
      }
  return [...found.values()].sort(
    (a, b) =>
      a.source_id.localeCompare(b.source_id) ||
      a.title.localeCompare(b.title) ||
      a.id.localeCompare(b.id),
  );
}
