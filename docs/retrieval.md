# Retrieval architecture (v0.3)

The search contract is multilingual concept resolution → concept groups → safe field matching → evidence scoring. It runs offline in TypeScript and Rust. Provider fetching remains a separate boundary.

## Canonical ontology

`src/lib/concepts.json` is the only terminology source. Its 490 curated undergraduate concepts cover calculus, linear algebra, differential equations, probability/statistics, mechanics, waves, electromagnetism, circuits, optics, thermodynamics, modern physics and introductory quantum mechanics. The existing flat label fields (`en`, `zh_cn`, `zh_tw`) are retained rather than introducing a second labels object. Every record has a stable ID, three labels, synonyms, typed aliases, subject taxonomy, levels, related edges and prerequisite edges. The translation glossary now reads this ontology.

Aliases specify `exact`, `phrase`, `token` or `cjk-substring`. Single ASCII formula symbols (`L`, `E`, `V`, `I`) are retained as `exact` metadata and deliberately disabled for free-text concept resolution/annotation. A literal one-character query can only match an exact field, not identify a physics concept. Japanese terms are selected synonyms where justified; this is not a complete Japanese ontology. `zh-TW` includes customary terminology as well as character conversion (e.g. 都卜勒效應 and 薛丁格方程).

`npm run ontology:validate` requires at least 300 concepts, complete trilingual labels, valid IDs/aliases, no duplicate IDs/canonical label collisions and no dangling/self edges. Isolation counts include incoming as well as outgoing edges. `npm run ontology:audit` scans titles, tags, descriptions and available categories for unmapped 1–4 word phrases occurring in at least two resources. It writes `artifacts/unmapped-resource-terms.json`; the output is a noisy review queue, never an automatic ontology writer. The first audit identified dynamical systems, autonomous equations, level curves and other resource-backed gaps; 25 concepts were added after review.

## Query normalization and matching

Whitespace and case normalize deterministically. Curly apostrophes and common typographic dashes normalize to ASCII equivalents. Greedy longest-term resolution keeps `partial derivative`, `angular momentum`, and Chinese labels together. `site:`, `source:`, `type:` and quoted phrases retain their existing syntax. Quoted phrases are additional literal field constraints, even when the phrase resolves to a concept.

Variants retain provenance and legacy weights for inspection, but weights no longer make every expansion a candidate. The three tiers are:

| Tier | Contents | Default recall |
|---|---|---|
| Direct | Original query and canonical labels | Yes |
| Equivalent | Synonyms and safe aliases | Yes |
| Exploratory | One hop of related and prerequisite labels | No |

Every recognized concept forms one group. Unknown lexical terms each form a group. Equivalent variants are OR within a group; default retrieval requires AND across all groups. There is no automatic OR relaxation. `gradient curl` therefore requires both concepts. A query with only source/type filters still browses that filtered index.

ASCII tokens/phrases require Unicode word boundaries; `FT` cannot match `left` or `after`, and `rot` cannot match `prototype` or `rotator`. No stemming broadens abbreviations. Inflected equivalents are explicitly curated. CJK labels permit substring matching. URLs are validated for HTTP(S), but neither full URLs nor slugs are search fields. Provider-native URL taxonomy may become explicit tags during parsing, with its origin documented.

## Evidence and ranking

Matching inspects title, each tag, description and canonical annotations separately. It never concatenates a giant title/tags/description/URL haystack. Tags do not form accidental phrases across tag boundaries. Annotations record their originating fields.

Each result carries `explanation`: matched concept IDs, field/tier/text evidence, matched/total group counts, a match tier, and score components. Field contributions are capped once, so repeating aliases cannot inflate a score. Native and TypeScript scores use the same numeric precision and round totals to three decimals.

| Component | Score |
|---|---:|
| All concept groups covered | 1000 |
| Partial coverage (debug/explicit exploration) | 500 × covered fraction |
| Exact equivalent/canonical/original normalized title | 100 |
| All groups in title | 75 |
| Other matching title | 55 |
| Canonical concept annotation | 65 |
| Tags | 30 |
| Description | 15 |
| Interactive/applet/simulation/visualization | 5 |

Title alternatives do not stack. Related-only results receive 10% of field scores. Complete direct results always precede incomplete/related results. Ties break by source name, lowercase title, then stable result ID. Inspect explanations through the search response, benchmark JSON or development store; normal result rows do not expose the debug payload.

## Related exploration and diagnostics

The compact search context shows resolved bilingual chips, separate related links, collapsed prerequisites and an **Expand related concepts** checkbox. The checkbox sends `related:true`, supported by both engines. This opt-in mode admits exploratory evidence, ranks it below complete direct matches and marks such rows **Related**. It does not relabel related concepts as synonyms.

A shared frontend diagnostic model handles `unknown-concept`, `known-concept-no-resource`, `filtered-out`, `provider-disabled`, `provider-error`, `index-stale`, `language-mapping-gap`, and `true-no-match`. Type-filter accounting is retained as `unfiltered_total`; UI-only source/type filters are also considered. Provider failures and stale indexes are distinct from evidence of resource absence. `language-mapping-gap` is an explicit evidence flag for adapters; the healthy canonical resolver does not manufacture this diagnosis merely because a Chinese query is empty. Currently no shipped adapter claims that flag without evidence. Known empty results say that the enabled indexes have no direct match, not that no resource exists anywhere.

Web search displays the oldest/newest provider snapshot date and a nonintrusive badge after 30 days. Fetch dates are UTC. Pages is a static snapshot, not live provider search. Desktop live/cache behavior remains separate.

## Semantic metadata and provider quality

Index schema 2 adds `concept_ids`, `concept_evidence`, `subject`, `language` and optional `description_source`. Deterministic dictionary matching uses title/tags/description, never external LLM calls. Subject derives from matched concepts; an empty subject/concept list is an honest coverage gap. Language is a script heuristic with a known Japanese-provider override; it is not a language classifier.

Falstad and BetterExplained retain provider category/title context; Maotian preserves full CamelCase taxonomy phrases before splitting tags. A bounded adjacent-text/title-attribute reader uses listing metadata when available. Missing summaries fall back to title and provider category, labeled `title-and-provider-category`; these are not newly scraped article abstracts. Coverage reports expose this provenance rather than interpreting 100% description presence as 100% rich summaries.

`CachedIndex::new` annotates desktop entries. `npm run index:enrich` annotates shipped snapshots, preserves fetch dates, and records SHA-256 content hashes in the manifest. Web cache keys include schema and content hash, so same-day deployments cannot silently reuse an older snapshot.

Quality gates reject an empty provider, >30% entry-count drop, >5% invalid URLs, >5% empty titles, >5% duplicate URLs, or >30% relative semantic-coverage collapse when previous coverage exceeded 10%. The Node gate also requires all seven provider IDs, matching manifest counts/dates, valid annotation IDs/evidence, schema 2 and valid content hashes when supplied. Runtime automatic refresh failures retain usable previous caches; forced refresh reports the error. The snapshot generator fetches every provider live and validates all providers before writing destination files. CI uses a separate candidate directory, so a failed gate cannot publish partial data.

## Cache migration

Rust `CACHE_VERSION` is 2. Missing semantic fields deserialize with defaults, then version-1 caches are rejected and rebuilt; malformed cache JSON follows the existing recoverable path. Browser indexes move from `sve.webIndex.v1` to `sve.webIndex.v2`; old index keys are discarded on manifest load. Favorites/history/settings/workspace keys are unaffected. Old favorite/resource JSON remains readable because new result fields are optional/defaulted.

## Benchmark methodology and baseline

`tests/concept-benchmark.json` freezes 465 concept cases / 1,395 language queries. 172 cases require real resources (some important cases require two). Their positive URLs are literal-title witnesses selected independently from the original v0.2 corpus. Other cases explicitly test ontology coverage without claiming a provider contains a resource. Benchmarks never rewrite expectations. Zero-result rate includes all 1,395 queries, including unsupported concepts; no provider is excluded.

`tests/precision-ground-truth.json` has 36 manually reviewed direct-title relevance rules. Precision@5/@10 uses a fixed denominator of 5/10; missing slots and unjudged titles count as nonrelevant. This is a conservative title-hint estimate, not exhaustive full-document relevance judgment. `docs/audits/v0.3-relevance-review.md` records corrections to three overbroad initial rules and preserves the initial measurements. No hard false-positive cases or minimum-resource requirements were removed.

Metrics include exact concept resolution, witnessed-resource concept recall, cross-language expected-concept parity, top-10 URL Jaccard overlap, precision, zero results and hard false positives, with per-subject breakdowns. Empty/empty top-10 overlap is 0 (not an inflated perfect match); interpret it alongside resource coverage and concept parity.

The baseline was measured before code edits at `3cd6ceb`. Its upstream squash merge `b380db8` has an identical Git tree and is the reachable reproduction ref; the script records both. `npm run baseline` reconstructs the old engine/data in an isolated temporary directory. `npm run benchmark` runs (1) old engine/old corpus, (2) new engine/annotated old corpus, (3) new engine/current snapshot. This separates algorithm gains from live-provider changes. Full raw results and compact summaries are committed under `artifacts/`.

Gates require resolution ≥95%, concept parity ≥95%, zero hard false positives, all frozen positive-resource minima, aggregate precision@10 ≥ baseline, and no per-language precision decline on the 36 reviewed important queries. A known concept such as Maxwell equations may correctly have zero direct resources in these providers; Maxwell velocity distributions must not fill that gap.

## Web/Desktop parity and reproducibility

`tests/search-golden.json` is consumed by TypeScript and Rust. The 41 cases cover parsing, normalized IDs, variants/modes/tiers, group semantics, literal quotes, filters, boundary regressions, exploration and ranking. `npm run test:parity` compares full query groups, variants, ranked scores, explanations and deterministic annotations across runtimes. Rust also checks all 1,395 frozen language queries in `cargo test`.

```sh
npm ci
npm test
npm run build
npm run build:web
npm run test:web
npm run test:web:build
npm run ontology:validate
npm run index:quality
npm run benchmark
npm run test:parity
npm run ontology:audit
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features
cargo clippy --manifest-path src-tauri/Cargo.toml --no-default-features --all-targets -- -D warnings
cargo check --manifest-path src-tauri/Cargo.toml --locked
```

Live verification is separate: `cargo run --no-default-features --example dump_web_index` and `cargo run --no-default-features --example probe` from `src-tauri/`. The probe fetches fresh provider indexes once, then runs 63 EN/zh-CN/zh-TW/alias/multi-concept queries, recording groups, direct/equivalent terms, per-provider counts and top five results in `artifacts/provider-probe.json`. It exits nonzero on provider failure. Parser fixtures/browser routes are never reported as live successes.

## Scheduled refresh and permissions

`.github/workflows/refresh-index.yml` runs weekly on Monday 03:23 UTC and supports manual dispatch. It stages real provider indexes, annotates/hashes, validates counts/coverage, runs the benchmark, promotes only in the runner workspace, and runs build/browser/Rust/parity checks. Only then does a pinned create-pull-request action update `chore/refresh-provider-indexes` with a provider before/after table and retrieval metrics. No step pushes to main or publishes a Release.

The repository must permit Actions to create PRs, or maintainers can supply `INDEX_REFRESH_TOKEN` with repository/PR permissions. No token is stored in source. A denied PR-creation permission leaves the validated workflow artifacts available; it must not be misreported as a completed refresh PR.
