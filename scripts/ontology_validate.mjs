import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { concepts, normalizeTerm } from "../src/lib/concepts.ts";
export function validateOntology() {
  const ids = new Set(concepts.map((c) => c.id));
  assert.equal(ids.size, concepts.length, "duplicate ids");
  assert.ok(concepts.length >= 300);
  let relations = 0,
    prerequisites = 0,
    aliases = 0,
    synonyms = 0;
  const incoming = new Set();
  const collisions = [];
  const labels = new Map();
  for (const c of concepts) {
    assert.match(c.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(c.en && c.zh_cn && c.zh_tw && c.subject && c.level.length);
    for (const e of [...c.related, ...c.prerequisites]) {
      assert.ok(ids.has(e) && e !== c.id, `${c.id}: invalid edge ${e}`);
      incoming.add(e);
    }
    for (const a of c.aliases) {
      assert.ok(a.text.trim());
      assert.ok(
        ["exact", "phrase", "token", "cjk-substring"].includes(a.match),
      );
      if (/^[a-z]$/i.test(a.text)) assert.equal(a.match, "exact");
    }
    for (const n of [c.en, c.zh_cn, c.zh_tw]) {
      const key = normalizeTerm(n);
      if (labels.has(key) && labels.get(key) !== c.id)
        collisions.push([key, labels.get(key), c.id]);
      labels.set(key, c.id);
    }
    relations += c.related.length;
    prerequisites += c.prerequisites.length;
    aliases += c.aliases.length;
    synonyms += c.synonyms.length;
  }
  assert.deepEqual(collisions, [], "canonical label collisions");
  const stats = {
    concepts: concepts.length,
    relations,
    prerequisites,
    aliases,
    synonyms,
    subjects: new Set(concepts.map((c) => c.subject)).size,
    isolated: concepts.filter(
      (c) =>
        !c.related.length && !c.prerequisites.length && !incoming.has(c.id),
    ).length,
    dangling: 0,
    duplicate_ids: 0,
    invalid_aliases: 0,
    bilingual_coverage: 1,
  };
  return stats;
}
if (process.argv[1].includes("ontology_validate")) {
  mkdirSync("artifacts", { recursive: true });
  const stats = validateOntology();
  writeFileSync(
    "artifacts/ontology-statistics.json",
    JSON.stringify(stats, null, 2) + "\n",
  );
  console.log(stats);
}
