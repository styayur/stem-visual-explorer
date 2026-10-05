import { conceptById } from "../lib/concepts.ts";
import { getLearningProfile } from "../learning/registry.ts";
export function projectGraph(conceptId: string, limit = 20) {
  const c = conceptById.get(conceptId);
  if (!c) return [];
  const p = getLearningProfile(conceptId);
  const seen = new Set([conceptId]);
  const nodes: {
    id: string;
    relation: "current" | "prerequisites" | "next" | "related";
  }[] = [{ id: conceptId, relation: "current" }];
  for (const [relation, ids] of [
    ["prerequisites", p?.prerequisites ?? c.prerequisites],
    ["next", p?.nextConcepts ?? []],
    ["related", c.related],
  ] as const)
    for (const id of ids)
      if (
        !seen.has(id) &&
        conceptById.has(id) &&
        nodes.length < Math.max(1, Math.min(limit, 32))
      ) {
        seen.add(id);
        nodes.push({ id, relation });
      }
  return nodes;
}
