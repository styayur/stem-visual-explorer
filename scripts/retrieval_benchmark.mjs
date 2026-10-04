import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import * as engine from "../src/lib/searchEngine.ts";
import { concepts, annotateResource } from "../src/lib/concepts.ts";
import {
  legacy,
  search,
  acceptanceQueries,
  BASELINE_REF,
} from "./retrieval_baseline.mjs";
import { validateOntology } from "./ontology_validate.mjs";
const read = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const cases = read("tests/concept-benchmark.json"),
  truth = read("tests/precision-ground-truth.json");
assert.ok(cases.length >= 250);
assert.ok(cases.filter((c) => c.expected_min_results > 0).length >= 100);
assert.ok(truth.length >= 30);
const average = (xs) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const equal = (a, b) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const overlap = (a, b) => {
  const x = new Set(a.map((r) => r.url)),
    y = new Set(b.map((r) => r.url));
  return x.size || y.size
    ? [...x].filter((id) => y.has(id)).length / new Set([...x, ...y]).size
    : 0;
};
function evaluate(implementation, corpus, label) {
  const cache = new Map();
  const run = (text) => {
    if (!cache.has(text)) cache.set(text, search(implementation, corpus, text));
    return cache.get(text);
  };
  const rows = cases.map((c, i) => {
    if (i % 100 === 0) console.log(`${label}: ${i}/${cases.length}`);
    const queries = Object.entries(c.queries).flatMap(([language, queries]) =>
      queries.map((text) => {
        const { query, results } = run(text);
        return {
          language,
          text,
          concept_ids: query.concept_ids,
          correct: equal(query.concept_ids, c.expected_concepts),
          count: results.length,
          minimum_met: results.length >= c.expected_min_results,
          positive_witness_recalled: c.positive_resource_urls.length
            ? results.some((r) => c.positive_resource_urls.includes(r.url))
            : null,
          top10: results
            .slice(0, 10)
            .map((r) => ({
              title: r.title,
              url: r.url,
              provider: r.source_id,
            })),
        };
      }),
    );
    const en = run(c.queries.en[0]).results.slice(0, 10);
    return {
      id: c.id,
      category: c.category,
      expected_min_results: c.expected_min_results,
      queries,
      parity: queries.every((q) => q.correct),
      top10_overlap: average(
        ["zh-CN", "zh-TW"].map((l) =>
          overlap(en, run(c.queries[l][0]).results.slice(0, 10)),
        ),
      ),
    };
  });
  const precision = truth.map((t) => {
    const c = cases.find((c) => c.id === t.id);
    const languages = Object.entries(c.queries).map(([lang, queries]) => {
      const results = run(queries[0]).results;
      const relevant = (r) =>
        t.positive_title_patterns.some((p) =>
          new RegExp(p, "i").test(r.title),
        ) &&
        !t.negative_title_patterns.some((p) =>
          new RegExp(p, "i").test(r.title),
        );
      return {
        language: lang,
        query: queries[0],
        precision_at_5: results.slice(0, 5).filter(relevant).length / 5,
        precision_at_10: results.slice(0, 10).filter(relevant).length / 10,
        judged_top10: results
          .slice(0, 10)
          .map((r) => ({ title: r.title, url: r.url, relevant: relevant(r) })),
      };
    });
    return {
      id: t.id,
      languages,
      precision_at_5: average(languages.map((l) => l.precision_at_5)),
      precision_at_10: average(languages.map((l) => l.precision_at_10)),
    };
  });
  const fixtures = [
    "left",
    "after",
    "prototype",
    "rotator",
    "generic wave frequency",
  ].map((title, i) => ({
    title,
    url: `https://example.test/${i}`,
    description: null,
    tags: [],
    thumbnail: null,
    result_type: "article",
  }));
  const hard = ["FT", "rot", "傅里叶变换", "旋度"].map((text) => ({
    query: text,
    false_positives: implementation
      .matchEntries(
        fixtures,
        "fixture",
        "Fixture",
        implementation.parseAndExpand(text),
      )
      .map((r) => r.title),
  }));
  const summarize = (rs) => {
    const qs = rs.flatMap((r) => r.queries);
    const required = rs
      .filter((r) => r.expected_min_results > 0)
      .flatMap((r) => r.queries);
    return {
      concept_resolution_accuracy: average(qs.map((q) => +q.correct)),
      cross_language_concept_parity: average(rs.map((r) => +r.parity)),
      cross_language_top10_overlap: average(rs.map((r) => r.top10_overlap)),
      concept_recall: average(
        required.map((q) => +q.positive_witness_recalled),
      ),
      zero_result_queries: qs.filter((q) => !q.count).length,
      zero_result_rate: average(qs.map((q) => +!q.count)),
      query_count: qs.length,
    };
  };
  const metrics = {
    ...summarize(rows),
    cross_language_top10_overlap_when_available: average(rows.filter(r=>r.queries.some(q=>q.count>0)).map(r=>r.top10_overlap)),
    precision_at_5: average(precision.map((p) => p.precision_at_5)),
    precision_at_10: average(precision.map((p) => p.precision_at_10)),
    false_positive_regression_count: hard.reduce(
      (n, h) => n + h.false_positives.length,
      0,
    ),
  };
  const by_subject = Object.fromEntries(
    [...new Set(rows.map((r) => r.category))]
      .sort()
      .map((s) => [s, summarize(rows.filter((r) => r.category === s))]),
  );
  const acceptance = acceptanceQueries.map((text) => {
    const { query, results } = run(text);
    return {
      query: text,
      concept_ids: query.concept_ids,
      groups: query.groups ?? null,
      variants: query.variants,
      result_count: results.length,
      top10: results.slice(0, 10),
      provider_distribution: Object.fromEntries(
        corpus.map((p) => [
          p.source_id,
          results.filter((r) => r.source_id === p.source_id).length,
        ]),
      ),
    };
  });
  return {
    label,
    metrics,
    by_subject,
    precision,
    hard_regressions: hard,
    minimum_failures: rows.flatMap((r) =>
      r.queries.filter((q) => !q.minimum_met).map((q) => ({ id: r.id, ...q })),
    ),
    rows,
    acceptance,
  };
}
const old = await legacy();
try {
  const baseline = evaluate(old.engine, old.corpus, "v0.2 baseline");
  // Same source documents isolate algorithm changes from provider refreshes.
  const sameCorpus = structuredClone(old.corpus);
  for (const p of sameCorpus)
    for (const e of p.entries)
      Object.assign(e, annotateResource(e.title, e.tags, e.description));
  const controlled = evaluate(engine, sameCorpus, "v0.3 fixed v0.2 corpus");
  const root = process.env.SVE_INDEX_OUT ?? "public/index";
  const corpus = read(`${root}/manifest.json`).map((p) =>
    read(`${root}/${p.file}`),
  );
  const current = evaluate(engine, corpus, "v0.3 shipped snapshot");
  const report = {
    baseline_revision: BASELINE_REF,
    methodology:
      "465 curated multilingual concept cases; 172 cases require independent literal title witnesses from v0.2. Curated title-hint precision uses fixed k (unfilled slots count as nonrelevant). Empty/empty overlap=0. No provider excluded. Precision is a conservative title-hint estimate, not exhaustive relevance judgments.",
    ontology: validateOntology(),
    baseline,
    controlled,
    current,
  };
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/retrieval-benchmark.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  writeFileSync(
    "artifacts/retrieval-benchmark-summary.json",
    JSON.stringify(
      {
        baseline_revision: BASELINE_REF,
        methodology: report.methodology,
        ontology: report.ontology,
        baseline: baseline.metrics,
        controlled: controlled.metrics,
        current: current.metrics,
        precision: current.precision,
        minimum_failures: current.minimum_failures,
      },
      null,
      2,
    ) + "\n",
  );
  console.table({
    baseline: baseline.metrics,
    controlled: controlled.metrics,
    current: current.metrics,
  });
  const failures = [];
  for (const after of [controlled, current]) {
    if (after.metrics.concept_resolution_accuracy < 0.95)
      failures.push(`${after.label}: resolution <95%`);
    if (after.metrics.cross_language_concept_parity < 0.95)
      failures.push(`${after.label}: parity <95%`);
    if (after.metrics.false_positive_regression_count)
      failures.push(`${after.label}: hard false positives`);
    if (after.minimum_failures.length)
      failures.push(
        `${after.label}: ${after.minimum_failures.length} positive-resource minimum failures`,
      );
    if (after.metrics.precision_at_10 + 1e-9 < baseline.metrics.precision_at_10)
      failures.push(`${after.label}: precision@10 below baseline`);
    for (const p of after.precision)
      for (const q of p.languages) {
        const before = baseline.precision
          .find((b) => b.id === p.id)
          .languages.find((l) => l.language === q.language);
        if (q.precision_at_10 + 1e-9 < before.precision_at_10)
          failures.push(
            `${after.label}: ${p.id} ${q.language} precision regression ${before.precision_at_10} -> ${q.precision_at_10}`,
          );
      }
  }
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else console.log("All retrieval quality gates PASS");
} finally {
  old.cleanup();
}
