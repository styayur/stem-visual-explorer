import { readFileSync, writeFileSync } from "node:fs";
const read = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const quality = read("artifacts/provider-quality.json"),
  benchmark = read("artifacts/retrieval-benchmark-summary.json");
const metric = benchmark.current,
  percent = (n) => `${(n * 100).toFixed(2)}%`;
const body = `Live provider snapshots refreshed after ontology, index, retrieval, TS/Rust parity, build and browser gates passed. No direct push to main.

| Provider | Before | After |
|---|---:|---:|
${quality.map((p) => `| ${p.provider} | ${p.previous_count} | ${p.entry_count} |`).join("\n")}

| Metric | Result |
|---|---:|
| Ontology concepts | ${benchmark.ontology.concepts} |
| Concept recall (witnessed concepts) | ${percent(metric.concept_recall)} |
| Resolution accuracy | ${percent(metric.concept_resolution_accuracy)} |
| Cross-language concept parity | ${percent(metric.cross_language_concept_parity)} |
| Precision@10 (curated direct-title hints) | ${percent(metric.precision_at_10)} |
| Hard false positives | ${metric.false_positive_regression_count} |
| Broken providers | 0 (all expected providers required by quality gate) |

Precision methodology and known no-resource concepts are documented in docs/retrieval.md. Source fetch dates are UTC. This refresh changes snapshots and generated audit summaries only.
`;
writeFileSync("artifacts/refresh-pr.md", body);
