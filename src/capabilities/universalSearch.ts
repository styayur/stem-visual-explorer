import { parseAndExpand } from "../lib/searchEngine.ts";
import { conceptById } from "../lib/concepts.ts";
import { localize } from "../learning/types.ts";
import { capabilitiesForConcept } from "./registry.ts";
import type { SearchResult, UiLocale } from "../lib/types";
export interface ObjectSearchEntry {
  id: string;
  group:
    | "concept"
    | "lesson"
    | "visualization"
    | "resource"
    | "textbook"
    | "command";
  title: string;
  conceptId: string;
  capabilityId?: string;
  visualizationId?: string;
  surface?: "overview" | "graph" | "visualize" | "resources";
}
/** Concept resolution is still the existing ontology resolver. No second matcher. */
export function universalObjects(
  query: string,
  locale: UiLocale,
  resources: SearchResult[] = [],
): ObjectSearchEntry[] {
  const ids = parseAndExpand(query).concept_ids;
  const out: ObjectSearchEntry[] = [];
  for (const id of ids.slice(0, 4)) {
    const c = conceptById.get(id)!;
    const name =
      locale === "zh-CN" ? c.zh_cn : locale === "zh-TW" ? c.zh_tw : c.en;
    out.push({
      id: `concept:${id}`,
      group: "concept",
      title: name,
      conceptId: id,
      surface: "overview",
    });
    for (const cap of capabilitiesForConcept(id, resources).slice(0, 8))
      out.push({
        id: cap.id,
        group: cap.visualizationId
          ? "lesson"
          : cap.type === "textbook"
            ? "textbook"
            : "resource",
        title: localize(cap.title, locale),
        conceptId: id,
        capabilityId: cap.id,
        visualizationId: cap.visualizationId,
        surface: cap.visualizationId ? "visualize" : "resources",
      });
    for (const cap of capabilitiesForConcept(id).filter(
      (c) => c.visualizationId,
    ))
      out.push({
        id: `visualize:${cap.id}`,
        group: "visualization",
        title: localize(cap.title, locale),
        conceptId: id,
        capabilityId: cap.id,
        visualizationId: cap.visualizationId,
        surface: "visualize",
      });
    out.push({
      id: `graph:${id}`,
      group: "command",
      title:
        locale === "en"
          ? `Show graph: ${name}`
          : `${locale === "zh-CN" ? "显示概念图" : "顯示概念圖"}：${name}`,
      conceptId: id,
      surface: "graph",
    });
  }
  // A multi-concept query can project the same lesson or resource twice.
  // Keep the first canonical context and present deterministic object groups.
  const seen = new Set<string>();
  const groups = [
    "concept",
    "lesson",
    "visualization",
    "resource",
    "textbook",
    "command",
  ];
  return out
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group));
}
