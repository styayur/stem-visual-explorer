import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseAndExpand } from "../src/lib/searchEngine.ts";
import { conceptById } from "../src/lib/concepts.ts";
const cases = JSON.parse(
  await readFile("scripts/fixtures/adversarial/queries.json", "utf8"),
);
const gold = JSON.parse(
  await readFile("scripts/fixtures/adversarial/gold.json", "utf8"),
);
assert.ok(cases.length >= 200);
assert.equal(new Set(cases.map((c) => c.query)).size, cases.length);
assert.equal(Object.keys(gold).length, cases.length);
const classes = {},
  languages = {},
  results = [];
let exact = 0,
  top = 0,
  positive = 0,
  negative = 0,
  negativeCorrect = 0;
for (const c of cases) {
  const expected = gold[c.id]?.expectedConceptIds;
  assert.ok(Array.isArray(expected));
  for (const id of expected)
    assert.ok(conceptById.has(id), `${c.id}: invalid expected concept ${id}`);
  const actual = parseAndExpand(c.query).concept_ids;
  const success =
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
  if (success) exact++;
  if (expected.length) {
    positive++;
    if (expected.includes(actual[0])) top++;
  } else {
    negative++;
    if (!actual.length) negativeCorrect++;
  }
  for (const [table, key] of [
    [classes, c.category],
    [languages, c.language],
  ]) {
    table[key] ??= { cases: 0, correct: 0 };
    table[key].cases++;
    if (success) table[key].correct++;
  }
  results.push({ ...c, expected, actual, exact: success });
}
for (const table of [classes, languages])
  for (const v of Object.values(table)) v.rate = v.correct / v.cases;
const summary = {
  name: "Adversarial Query Robustness Benchmark",
  scope:
    "Reviewed lexical robustness of this ontology resolver; not general semantic understanding. PASS means the dataset and measurement completed, not perfect resolution.",
  cases: cases.length,
  exactResolution: exact / cases.length,
  topConceptAccuracy: top / positive,
  negativePrecision: negativeCorrect / negative,
  positiveCases: positive,
  negativeCases: negative,
  classes,
  languages,
};
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/adversarial-query-summary.json",
  JSON.stringify(summary, null, 2) + "\n",
);
await writeFile(
  "artifacts/adversarial-query-results.json",
  JSON.stringify({ summary, results }, null, 2) + "\n",
);
process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
