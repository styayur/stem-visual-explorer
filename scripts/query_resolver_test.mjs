import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolveQuery } from "../src/query/resolve.ts";
import { normalizeQuery } from "../src/query/normalize.ts";
import { queryLexicon, vocabulary } from "../src/query/lexicon.ts";
import { concepts, normalizeConcepts } from "../src/lib/concepts.ts";
import { parseAndExpand } from "../src/lib/searchEngine.ts";
import { universalObjects } from "../src/capabilities/universalSearch.ts";
const fixture = JSON.parse(
  readFileSync("tests/query-resolver-v2.json", "utf8"),
);
for (let code = 0x1d6a8; code <= 0x1d7cb; code++) {
  const q = String.fromCodePoint(code);
  assert.equal(normalizeQuery(normalizeQuery(q)), normalizeQuery(q), q);
}
for (const c of fixture.cases) {
  const result = resolveQuery(c.query);
  assert.deepEqual(result.conceptIds, c.ids, c.query);
  assert.equal(result.status, c.status, c.query);
  assert.equal(
    normalizeQuery(result.normalizedQuery),
    result.normalizedQuery,
    c.query,
  );
  if (c.evidence)
    assert.ok(
      result.explanation.some((e) => e.kind === c.evidence),
      c.query,
    );
  assert.deepEqual(parseAndExpand(c.query).concept_ids, c.ids, c.query);
  assert.deepEqual(normalizeConcepts([c.query]).concept_ids, c.ids, c.query);
}
for (const c of concepts)
  for (const label of [c.en, c.zh_cn, c.zh_tw]) {
    assert.deepEqual(resolveQuery(label).conceptIds, [c.id], label);
    assert.deepEqual(resolveQuery(`(${label})!`).conceptIds, [c.id], label);
    assert.equal(normalizeQuery(normalizeQuery(label)), normalizeQuery(label));
  }
// Script conversion is orthographic, never regional terminology rewriting.
for (const text of [
  "位相",
  "能力",
  "分裂",
  "波",
  "定理",
  "似然",
  "井",
  "反函数",
  "光射",
])
  assert.equal(normalizeQuery(text), text);
assert.equal(normalizeQuery("轉動的動量"), "转动的动量");
assert.notEqual(normalizeQuery("转动的动量"), "angular momentum");
const permutations = [
  "angular momentum torque",
  "torque angular momentum",
  "curl gradient divergence",
  "divergence curl gradient",
  "eigenvector eigenvalue",
];
assert.deepEqual(
  resolveQuery(permutations[0]).conceptIds,
  resolveQuery(permutations[1]).conceptIds,
);
assert.deepEqual(
  resolveQuery(permutations[2]).conceptIds,
  resolveQuery(permutations[3]).conceptIds,
);
assert.deepEqual(
  resolveQuery(permutations[4]).conceptIds,
  resolveQuery("eigenvalue eigenvector").conceptIds,
);
for (const q of [
  "x".repeat(513),
  "∇×".repeat(100000),
  "(".repeat(200),
  "\uD800",
  "\uDC00",
  "eval(alert(1))",
  "det(".repeat(100),
])
  assert.equal(resolveQuery(q).status, "unknown", q.slice(0, 20));
for (const q of ["ro", "ftx", "dv", "gra", "el"])
  assert.deepEqual(resolveQuery(q).conceptIds, [], q);
for (const e of queryLexicon) {
  assert.ok(
    e.pattern &&
      e.reason &&
      ["curated", "historical-source", "benchmark-generalized"].includes(
        e.provenance,
      ),
  );
  assert.ok(e.confidence >= 0 && e.confidence <= 1);
  for (const id of e.conceptIds)
    assert.ok(
      concepts.some((c) => c.id === id),
      id,
    );
}
assert.equal(
  new Set(queryLexicon.map((e) => e.pattern)).size,
  queryLexicon.length,
);
for (const locale of ["en", "zh-CN", "zh-TW"]) {
  assert.equal(universalObjects("∇×F", locale)[0].conceptId, "curl");
  assert.ok(universalObjects("FT", locale).every((e) => e.group === "concept"));
  assert.deepEqual(universalObjects("matrix movie tickets", locale), []);
}
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
for (const path of [...walk("src"), ...walk("src-tauri/src")].filter((p) =>
  /\.(ts|tsx|rs|json)$/.test(p),
)) {
  const text = readFileSync(path, "utf8");
  assert.ok(
    !/fixtures[\\/]adversarial|colloquial-\d\d|typos-\d\d|holdout[\\/]queries\.json/.test(
      text,
    ),
    `Runtime fixture contamination: ${path}`,
  );
}
console.log(
  `Resolver v2: ${fixture.cases.length} representative cases; ${concepts.length * 3} canonical invariants, safety, provenance, projection and fixture isolation PASS (${vocabulary.length} vocabulary entries)`,
);
