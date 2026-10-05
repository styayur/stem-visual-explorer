import { create } from "zustand";
import {
  openConcept,
  restoreSession,
  switchSurface,
  visitTrail,
} from "./conceptSession";
import type { ConceptOrigin, ConceptSession, WorkbenchSurface } from "./types";
import type { LessonContext } from "../visualizations/types";
import { availableSurfaces } from "./surfaces";

const KEY = "sve.workbench.v1";
function read(): ConceptSession | null {
  try {
    return restoreSession(JSON.parse(sessionStorage.getItem(KEY) ?? "null"));
  } catch {
    return null;
  }
}
function save(session: ConceptSession | null) {
  try {
    if (session)
      sessionStorage.setItem(
        KEY,
        JSON.stringify({
          cursor: session.cursor,
          trail: session.trail.map((e) => ({
            conceptId: e.conceptId,
            surface: e.surface,
          })),
        }),
      );
  } catch {
    /* optional UI persistence */
  }
}
interface WorkbenchState {
  session: ConceptSession | null;
  resume: ConceptSession | null;
  paletteOpen: boolean;
  lesson: LessonContext | null;
  open: (id: string, origin?: ConceptOrigin) => void;
  close: () => void;
  restore: () => void;
  surface: (surface: WorkbenchSurface) => void;
  visit: (cursor: number) => void;
  select: (
    capabilityId?: string,
    visualizationId?: string,
    stepId?: string,
  ) => void;
  setPalette: (open: boolean) => void;
  setLesson: (lesson: LessonContext | null) => void;
}
export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  session: null,
  resume: read(),
  paletteOpen: false,
  lesson: null,
  open: (id, origin) => {
    const session = openConcept(get().session, id, origin);
    if (session === get().session) return;
    save(session);
    set({ session, resume: session, lesson: null });
  },
  close: () => set({ session: null, lesson: null }),
  restore: () => {
    const saved = get().resume;
    if (saved) {
      const session = availableSurfaces(saved.conceptId).includes(
        saved.activeSurface,
      )
        ? saved
        : switchSurface(saved, "overview");
      set({ session, lesson: null });
    }
  },
  surface: (surface) => {
    if (
      !get().session ||
      !availableSurfaces(get().session!.conceptId).includes(surface)
    )
      return;
    const session = switchSurface(get().session!, surface);
    save(session);
    set({ session, resume: session, lesson: null });
  },
  visit: (cursor) => {
    if (!get().session) return;
    const session = visitTrail(get().session!, cursor);
    save(session);
    set({ session, resume: session, lesson: null });
  },
  select: (
    selectedCapabilityId,
    selectedVisualizationId,
    selectedLearningStepId,
  ) => {
    if (!get().session) return;
    set({
      session: {
        ...get().session!,
        selectedCapabilityId,
        selectedVisualizationId,
        selectedLearningStepId,
      },
      lesson: null,
    });
  },
  setPalette: (paletteOpen) => set({ paletteOpen }),
  setLesson: (lesson) => set({ lesson }),
}));
