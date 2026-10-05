import { L } from "../learning/types.ts";
import { getLearningProfile } from "../learning/registry.ts";
import { curriculumReferences } from "../learning/curriculum.ts";
import { visualizationCatalog } from "../visualizations/registry.ts";
import type { SearchResult } from "../lib/types";
import type {
  CapabilityGroup,
  CapabilityType,
  ConceptCapability,
} from "./types";

const groups: Record<CapabilityType, CapabilityGroup> = {
  "guided-lesson": "learn",
  visualization: "visualize",
  article: "read",
  textbook: "read",
  proof: "read",
  simulation: "explore",
  exercise: "practice",
};
export const capabilityGroup = (c: ConceptCapability) => groups[c.type];
export function capabilitiesForConcept(
  conceptId: string,
  resources: SearchResult[] = [],
): ConceptCapability[] {
  const p = getLearningProfile(conceptId);
  const native: ConceptCapability[] = visualizationCatalog
    .filter((v) => p?.visualizations.includes(v.id))
    .map((v) => ({
      id: v.id,
      conceptIds: v.conceptIds,
      type: "guided-lesson",
      title: v.title,
      availability: "native",
      visualizationId: v.id,
    }));
  const textbooks: ConceptCapability[] = curriculumReferences(conceptId).map(
    (r, i) => ({
      id: `textbook:${r.sourceId}:${conceptId}:${i}`,
      conceptIds: r.conceptIds,
      type: "textbook",
      title: L(r.section ?? r.book, r.section ?? r.book, r.section ?? r.book),
      description: L(
        `${r.collection} · ${r.book}`,
        `${r.collection} · ${r.book}`,
        `${r.collection} · ${r.book}`,
      ),
      availability: "external",
      url: r.url,
      provenance: {
        source: r.collection,
        sourceUrl: r.url,
        language: r.language,
        rightsStatus: r.rightsStatus,
      },
    }),
  );
  const external: ConceptCapability[] = resources
    .filter((r) => r.concept_ids?.includes(conceptId))
    .map((r) => ({
      id: `resource:${r.id}`,
      conceptIds: r.concept_ids ?? [],
      title: L(r.title, r.title, r.title),
      type: [
        "simulation",
        "interactive",
        "applet",
        "experiment",
        "visualization",
      ].includes(r.result_type)
        ? "simulation"
        : "article",
      availability: "external",
      url: r.url,
      resource: r,
      provenance: {
        source: r.source_name,
        sourceUrl: r.url,
        language: r.language ?? "unknown",
        rightsStatus: "unknown",
      },
    }));
  return [...native, ...textbooks, ...external];
}
export function groupCapabilities(capabilities: ConceptCapability[]) {
  return (
    ["learn", "visualize", "read", "explore", "practice"] as const
  ).flatMap((group) => {
    const items = capabilities.filter((c) => capabilityGroup(c) === group);
    return items.length ? [{ group, items }] : [];
  });
}
