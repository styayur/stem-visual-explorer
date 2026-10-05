import { vocabularyByInitial, typoByLength } from "./lexicon.ts";
import { word } from "./tokenize.ts";
import { oneEdit } from "./typo.ts";
import { structuralCandidates } from "./symbolic.ts";
import type { MatchSpan } from "./types.ts";
export function generateCandidates(text: string): MatchSpan[] {
  const structural = structuralCandidates(text);
  if (structural.length) return structural;
  const spans: MatchSpan[] = [];
  for (let start = 0; start < text.length; start++) {
    for (const e of vocabularyByInitial.get(text[start]) ?? []) {
      if (!text.startsWith(e.text, start)) continue;
      const end = start + e.text.length;
      if (e.text.length === 1 && (word(text[start - 1]) || word(text[end])))
        continue;
      const cjk = /[\u3400-\u9fff]/u.test(e.text);
      const boundaryWord = (c: string | undefined) =>
        word(c) &&
        !(e.kind === "abbreviation" && !!c && /[\u3400-\u9fff]/u.test(c));
      if (!cjk && (boundaryWord(text[start - 1]) || boundaryWord(text[end])))
        continue;
      spans.push({
        start,
        end,
        ids: e.ids,
        weight: e.weight,
        ambiguous: e.ambiguous,
        requiresConceptIds: e.requiresConceptIds,
        evidence: [
          { kind: e.kind, input: text.slice(start, end), matched: e.text },
        ],
      });
    }
  }
  const tokens = [...text.matchAll(/[a-z]+/g)];
  for (let i = 0; i < tokens.length; i++) {
    for (let size = 1; size <= Math.min(6, tokens.length - i); size++) {
      const slice = tokens.slice(i, i + size);
      const start = slice[0].index!,
        end = slice[size - 1].index! + slice[size - 1][0].length;
      if (
        word(text[start - 1]) ||
        word(text[end]) ||
        !/^[a-z]+(?: [a-z]+)*$/.test(text.slice(start, end))
      )
        continue;
      if (spans.some((s) => s.start <= start && s.end >= end)) continue;
      for (const entry of typoByLength.get(size) ?? []) {
        const words = entry.text.split(" ");
        let edits = 0;
        if (
          !words.every((w, j) => {
            if (w === slice[j][0]) return true;
            edits++;
            return oneEdit(w, slice[j][0]);
          }) ||
          edits !== 1
        )
          continue;
        spans.push({
          start,
          end,
          ids: entry.ids,
          weight: 76,
          ambiguous: false,
          evidence: [
            {
              kind: "bounded-typo",
              input: text.slice(start, end),
              matched: entry.text,
            },
          ],
        });
      }
    }
  }
  return spans.filter(
    (s) =>
      !s.requiresConceptIds ||
      spans.some(
        (x) =>
          !x.requiresConceptIds &&
          x.ids.some((id) => s.requiresConceptIds!.includes(id)),
      ),
  );
}
