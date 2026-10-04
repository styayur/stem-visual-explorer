import type { UiLocale } from "../lib/types";

export type LocalizedText = Record<UiLocale, string>;
export const L = (en: string, cn: string, tw: string): LocalizedText => ({
  en,
  "zh-CN": cn,
  "zh-TW": tw,
});
export const localize = (text: LocalizedText, locale: UiLocale) => text[locale];

export interface TextbookReference {
  sourceId: string;
  collection: string;
  book: string;
  chapter?: string;
  section?: string;
  conceptIds: string[];
  language: string;
  url: string;
  rightsStatus: "external-reference";
}
export interface HistoricalAlias {
  text: string;
  conceptId: string;
  status: "legacy";
  source: string;
}
export interface LearningStage {
  id: string;
  title: LocalizedText;
  visualizationId: string;
  stepId: string;
}
export interface ConceptLearningProfile {
  conceptId: string;
  prerequisites: string[];
  learningObjectives: LocalizedText[];
  sequence: LearningStage[];
  textbookReferences?: TextbookReference[];
  visualizations: string[];
  nextConcepts?: string[];
}
