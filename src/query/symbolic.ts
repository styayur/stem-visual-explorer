import rules from "./rules.json" with { type: "json" };
import type { MatchSpan } from "./types.ts";
const patterns = rules.structures.map((p) => ({
  ...p,
  regex: new RegExp(p.pattern, "u"),
}));
/** A restricted token-pattern lexer. It does not evaluate or recursively parse expressions. */
export function structuralCandidates(text: string): MatchSpan[] {
  const compact = text.replace(/\s+/g, "").replace(/\*/g, "×");
  return patterns
    .filter((p) => p.regex.test(compact))
    .map((p) => ({
      start: 0,
      end: text.length,
      ids: p.conceptIds,
      weight: p.kind === "formula-pattern" ? 90 : 88,
      evidence: [
        {
          kind: p.kind as "formula-pattern" | "symbolic-operator",
          input: text,
          matched: p.name,
        },
      ],
      ambiguous: false,
    }));
}
