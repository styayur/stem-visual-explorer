import { report as printReport } from "./cli_output.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  annotateResource,
  normalizeConcepts,
  matches,
} from "../src/lib/concepts.ts";
import { validateOntology } from "./ontology_validate.mjs";
import { validateIndex } from "./index_quality.mjs";
import { diagnose } from "../src/lib/searchDiagnostics.ts";
import {
  parseAndExpand,
  matchEntries,
  rankResults,
} from "../src/lib/searchEngine.ts";
validateOntology();
for (const [needle, title] of [
  ["FT", "left"],
  ["FT", "after"],
  ["rot", "prototype"],
  ["rot", "rotator"],
  ["FT", "αFTβ"],
])
  assert.equal(matches(title, { text: needle, match: "token" }), false);
const row = (title) => ({
  title,
  url: "https://example.test/resource",
  description: null,
  tags: [],
  thumbnail: null,
  result_type: "article",
  ...annotateResource(title, []),
});
for (const symbol of ["L", "E", "V", "I"])
  assert.deepEqual(normalizeConcepts([symbol]).concept_ids, []);
assert.ok(
  !annotateResource("Learning about left and after", []).concept_ids.includes(
    "fourier-transform",
  ),
);
assert.ok(
  !annotateResource("A rotator prototype", []).concept_ids.includes("curl"),
);
const foreign = row("Angular momentum");
assert.equal(
  matchEntries([foreign], "test", "Test", parseAndExpand("角動量")).length,
  1,
);
const title = row("curl"),
  description = { ...row("Unrelated"), concept_ids: [], description: "curl" },
  tags = { ...row("Unrelated"), concept_ids: [], tags: ["curl"] };
assert.deepEqual(
  rankResults(
    parseAndExpand("curl"),
    matchEntries(
      [description, tags, title],
      "test",
      "Test",
      parseAndExpand("curl"),
    ),
  ).map((r) => r.title),
  ["curl", "Unrelated", "Unrelated"],
);
assert.equal(
  matchEntries(
    [row("wave frequency")],
    "test",
    "Test",
    parseAndExpand("傅里叶变换"),
  ).length,
  0,
);
const index = {
  source_id: "test",
  schema_version: 2,
  entries: Array.from({ length: 10 }, (_, i) => ({
    ...row("curl"),
    url: `https://example.test/${i}`,
  })),
};
validateIndex(index, index);
for (const bad of [
  { ...index, entries: [] },
  { ...index, entries: index.entries.slice(0, 6) },
  {
    ...index,
    entries: index.entries.map((e) => ({ ...e, url: "javascript:alert(1)" })),
  },
  { ...index, entries: index.entries.map((e) => ({ ...e, title: "" })) },
  {
    ...index,
    entries: index.entries.map((e) => ({
      ...e,
      concept_ids: [],
      concept_evidence: {},
      subject: [],
    })),
  },
])
  assert.throws(() => validateIndex(bad, index));
const provider = {
  id: "test",
  name: "Test",
  homepage: "https://example.test",
  state: "done",
  count: 0,
  error: null,
  indexed_items: 10,
  last_updated: "2026-10-04",
  experimental: false,
  enabled: true,
};
const response = {
  query: "角动量",
  expanded_terms: [],
  results: [],
  providers: [provider],
  total: 0,
};
const date = Date.parse("2026-10-04");
assert.deepEqual(diagnose(response, 0, date).reasons, [
  "known-concept-no-resource",
]);
assert.deepEqual(
  diagnose({ ...response, query: "unknown-asdf" }, 0, date).reasons,
  ["unknown-concept"],
);
assert.deepEqual(
  diagnose({ ...response, unfiltered_total: 1 }, 0, date).reasons,
  ["filtered-out"],
);
assert.deepEqual(
  diagnose(
    {
      ...response,
      providers: [{ ...provider, state: "idle", enabled: false }],
    },
    0,
    date,
  ).reasons,
  ["provider-disabled"],
);
assert.deepEqual(
  diagnose(
    {
      ...response,
      providers: [{ ...provider, state: "error", error: "offline" }],
    },
    0,
    date,
  ).reasons,
  ["provider-error"],
);
assert.deepEqual(
  diagnose(
    { ...response, providers: [{ ...provider, last_updated: "2026-01-01" }] },
    0,
    date,
  ).reasons,
  ["index-stale"],
);
assert.deepEqual(
  diagnose({ ...response, language_mapping_gap: true }, 0, date).reasons,
  ["language-mapping-gap"],
);
assert.deepEqual(diagnose({ ...response, query: "" }, 0, date).reasons, [
  "true-no-match",
]);
for (const c of JSON.parse(
  readFileSync("tests/concept-benchmark.json", "utf8"),
))
  for (const queries of Object.values(c.queries))
    for (const query of queries)
      assert.deepEqual(parseAndExpand(query).concept_ids, c.expected_concepts);
printReport(
  "Retrieval regression: boundaries, tiers, annotations, quality gates, diagnostics, all 1395 language resolutions PASS",
);
