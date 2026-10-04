import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { concepts, annotateResource } from "../src/lib/concepts.ts";
import { indexBaselineRef, indexFromGit } from "./index_baseline.mjs";
const read = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const ids = new Set(concepts.map((c) => c.id));
export function quality(index) {
  const n = index.entries.length;
  const fraction = (fn) => (n ? index.entries.filter(fn).length / n : 0);
  return {
    provider: index.source_id,
    entry_count: n,
    description_coverage: fraction((e) => !!e.description?.trim()),
    tags_coverage: fraction((e) => e.tags.some((t) => t.trim())),
    semantic_concept_coverage: fraction((e) => e.concept_ids?.length > 0),
    subject_coverage: fraction((e) => e.subject?.length > 0),
    language_coverage: fraction((e) => !!e.language),
    thumbnail_coverage: fraction((e) => !!e.thumbnail),
    description_sources: Object.fromEntries(
      [
        ...new Set(
          index.entries.map((e) => e.description_source ?? "unspecified"),
        ),
      ].map((s) => [
        s,
        index.entries.filter(
          (e) => (e.description_source ?? "unspecified") === s,
        ).length,
      ]),
    ),
  };
}
export function validateIndex(index, previous) {
  const n = index.entries.length;
  const fail = (msg) => {
    throw new Error(`${index.source_id}: ${msg}`);
  };
  if (!n) fail("empty index");
  const ratio = (fn) => index.entries.filter(fn).length / n;
  if (
    ratio((e) => {
      try {
        return !["https:", "http:"].includes(new URL(e.url).protocol);
      } catch {
        return true;
      }
    }) > 0.05
  )
    fail("invalid URL ratio >5%");
  if (ratio((e) => !e.title?.trim()) > 0.05) fail("missing title ratio >5%");
  if (1 - new Set(index.entries.map((e) => e.url)).size / n > 0.05)
    fail("duplicate URL ratio >5%");
  if (previous && n < previous.entries.length * 0.7)
    fail(`count drop >30% (${previous.entries.length} -> ${n})`);
  const before = previous ? quality(previous).semantic_concept_coverage : 0;
  if (before > 0.1 && quality(index).semantic_concept_coverage < before * 0.7)
    fail("semantic coverage collapse >30%");
  if (index.schema_version !== 2) fail("schema migration required");
  for (const e of index.entries) {
    if (
      !Array.isArray(e.concept_ids) ||
      !Array.isArray(e.subject) ||
      !e.language ||
      !e.concept_evidence
    )
      fail("missing semantic metadata");
    for (const id of e.concept_ids)
      if (!ids.has(id) || !e.concept_evidence[id]?.length)
        fail(`invalid annotation ${id}`);
  }
}
if (process.argv[1].includes("index_quality")) {
  const root = process.env.SVE_INDEX_OUT ?? "public/index";
  const manifest = read(`${root}/manifest.json`);
  const baseDirectory = process.env.SVE_INDEX_BASE;
  const baseRef = baseDirectory ? null : indexBaselineRef();
  const expected = baseDirectory
    ? read(`${baseDirectory}/manifest.json`)
    : indexFromGit(baseRef, "public/index/manifest.json");
  assert.deepEqual(
    manifest.map((p) => p.id).sort(),
    expected.map((p) => p.id).sort(),
    "missing/duplicate provider in manifest",
  );
  const rows = [];
  for (const p of manifest) {
    const index = read(`${root}/${p.file}`);
    if (p.content_hash)
      assert.equal(
        createHash("sha256")
          .update(readFileSync(`${root}/${p.file}`))
          .digest("hex"),
        p.content_hash,
        "snapshot content hash mismatch",
      );
    assert.equal(index.entries.length, p.count);
    assert.equal(index.updated_at, p.updated_at);
    assert.equal(index.source_id, p.id);
    assert.ok(!Number.isNaN(Date.parse(p.updated_at)));
    const previous = baseDirectory
      ? read(`${baseDirectory}/${p.file}`)
      : indexFromGit(baseRef, `public/index/${p.file}`);
    for (const e of previous.entries)
      if (!e.concept_ids)
        Object.assign(e, annotateResource(e.title, e.tags, e.description, e.url));
    validateIndex(index, previous);
    rows.push({
      ...quality(index),
      baseline: baseDirectory ?? baseRef,
      previous_count: previous.entries.length,
      updated_at: index.updated_at,
    });
  }
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/provider-quality.json",
    JSON.stringify(rows, null, 2) + "\n",
  );
  console.table(rows.map(({ description_sources, ...row }) => row));
}
