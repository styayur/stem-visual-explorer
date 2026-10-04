import { report as printReport } from "./cli_output.mjs";
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const report=read('artifacts/retrieval-benchmark.json'),base=read('artifacts/retrieval-baseline.json'),providers=read('artifacts/provider-quality.json'),stats=read('artifacts/ontology-statistics.json'),probe=read('artifacts/provider-probe.json');
const percent=n=>`${(n*100).toFixed(2)}%`;
const before=report.baseline.metrics,after=report.current.metrics;
const checks=['final','postci'].flatMap(phase=>['frontend','rust','retrieval','live'].flatMap(s=>{const path=`artifacts/${phase}/${s}.json`;return existsSync(path)?read(path):[];}));
const latest=new Map(checks.map(c=>[c.command,c]));
assert.ok([...latest.values()].every(c=>c.exit_code===0),'Final checks are not all passing');
assert.ok(probe.providers.length===7&&probe.providers.every(p=>!p.error),'Incomplete live health');
const pairs=[['角动量','angular momentum'],['行列式','determinant'],['泰勒级数','Taylor series'],['线积分','line integral'],['傅里叶变换','Fourier transform'],['旋度','curl'],['多普勒效应','Doppler effect'],['麦克斯韦方程组','Maxwell equations'],['光电效应','photoelectric effect'],['薛定谔方程','Schrodinger equation']];
const rows=pairs.map(([cn,en])=>{const a=report.current.acceptance.find(q=>q.query===cn),b=report.current.acceptance.find(q=>q.query===en);assert.deepEqual(a.concept_ids,b.concept_ids);assert.deepEqual(a.top10.map(r=>r.url),b.top10.map(r=>r.url));return `| ${cn} / ${en} | ${a.concept_ids.join(', ')} | ${a.result_count} / ${b.result_count} | ${a.top10.slice(0,3).map(r=>`[${r.title.replaceAll('|','/')} — ${r.source_name}](${r.url})`).join('<br>')||'No direct indexed resource; recognized concept. Maxwell Velocity is deliberately excluded.'} |`;});
const metrics=`| Metric | v0.2 baseline | v0.3 fixed old corpus | v0.3 current snapshot |
|---|---:|---:|---:|
| Ontology concepts | ${base.concepts} | ${stats.concepts} | ${stats.concepts} |
| Isolated concepts (all edges) | ${base.isolated} | ${stats.isolated} | ${stats.isolated} |
| Concept resolution accuracy | ${percent(before.concept_resolution_accuracy)} | ${percent(report.controlled.metrics.concept_resolution_accuracy)} | ${percent(after.concept_resolution_accuracy)} |
| Cross-language concept parity | ${percent(before.cross_language_concept_parity)} | ${percent(report.controlled.metrics.cross_language_concept_parity)} | ${percent(after.cross_language_concept_parity)} |
| Witnessed-resource concept recall | ${percent(before.concept_recall)} | ${percent(report.controlled.metrics.concept_recall)} | ${percent(after.concept_recall)} |
| Precision@5, reviewed direct-title hints | ${percent(before.precision_at_5)} | ${percent(report.controlled.metrics.precision_at_5)} | ${percent(after.precision_at_5)} |
| Precision@10, reviewed direct-title hints | ${percent(before.precision_at_10)} | ${percent(report.controlled.metrics.precision_at_10)} | ${percent(after.precision_at_10)} |
| Cross-language top-10 URL overlap, empty=0 | ${percent(before.cross_language_top10_overlap)} | ${percent(report.controlled.metrics.cross_language_top10_overlap)} | ${percent(after.cross_language_top10_overlap)} |
| Zero-result benchmark queries / ${after.query_count} | ${before.zero_result_queries} | ${report.controlled.metrics.zero_result_queries} | ${after.zero_result_queries} |
| Hard forbidden query/result pairs | ${before.false_positive_regression_count} | ${report.controlled.metrics.false_positive_regression_count} | ${after.false_positive_regression_count} |`;
const providerTable=`| Provider | Before → After | Description | Tags | Concepts | Subject | Language | Thumbnail |
|---|---:|---:|---:|---:|---:|---:|---:|
${providers.map(p=>`| ${p.provider} | ${p.previous_count} → ${p.entry_count} | ${percent(p.description_coverage)} | ${percent(p.tags_coverage)} | ${percent(p.semantic_concept_coverage)} | ${percent(p.subject_coverage)} | ${percent(p.language_coverage)} | ${percent(p.thumbnail_coverage)} |`).join('\n')}`;
const testTable=`| Command (repository root) | Result |
|---|---|
${[...latest.values()].map(c=>`| \`${c.command}\` | PASS${c.verification?.includes('retry')?' after retry':''} |`).join('\n')}`;
const failures=checks.filter(c=>c.exit_code!==0);
const text=`# v0.3 retrieval delivery audit

## Executive Summary

STEM Visual Explorer now resolves multilingual concept groups, retrieves only direct/equivalent matches by default, scores field evidence, and measures provider and retrieval quality before publishing snapshots.

## Branch / PR

Branch: \`feat/v0.3-retrieval-overhaul\`. The final PR URL and final HEAD are supplied in the delivery response; this tracked report intentionally does not embed its own future commit hash. No release/tag/merge is performed.

## Architecture Changes

One canonical 490-concept ontology replaces the independent glossary. Longest-match query groups, safe match modes, explicit Direct/Equivalent/Exploratory tiers, strict group AND and capped field scores replace flat substring recall. Schema-2 annotations expose provenance; v1 caches rebuild safely. UI chips/exploration/diagnostics/freshness and shared Rust/TS golden tests make behavior inspectable. A weekly/manual staged refresh opens a PR only after every quality gate. See [retrieval.md](../retrieval.md).

## Retrieval Baseline vs v0.3

${metrics}

Baseline commands were run before edits at \`3cd6ceb\`; upstream \`b380db8\` has the identical Git tree (${base.tree}) and is used for reproducible replay after feature branches disappear. Initial old probe execution followed the old cache-capable path; only the new probe is guaranteed to fetch every source without disk cache. Baseline/current comparisons use the same reviewed relevance rules. Initial broad rules and their corrections are preserved in [relevance review](v0.3-relevance-review.md), not silently overwritten. No mandatory positive-resource case was removed or weakened.

Top-10 overlap among cases with resources is ${percent(after.cross_language_top10_overlap_when_available)}; empty/empty queries count as zero in the headline overlap metric. No provider was excluded. The ${after.zero_result_queries} zero-result queries primarily expose provider coverage gaps, not failed language resolution.

## Ontology Statistics

| Concepts | Related edges | Prerequisite edges | Aliases | Synonyms | Subjects | Isolated | Dangling |
|---:|---:|---:|---:|---:|---:|---:|---:|
| ${stats.concepts} | ${stats.relations} | ${stats.prerequisites} | ${stats.aliases} | ${stats.synonyms} | ${stats.subjects} | ${stats.isolated} | ${stats.dangling} |

All three canonical labels are present for every concept; duplicate IDs, invalid aliases and dangling edges are zero. The ontology includes 25 reviewed additions discovered from existing resource terms. Candidate phrases remain a review queue, not automatic concepts.

## Provider Index Quality

${providerTable}

Description presence is not summary richness: Falstad, BetterExplained and Maotian use explicitly labeled title/provider-category fallback where listings lack descriptions. Language is heuristic (with a known Japanese-provider override). Empty concept/subject annotations remain visible. Snapshot source dates: ${[...new Set(providers.map(p=>p.updated_at))].join(', ')} UTC.

## Query Verification

Both queries in each row were executed against the final shipped snapshot. Concept IDs and ordered top-10 URLs were asserted identical; the full top 10 and score explanations are in \`artifacts/retrieval-benchmark.json\`.

| Queries | Shared concept ID | CN / EN count | Top results (up to 3) |
|---|---|---:|---|
${rows.join('\n')}

## False Positive Verification

| Query | Final forbidden fixture matches |
|---|---|
${report.current.hard_regressions.map(h=>`| ${h.query} | ${h.false_positives.length} |`).join('\n')}

The negative fixture titles are \`left\`, \`after\`, \`prototype\`, \`rotator\`, and \`generic wave frequency\`. Golden tests also reject URL-only matches, enforce group AND, and ensure dual-group matches outrank single-group matches. Actual FT/傅里叶变换 and rot/旋度 results are retained with explanations in the benchmark. Related-only results require explicit exploration and are labeled accordingly.

## Tests

${testTable}

Native full-feature tests and all-target clippy passed in this Windows environment. After remote CodeForge findings, all three local suites were rerun: unsafe shell evaluation was removed, CLI tools return path/configuration errors, golden tests name fixture invariants, and PR-document links were repaired. The original CodeForge SARIF and the clean local diagnostic rerun are preserved in artifacts/postci; its Windows build/test autodetection was unavailable, so the explicit verification suites provide those results. Shared contract: 41 golden cases including full Rust/TS annotation and score parity; 465 benchmark cases / 1,395 language queries; 36 reviewed direct-title precision rules. Browser regression: 23 groups. Rust: 38 tests in each feature configuration.

Live verification: ${probe.queries.length} queries and ${probe.providers.length} providers; ${probe.providers.reduce((n,p)=>n+(p.entries??0),0)} live indexed resources. Probe data are real source fetches. Parser fixtures, browser third-party responses and translation fixtures are separate offline tests.

${failures.length?`Failed attempts were retained: ${failures.map(c=>`\`${c.command}\` (${c.log})`).join(', ')}. Math Insight /video/list timed out; the generator rejected the batch without replacing the snapshot. The independent probe and generator retry subsequently passed. Concurrent full-feature cargo test initially could not link probe.exe while the live probe held the executable open on Windows; after that process exited, the full test retry passed.`:'No failed final attempt.'}

\`npm run test:desktop\`: SKIPPED — no isolated audit WebView2 session was started for this request. The old native GUI audit is historical; current native compilation/tests and browser security/workspace regressions passed. No claim of new native GUI execution is made.

## Remaining Limitations

- ${after.zero_result_queries}/${after.query_count} benchmark queries have no direct resource. Maxwell equations has a known concept but no directly indexed resource; Maxwell velocity distributions are not a substitute.
- Precision uses conservative direct-title relevance hints. Related Taylor-polynomial/generic-energy material is excluded from default direct recall; the original broader measurements are preserved.
- Some descriptions are title/category context; only PhET currently has systematic thumbnails. Language/subject annotations are deterministic heuristics, not editorial classifications.
- GitHub Actions must be permitted to create PRs or receive \`INDEX_REFRESH_TOKEN\`. The repository permission API reported \`can_approve_pull_request_reviews: false\`; the new schedule cannot run until merged. No scheduled refresh PR is falsely claimed to have run.
- Third-party source outages and embedding restrictions remain external. No CSP/X-Frame-Options bypass, IPC expansion, telemetry or cloud backend was added.

## Release Readiness

READY FOR REVIEW — all required local gates pass; live retry passes. Release publication remains a maintainer review/tag decision.
`;
mkdirSync('docs/audits',{recursive:true});writeFileSync('docs/audits/v0.3-report.md',text);
const body=`## Summary

Upgrade STEM retrieval to multilingual concept groups with boundary-safe matching, explicit related exploration and measurable quality. \`角动量\` retrieves English angular-momentum resources; \`FT\` no longer matches \`left\`, and \`rot\` no longer matches \`prototype\`.

## Architecture

Canonical ontology → concept groups → Direct/Equivalent/Exploratory tiers → field evidence → deterministic ranking/explanations. Shared Rust/TS golden parity includes annotations. No security permissions or external backend added.

## Ontology

${stats.concepts} concepts, complete EN/zh-CN/zh-TW labels; ${stats.relations} related edges, ${stats.prerequisites} prerequisite edges; zero dangling edges/duplicate IDs/invalid aliases. Glossary derives from this source. Resource-term gap audit added.

## Search semantics

AND across groups, OR within equivalents. Word-boundary ASCII aliases, conservative single-character symbols, literal quoted phrases, no URL full-text matching. Related/prerequisites are opt-in, lower-ranked and labeled. UI adds resolved chips, snapshot freshness and zero-result reasons.

## Provider enrichment

Offline schema-2 annotations and honest description provenance. Seven-provider health gates reject empty/truncated/invalid/duplicate/semantically collapsed snapshots. Weekly/manual CI stages live data, benchmarks and tests, then opens a refresh PR. All seven live providers passed; one Math Insight timeout was rejected safely and succeeded on retry.

${providerTable}

## Benchmark

465 cases / 1,395 language queries, 172 resource-witnessed concepts with nonzero minimum requirements, 36 reviewed direct-title rules, 41 golden cases. The old engine is reconstructed from an immutable, tree-equivalent upstream baseline. Precision uses fixed k; unfilled/unjudged slots are nonrelevant. Three initial broad hints were corrected with public rationale and archived raw results; see [relevance review](https://github.com/styayur/stem-visual-explorer/blob/feat/v0.3-retrieval-overhaul/docs/audits/v0.3-relevance-review.md).

## Before/After

${metrics}

## Breaking changes

Default retrieval no longer expands related concepts or matches arbitrary URL substrings. Multiple concept groups require all groups. Ontology aliases are typed objects; index/cache schema is 2. No exported favorite/history/workspace format is invalidated.

## Migration

Version-1 desktop/index caches invalidate/rebuild with defaulted fields; browser v1 index keys are discarded. Content-hash cache keys prevent same-day stale snapshots. Existing favorites, history, settings and workspace resources remain readable.

## Testing

${testTable}

23 browser groups, 38 Rust tests in both feature configurations, exact golden parity, all retrieval/ontology/index gates pass. Live probe: 63 queries, seven providers, no fixtures/cache. Native GUI test was not rerun; native full compilation/tests passed. Raw logs and reports are committed under artifacts/.

## Known limitations

${after.zero_result_queries}/${after.query_count} benchmark queries have no direct indexed resources; Maxwell equations is correctly recognized with zero direct results. Title-hint precision is not full-document human judgment. Description fallback is labeled; language is heuristic. Scheduled refresh PR creation requires repository Actions permission or INDEX_REFRESH_TOKEN. No Release is published.

Full query results, score evidence, limitations and failure/retry provenance: [v0.3 audit](https://github.com/styayur/stem-visual-explorer/blob/feat/v0.3-retrieval-overhaul/docs/audits/v0.3-report.md).
`;
writeFileSync('artifacts/v0.3-pr-body.md',body);printReport('Generated reviewable audit and PR body from measured artifacts');
