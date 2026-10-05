export type WorkbenchSurface =
  | "overview"
  | "learn"
  | "visualize"
  | "resources"
  | "graph";
export interface ConceptOrigin {
  type:
    | "search"
    | "concept-link"
    | "learning-path"
    | "graph"
    | "resource"
    | "command";
  query?: string;
  sourceConceptId?: string;
}
export interface ConceptTrailEntry {
  conceptId: string;
  origin?: ConceptOrigin;
  surface: WorkbenchSurface;
}
export interface ConceptSession {
  conceptId: string;
  origin?: ConceptOrigin;
  activeSurface: WorkbenchSurface;
  selectedCapabilityId?: string;
  selectedVisualizationId?: string;
  selectedLearningStepId?: string;
  trail: ConceptTrailEntry[];
  cursor: number;
}
