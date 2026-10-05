import { conceptById } from "../lib/concepts.ts";
import { getLearningProfile } from "../learning/registry.ts";
import type { WorkbenchSurface } from "./types";
export function availableSurfaces(id: string): WorkbenchSurface[] {
  const c = conceptById.get(id),
    p = getLearningProfile(id);
  if (!c) return [];
  return [
    "overview",
    ...(p || c.prerequisites.length ? ["learn" as const] : []),
    ...(p?.visualizations.length ? ["visualize" as const] : []),
    "resources",
    "graph",
  ];
}
