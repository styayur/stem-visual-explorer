import { report as printReport } from "./cli_output.mjs";
import {annotateResource} from "../src/lib/concepts.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseAndExpand,
  parseQuery,
  matchEntries,
  rankResults,
} from "../src/lib/searchEngine.ts";
const golden = JSON.parse(readFileSync("tests/search-golden.json", "utf8"));
export function goldenOutput() {
  const cases=golden.cases.map((c) => {
    const query = parseAndExpand(c.query);
    const results = rankResults(
      query,
      matchEntries(golden.entries, "test", "Test", query),
    );
    const titles = results.map((r) => r.title);
    assert.deepEqual(query.concept_ids, c.concept_ids, c.query);
    assert.equal(query.groups.length, c.groups, c.query);
    for (const title of c.must_include ?? [])
      assert.ok(titles.includes(title), `${c.query} missing ${title}`);
    for (const title of c.must_not_include ?? [])
      assert.ok(!titles.includes(title), `${c.query} polluted by ${title}`);
    for (const text of c.must_not_expand_as_direct ?? [])
      assert.ok(
        !query.variants.some(
          (v) => v.text === text && v.tier !== "exploratory",
        ),
      );
    for (const v of c.variants ?? [])
      assert.ok(
        query.variants.some((x) => x.text === v.text && x.match === v.match),
      );
    if (c.phrases) assert.deepEqual(query.phrases, c.phrases);
    if (c.site_filter) assert.equal(query.siteFilter, c.site_filter);
    if (c.type_filter) assert.equal(query.typeFilter, c.type_filter);
    for (const title of c.related_titles ?? [])
      assert.ok(
        results
          .find((r) => r.title === title)
          .explanation.matched.some((m) => m.tier === "exploratory"),
      );
    if (c.ranking) {
      const input = c.ranking
        .slice()
        .reverse()
        .map((title) => ({
          ...golden.entries.find((e) => e.title === title),
          id: title,
          source_id: "test",
          source_name: "Test",
          score: 0,
        }));
      assert.deepEqual(
        rankResults(query, input).map((r) => r.title),
        c.ranking,
      );
    }
    return {
      query: c.query,
      concept_ids: query.concept_ids,
      groups: query.groups,
      variants: query.variants,
      phrases: query.phrases,
      site_filter: query.siteFilter,
      type_filter: query.typeFilter,
      results: results.map((r) => ({
        title: r.title,
        score: r.score,
        explanation: r.explanation,
      })),
    };
  });
  return {cases,annotations:golden.entries.map(e=>annotateResource(e.title,e.tags,e.description,e.url))};
}
const output = goldenOutput();
if (process.argv.includes("--json")) printReport(JSON.stringify(output));
else printReport(`Search golden: ${output.cases.length} cases passed`);
