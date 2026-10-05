import type { LocalizedText } from "../learning/types";
import type { SearchResult } from "../lib/types";
export type CapabilityType =
  | "guided-lesson"
  | "visualization"
  | "article"
  | "textbook"
  | "proof"
  | "simulation"
  | "exercise";
export type CapabilityGroup =
  | "learn"
  | "visualize"
  | "read"
  | "explore"
  | "practice";
export interface ConceptCapability {
  id: string;
  conceptIds: readonly string[];
  type: CapabilityType;
  title: LocalizedText;
  description?: LocalizedText;
  availability: "native" | "external";
  visualizationId?: string;
  url?: string;
  provenance?: {
    source: string;
    sourceUrl: string;
    language: string;
    rightsStatus: "external-reference" | "unknown";
    license?: string;
  };
  resource?: SearchResult;
}
