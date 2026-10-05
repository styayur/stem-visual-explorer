import { report as printReport } from "./cli_output.mjs";
import { performance } from "node:perf_hooks";
import { readFileSync, writeFileSync } from "node:fs";
const begin = performance.now();
const { resolveQuery } = await import("../src/query/resolve.ts");
const { queryLexicon, vocabulary } = await import("../src/query/lexicon.ts");
const initializationMs = performance.now() - begin;
const queries = JSON.parse(
  readFileSync("scripts/fixtures/adversarial/development/queries.json", "utf8"),
).map((c) => c.query);
for (const q of queries) resolveQuery(q);
const timings = [];
const batchBegin = performance.now();
for (let repeat = 0; repeat < 20; repeat++)
  for (const q of queries) {
    const start = performance.now();
    resolveQuery(q);
    timings.push(performance.now() - start);
  }
const batchMs = performance.now() - batchBegin;
timings.sort((a, b) => a - b);
const report = {
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    scope:
      "Node only; warm queries, fixed development corpus, 20 repetitions. Cold module-import initialization includes JSON and index construction. No browser latency claim.",
  },
  queries: timings.length,
  initializationMs,
  medianMs: timings[Math.floor(timings.length / 2)],
  p95Ms: timings[Math.floor(timings.length * 0.95)],
  maxMs: timings.at(-1),
  batchMs,
  lexiconEntries: queryLexicon.length,
  candidateVocabularySize: vocabulary.length,
  staticDataBytes:
    readFileSync("src/query/lexicon.json").length +
    readFileSync("src/query/rules.json").length,
  heapUsedBytes: process.memoryUsage().heapUsed,
};
writeFileSync(
  "artifacts/query-resolver-performance.json",
  JSON.stringify(report, null, 2) + "\n",
);
printReport(JSON.stringify(report, null, 2));
