import { report as printReport } from "./cli_output.mjs";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolveQuery } from "../src/query/resolve.ts";
import { normalizeQuery } from "../src/query/normalize.ts";
import { queryLexicon, vocabulary } from "../src/query/lexicon.ts";
import { conceptById } from "../src/lib/concepts.ts";
const developmentOnly = process.argv.includes("--development");
const baseline = JSON.parse(
  await readFile("artifacts/query-resolver-v1-summary.json", "utf8"),
);
const all = [];
for (const split of developmentOnly
  ? ["development"]
  : ["development", "holdout"]) {
  const dir = `scripts/fixtures/adversarial/${split}`;
  const cases = JSON.parse(await readFile(`${dir}/queries.json`, "utf8"));
  const gold = JSON.parse(await readFile(`${dir}/gold.json`, "utf8"));
  assert.equal(Object.keys(gold).length, cases.length);
  for (const c of cases) {
    const expected = gold[c.id]?.expectedConceptIds;
    assert.ok(Array.isArray(expected));
    for (const id of expected) assert.ok(conceptById.has(id), id);
    const r = resolveQuery(c.query),
      actual = r.conceptIds;
    const exact =
      JSON.stringify(actual.toSorted()) === JSON.stringify(expected.toSorted());
    const difficulty = [
      "typos",
      "symbolic",
      "formula-like",
      "colloquial",
    ].includes(c.category)
      ? "structural-or-recovery"
      : "lexical-or-boundary";
    all.push({
      ...c,
      split,
      difficulty,
      expected,
      actual,
      exact,
      status: r.status,
      rankedTop1:
        r.status === "resolved"
          ? r.candidates.find((x) => actual.includes(x.conceptId))?.conceptId
          : null,
      mechanism: [...new Set(r.explanation.map((e) => e.kind))].sort(),
      reason: r.reason,
    });
  }
}
assert.equal(new Set(all.map((c) => c.query)).size, all.length);
function metrics(rows) {
  const positives = rows.filter((c) => c.expected.length),
    negatives = rows.filter((c) => !c.expected.length);
  const rate = (items, predicate) =>
    items.length ? items.filter(predicate).length / items.length : null;
  const by = (key) =>
    Object.fromEntries(
      [...new Set(rows.map((c) => c[key]))].sort().map((k) => {
        const group = rows.filter((c) => c[key] === k);
        return [
          k,
          {
            cases: group.length,
            correct: group.filter((c) => c.exact).length,
            rate: rate(group, (c) => c.exact),
          },
        ];
      }),
    );
  return {
    cases: rows.length,
    positiveCases: positives.length,
    negativeCases: negatives.length,
    exactConceptSetAccuracy: rate(rows, (c) => c.exact),
    top1ConceptAccuracy: rate(positives, (c) =>
      c.expected.includes(c.rankedTop1),
    ),
    negativeRejectionRate: rate(negatives, (c) => !c.actual.length),
    unknownAbstentionAccuracy: rate(negatives, (c) => c.status === "unknown"),
    ambiguousAbstentionAccuracy: null,
    categories: by("category"),
    languages: by("language"),
    difficulty: by("difficulty"),
    mechanisms: Object.fromEntries(
      [
        "canonical-label",
        "ontology-alias",
        "query-lexicon",
        "historical-term",
        "script-normalization",
        "abbreviation",
        "bounded-typo",
        "symbolic-operator",
        "formula-pattern",
        "multi-token-composition",
      ].map((k) => [
        k,
        positives.filter((c) => c.exact && c.mechanism.includes(k)).length,
      ]),
    ),
    ambiguousAbstentions: rows
      .filter((c) => c.status === "ambiguous")
      .map((c) => c.id),
    unknownAbstentions: rows
      .filter((c) => c.status === "unknown")
      .map((c) => c.id),
  };
}
const summary = {
  name: "Adversarial Query Robustness Benchmark v2",
  methodology:
    "Frozen category-stratified split: every fourth original category case is holdout (165 development, 55 holdout). Original gold unchanged. Top-1 is the highest-ranked accepted candidate on positives; abstentions count as incorrect. Mechanisms are nonexclusive on exact successful positives. Difficulty is a fixed category-level rubric. Null means no independently labeled cases.",
  overall: metrics(all),
  development: metrics(all.filter((c) => c.split === "development")),
  ...(developmentOnly
    ? {}
    : { holdout: metrics(all.filter((c) => c.split === "holdout")) }),
  integrity: {
    lexiconEntries: queryLexicon.length,
    candidateVocabularySize: vocabulary.length,
    ontologyConcepts: conceptById.size,
    ontologyAliasesAdded: 0,
    exactNormalizedQueryLexiconOverlap: all
      .filter((c) =>
        queryLexicon.some(
          (e) => normalizeQuery(e.pattern) === normalizeQuery(c.query),
        ),
      )
      .map((c) => c.id),
  },
  falsePositives: all
    .filter((c) => !c.expected.length && c.actual.length)
    .map((c) => ({ id: c.id, query: c.query, actual: c.actual })),
  limitations: all
    .filter((c) => !c.exact)
    .map((c) => ({
      id: c.id,
      query: c.query,
      expected: c.expected,
      actual: c.actual,
      status: c.status,
    })),
};
const fixture = JSON.parse(
  await readFile("tests/query-resolver-v2.json", "utf8"),
);
const ambiguous = fixture.cases.filter((c) => c.status === "ambiguous");
summary.ambiguityContract = {
  cases: ambiguous.length,
  accuracy:
    ambiguous.filter((c) => {
      const r = resolveQuery(c.query);
      return r.status === "ambiguous" && !r.conceptIds.length;
    }).length / ambiguous.length,
};
summary.overall.ambiguousAbstentionAccuracy =
  summary.ambiguityContract.accuracy;
const hard = fixture.cases.filter((c) => c.status === "unknown");
summary.hardNegativeCases = hard.map((c) => c.query);
summary.hardFalsePositiveRegressions = hard.filter(
  (c) => resolveQuery(c.query).conceptIds.length,
).length;
summary.qualityTargets = {
  overallExact75: summary.overall.exactConceptSetAccuracy >= 0.75,
  positiveTop1_80: summary.overall.top1ConceptAccuracy >= 0.8,
  negativeRejection90: summary.overall.negativeRejectionRate >= 0.9,
  ...(developmentOnly
    ? {}
    : {
        holdoutGapPoints:
          100 *
          (summary.development.exactConceptSetAccuracy -
            summary.holdout.exactConceptSetAccuracy),
        holdoutWithin20Points:
          summary.holdout.exactConceptSetAccuracy >=
          summary.development.exactConceptSetAccuracy - 0.2,
      }),
};
assert.equal(summary.hardFalsePositiveRegressions, 0);
assert.ok(
  summary.overall.negativeRejectionRate >= 0.6785714285714286,
  "negative rejection baseline regression",
);
await mkdir("artifacts", { recursive: true });
const suffix = developmentOnly ? "-development" : "";
await writeFile(
  `artifacts/adversarial-query-summary${suffix}.json`,
  JSON.stringify(summary, null, 2) + "\n",
);
await writeFile(
  `artifacts/adversarial-query-results${suffix}.json`,
  JSON.stringify({ summary, results: all }, null, 2) + "\n",
);
printReport(JSON.stringify(summary, null, 2));
// Hard regression gate compares the untouched holdout against its measured v1 baseline.
// The new dev/holdout generalization gap is a reported quality target, never concealed.
if (!developmentOnly)
  assert.ok(
    summary.holdout.exactConceptSetAccuracy >=
      baseline.holdout.exactConceptSetAccuracy - 0.05,
    "holdout regressed >5 pp against v1",
  );
if (summary.qualityTargets.holdoutWithin20Points === false)
  process.stderr.write(
    `QUALITY TARGET MISSED: dev/holdout gap ${summary.qualityTargets.holdoutGapPoints.toFixed(2)} pp; see category report.\n`,
  );
