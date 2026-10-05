export type EvidenceKind =
  | "canonical-label"
  | "ontology-alias"
  | "query-lexicon"
  | "historical-term"
  | "abbreviation"
  | "script-normalization"
  | "symbolic-operator"
  | "formula-pattern"
  | "bounded-typo"
  | "multi-token-composition";
export interface CandidateEvidence {
  kind: EvidenceKind;
  input: string;
  matched: string;
}
export interface RankedConceptCandidate {
  conceptId: string;
  score: number;
  evidence: CandidateEvidence[];
  matchedTerms: string[];
  penalties: string[];
}
export interface QueryConceptGroup {
  input: string;
  conceptIds: string[];
}
export interface QueryResolution {
  normalizedQuery: string;
  groups: QueryConceptGroup[];
  conceptIds: string[];
  candidates: RankedConceptCandidate[];
  status: "resolved" | "ambiguous" | "unknown";
  confidence: number;
  explanation: CandidateEvidence[];
  residualTerms: string[];
  reason: string;
}
export interface QueryLexiconEntry {
  pattern: string;
  conceptIds: string[];
  kind:
    | "colloquial"
    | "abbreviation"
    | "historical"
    | "common-mistranslation"
    | "student-phrase"
    | "notation-name";
  language: "en" | "zh-CN" | "zh-TW" | "mixed";
  confidence: number;
  provenance: "curated" | "historical-source" | "benchmark-generalized";
  reason: string;
  ambiguous?: boolean;
  requiresConceptIds?: string[];
}
export interface MatchSpan {
  start: number;
  end: number;
  ids: string[];
  weight: number;
  evidence: CandidateEvidence[];
  ambiguous: boolean;
  requiresConceptIds?: string[];
}
