import { conceptById } from "../lib/concepts.ts";
import type {
  ConceptOrigin,
  ConceptSession,
  WorkbenchSurface,
} from "./types.ts";
import { availableSurfaces } from "./surfaces.ts";

export const TRAIL_LIMIT = 32;
export function openConcept(
  session: ConceptSession | null,
  conceptId: string,
  origin?: ConceptOrigin,
): ConceptSession {
  if (!conceptById.has(conceptId)) throw new Error("Unknown concept ID");
  if (session?.conceptId === conceptId) return session;
  const trail = [
    ...(session?.trail.slice(0, session.cursor + 1) ?? []),
    { conceptId, origin, surface: "overview" as const },
  ].slice(-TRAIL_LIMIT);
  return {
    conceptId,
    origin,
    activeSurface: "overview",
    trail,
    cursor: trail.length - 1,
  };
}
export function visitTrail(
  session: ConceptSession,
  cursor: number,
): ConceptSession {
  if (!Number.isInteger(cursor) || cursor < 0 || cursor >= session.trail.length)
    return session;
  const entry = session.trail[cursor];
  return {
    conceptId: entry.conceptId,
    origin: entry.origin,
    activeSurface: entry.surface,
    trail: session.trail,
    cursor,
  };
}
export function switchSurface(
  session: ConceptSession,
  surface: WorkbenchSurface,
): ConceptSession {
  return {
    ...session,
    activeSurface: surface,
    selectedCapabilityId: undefined,
    trail: session.trail.map((entry, i) =>
      i === session.cursor ? { ...entry, surface } : entry,
    ),
  };
}
// Persist only bounded, validated IDs and surfaces. No resource/lesson payloads.
export function restoreSession(value: unknown): ConceptSession | null {
  const v = value as Partial<ConceptSession> | null;
  const surfaces = ["overview", "learn", "visualize", "resources", "graph"];
  if (
    !v ||
    !Array.isArray(v.trail) ||
    !v.trail.length ||
    v.trail.length > TRAIL_LIMIT ||
    !v.trail.every(
      (e) => e && conceptById.has(e.conceptId) && surfaces.includes(e.surface),
    ) ||
    !Number.isInteger(v.cursor) ||
    v.cursor! < 0 ||
    v.cursor! >= v.trail.length
  )
    return null;
  const trail = v.trail.map((e) => ({
    conceptId: e.conceptId,
    surface: availableSurfaces(e.conceptId).includes(e.surface)
      ? e.surface
      : ("overview" as const),
  }));
  const entry = trail[v.cursor!];
  return {
    conceptId: entry.conceptId,
    activeSurface: entry.surface,
    trail,
    cursor: v.cursor!,
  };
}
