// Fast, deterministic unit tests for the shared search/translation logic.
// Runs directly on Node (>=22) via native TypeScript type stripping:
//
//     node scripts/unit_test.mjs [--live]
//
// Without --live it never touches the network.
import assert from "node:assert/strict";

import { glossaryLookup, glossarySize } from "../src/lib/translate/glossary.ts";
import { chunk, guessSourceLanguage, mymemoryTranslate } from "../src/lib/translate/mymemory.ts";
import { httpUrl, workspaceUrls } from "../src/lib/urls.ts";
import {
  buildEmbeddableTranslatedUrl,
  buildTranslatedPageUrl,
} from "../src/lib/translate/pageUrl.ts";
import {
  expand,
  matchEntries,
  parseQuery,
  rankResults,
} from "../src/lib/searchEngine.ts";

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

console.log("glossary");
test("en -> zh", () => {
  assert.equal(glossaryLookup("gradient", "zh-CN"), "梯度");
  assert.equal(glossaryLookup("standing wave", "zh-CN"), "驻波");
  assert.equal(glossaryLookup("Curl", "zh-CN"), "旋度");
});
test("zh -> en", () => {
  assert.equal(glossaryLookup("简谐振动", "en"), "harmonic oscillator");
});
test("unknown term returns null", () => {
  assert.equal(glossaryLookup("zzzz-not-a-term", "zh-CN"), null);
});
test("covers a reasonable STEM vocabulary", () => {
  assert.ok(glossarySize() >= 60, `only ${glossarySize()} glossary entries`);
});

console.log("query parser");
test("plain terms", () => {
  assert.deepEqual(parseQuery("gradient curl").terms, ["gradient", "curl"]);
});
test("site / source filters", () => {
  assert.equal(parseQuery("site:falstad wave").siteFilter, "falstad");
  assert.equal(parseQuery("source:phet wave").siteFilter, "phet");
});
test("type filter", () => {
  assert.equal(parseQuery("type:interactive gradient").typeFilter, "interactive");
});
test("exact phrase", () => {
  const q = parseQuery('"standing wave" harmonic');
  assert.deepEqual(q.phrases, ["standing wave"]);
  assert.deepEqual(q.terms, ["harmonic"]);
});

console.log("synonym expansion");
test("gradient", () => {
  assert.ok(expand(parseQuery("梯度")).tokens.includes("gradient"));
});
test("curl", () => {
  assert.ok(expand(parseQuery("旋度")).tokens.includes("curl"));
});
test("standing wave", () => {
  const tokens = expand(parseQuery("驻波")).tokens;
  assert.ok(tokens.includes("standing"));
  assert.ok(tokens.includes("wave"));
});
test("english term is preserved", () => {
  assert.ok(expand(parseQuery("curl")).tokens.includes("curl"));
});

console.log("matching + ranking");
const entries = [
  { title: "curl", description: null, url: "https://x.test/1", result_type: "article", tags: ["curl"], thumbnail: null },
  { title: "The idea of curl of a vector field", description: "circulation", url: "https://x.test/2", result_type: "article", tags: ["curl", "vector field"], thumbnail: null },
  { title: "Vector field applet", description: "interactive vector field", url: "https://x.test/3", result_type: "applet", tags: ["vector field"], thumbnail: null },
];
test("matches candidates by token", () => {
  const q = expand(parseQuery("curl"));
  const found = matchEntries(entries, "test", "Test", q);
  assert.equal(found.length, 2);
});
test("exact title ranks first", () => {
  const q = expand(parseQuery("curl"));
  const ranked = rankResults(q, matchEntries(entries, "test", "Test", q));
  assert.equal(ranked[0].title, "curl");
  assert.ok(ranked[0].score >= 100);
});
test("interactive bonus", () => {
  const q = expand(parseQuery("vector field"));
  const ranked = rankResults(q, matchEntries(entries, "test", "Test", q));
  assert.ok(ranked.some((r) => r.result_type === "applet" && r.score >= 5));
});
test("empty query yields nothing", () => {
  assert.equal(matchEntries(entries, "test", "Test", expand(parseQuery(""))).length, 0);
});

console.log("translation helpers");
test("source language guess", () => {
  assert.equal(guessSourceLanguage("gradient"), "en");
  // Kana presence is the Japanese signal; kanji-only text is ambiguous and
  // is treated as Chinese by the heuristic.
  assert.equal(guessSourceLanguage("振動する"), "ja");
  assert.equal(guessSourceLanguage("単振動"), "zh-CN");
  assert.equal(guessSourceLanguage("梯度"), "zh-CN");
  assert.equal(guessSourceLanguage("미분"), "ko");
});
test("external translated URL is built", () => {
  const u = buildTranslatedPageUrl("https://mathinsight.org/gradient", "zh-CN");
  assert.ok(u.includes("translate.google.com"));
  assert.ok(u.includes(encodeURIComponent("https://mathinsight.org/gradient")));
});
test("custom proxy template is honoured", () => {
  const u = buildTranslatedPageUrl("https://a.test/p?q=1", "ja", "https://p.test/?u={url}&l={lang}");
  assert.equal(u, `https://p.test/?u=${encodeURIComponent("https://a.test/p?q=1")}&l=ja`);
});
test("only a proxy template is embeddable", () => {
  assert.equal(buildEmbeddableTranslatedUrl("https://a.test/", "zh-CN", ""), null);
  assert.ok(buildEmbeddableTranslatedUrl("https://a.test/", "zh-CN", "https://p.test/?u={url}"));
});

console.log("regressions");
test("traditional glossary and reverse lookup", () => {
  assert.equal(glossaryLookup("standing wave", "zh-TW"), "駐波");
  assert.equal(glossaryLookup("harmonic oscillator", "zh-TW"), "簡諧振動");
  assert.equal(glossaryLookup("電場", "en"), "electric field");
});
test("multiword English and traditional query expansion", () => {
  assert.ok(expand(parseQuery("standing wave")).tokens.includes("驻波"));
  assert.ok(expand(parseQuery("電磁感應")).tokens.includes("electromagnetic induction"));
});
test("exact title still ranks first with source syntax", () => {
  const q = expand(parseQuery("site:test curl"));
  const ranked = rankResults(q, matchEntries(entries, "test", "Test", q));
  assert.equal(ranked[0].title, "curl"); assert.ok(ranked[0].score >= 100);
});
test("filter-only query browses the index", () => {
  assert.equal(matchEntries(entries, "test", "Test", expand(parseQuery("site:test"))).length, entries.length);
});
test("exact phrase normalizes whitespace and excludes unrelated rows", () => {
  const q = expand(parseQuery('"vector   field"'));
  assert.deepEqual(q.phrases, ["vector field"]);
  assert.equal(matchEntries(entries, "test", "Test", q).length, 2);
});
test("ranking has a deterministic final tie-breaker", () => {
  const q = expand(parseQuery("curl"));
  const a = matchEntries(entries.slice(0, 1), "test", "Test", q)[0];
  assert.deepEqual(rankResults(q, [{...a, id:"z"}, {...a, id:"a"}]).map((r) => r.id), ["a", "z"]);
});
test("external URLs and workspace payloads are validated", () => {
  assert.equal(httpUrl("https://example.com"), "https://example.com/");
  for (const url of ["javascript:alert(1)", "data:text/html,x", "file:///C:/x"]) assert.throws(() => httpUrl(url));
  assert.throws(() => workspaceUrls({}));
  assert.throws(() => workspaceUrls(Array(5).fill("https://example.com")));
  assert.deepEqual(workspaceUrls(["https://example.com", "https://example.com/"]), ["https://example.com/"]);
});
test("unsafe translation proxies cannot be embedded", () => {
  assert.equal(buildEmbeddableTranslatedUrl("https://example.com", "en", "javascript:{url}"), null);
  assert.ok(buildTranslatedPageUrl("https://example.com", "en", "data:{url}").startsWith("https://translate.google.com"));
});
test("Unicode translation chunks preserve code points and byte limits", () => {
  const input = "驻波🌊".repeat(180);
  const pieces = chunk(input, 450);
  assert.equal(pieces.join(""), input);
  assert.ok(pieces.every((p) => Buffer.byteLength(p) <= 450));
  assert.ok(!pieces.some((p) => /[\uD800-\uDBFF]$/.test(p)));
});
const realFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ responseStatus: 403, responseData: { translatedText: "quota exhausted" } }) });
  await assert.rejects(mymemoryTranslate("some text", "en", "zh-CN"), /403/);
  passed++; console.log("  ok  translation service errors are not cached as translations");
} finally { globalThis.fetch = realFetch; }

if (process.argv.includes("--live")) {
  console.log("live MyMemory (network)");
  const out = await mymemoryTranslate("gradient and directional derivative", "en", "zh-CN");
  assert.ok(out.length > 0);
  assert.ok(/[\u4e00-\u9fff]/.test(out), `expected Chinese output, got "${out}"`);
  console.log(`  ok  mymemory: "gradient and directional derivative" -> "${out}"`);
  passed++;
}

console.log(`\nUNIT TESTS: ${passed} passed`);
