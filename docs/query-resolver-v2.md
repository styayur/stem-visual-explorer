# Query Resolver v2

Prepared for 0.4.0-alpha.3. This implementation is offline and deterministic.
It is still a draft maturity step: development exact accuracy is 95.15%, but
holdout exact accuracy is 69.09%. The 26.06 percentage-point gap is visible in
the benchmark and is not fixed by copying holdout phrases into production.

```text
Raw Query
  ↓
Normalizer (mechanical Unicode/script conversion)
  ↓
Lexical / Symbolic Parser
  ↓
Candidate Generator (indexed vocabulary + bounded typo recovery)
  ↓
Deterministic Ranker / overlapping-span constraints
  ↓
Ambiguity / Abstention
  ↓
Canonical Concept IDs
  ↓
ConceptSession → Workbench
```

## Public contract and ownership

`src/query/resolve.ts` exports `resolveQuery(raw): QueryResolution`. Its typed
contract contains normalizedQuery, groups, conceptIds, ranked candidates,
status, heuristic confidence, evidence, residualTerms and a reason. Candidates
contain integer scores, evidence, matched terms and penalties. Confidence is a
score divided by 100, not a calibrated probability. It is not displayed as a
percentage in the UI. `explanations.ts` supplies a development-only helper with
tokens and the full resolution; it is not imported by the normal UI.

The 494 canonical concepts and their aliases are unchanged. The query lexicon
is a separate 37-entry resource. Resource annotation still uses ontology field
matching only; colloquial and typo rules do not annotate provider resources.
Resource URL fields never enter candidate scoring or semantic annotation.

`normalizeConcepts()` and `parseAndExpand()` remain compatibility wrappers.
`projectConceptResolution()` expands only the IDs selected by Resolver v2 into
the original multilingual resource-search variants and explicit exploratory
edges. Universal Search consumes ranked accepted candidates from this same
resolution. Ambiguous results expose only concept choices, without deriving
capabilities until the user chooses. Unknown results keep ordinary resource
search; they do not open a ConceptSession. There is no second fuzzy resolver.

## Normalization and scripts

Normalization maps reviewed mathematical characters before native NFKC, then
folds case, selected traditional characters, whitespace, punctuation, apostrophes
and dash/minus variants. Superscript powers retain `^2` / `^3` structure.
Greek symbols such as ω/λ/φ/π become omega/lambda/phi/pi tokens. Multiplication
and cross-product structure remain present for the symbolic layer.

For example, `Ｆｏｕｒｉｅｒ` becomes `fourier`; `∇×F` becomes `∇×f`;
`轉動的動量` becomes `转动的动量`, never `angular momentum`. Normalization is
idempotent on the supported inputs.

`rules.json` contains a manually reviewed orthographic character table.
Aligned regional labels must **not** generate this table: 電位/电势 and other
regional terminology are semantically equivalent phrases, not character
conversions. Ambiguous 後/發/髮/乾/幹/係/臺/裡 are preserved. Complete canonical
EN, zh-CN and zh-TW labels are independently indexed; the four historical
spellings preserve the existing reviewed source metadata. Tests verify that
位相, 能力, 分裂, 波, 定理 and other unrelated text are not rewritten.

## Lexicon, abbreviations and Chinese scaffolding

Every lexicon entry names a pattern, canonical IDs, kind, language, confidence,
provenance and reason. Historical entries cite the existing 数理化自学丛书
物理（第二册）§1.1/§1.3 metadata. This stores only short terminology and source
references, not textbook prose or a claim to ownership of those phrases.

Curated groups include rotational momentum, spring stiffness/motion,
time-derivative descriptions, circulation/steepest ascent, mixed-language
transform names and standard STEM initialisms. Entries derived from development
examples are marked `benchmark-generalized` where applicable. Their coverage
does not amount to general Chinese NLP.

Scaffolding such as 怎么算/是什么/怎么理解 is removed from **unmatched residual
text after candidate generation**. This preserves concept-bearing phrases such
as 振动的位相 and 速度的变化率. Remaining content imposes a large penalty rather
than being silently discarded. `面积怎么变` requires an independently matched
linear-transformation or matrix context; it cannot independently select a
determinant. `线性变换面积怎么变` selects both concepts.

Abbreviations require token boundaries. A CJK neighbor is permitted for an
abbreviation in a mixed-language query; leftover unrelated content still causes
abstention. FT has explicit competing Fourier-topic/transform interpretations:
it is ambiguous and yields no accepted IDs. The prior golden case is explicitly
migrated; FT inside left/after remains impossible. Exact canonical curl/phase/
wave labels still resolve. No generic correction is attempted on ≤3-character
tokens.

## Indexed candidates, typo recovery and scoring

Initialization builds an initial-character vocabulary index and a word-count
index of Latin typo phrases. Normalized duplicate labels merge deterministically;
canonical spellings take precedence over incidental synonym collisions. Query
lexicon ambiguity remains explicit. Reusable `conservation of N` → `N
conservation` composition is generated from canonical labels, outside ontology.

Exact and structural matches precede typo recovery. Latin token/phrase boundaries
are mandatory; CJK permits explicit, finite lexical substrings. Single-character
canonical labels require boundaries, preventing 波 from matching 波士顿. Typo
recovery uses only complete Latin tokens/phrases up to six words, with exactly
one changed word and one insertion/deletion/substitution/adjacent transposition.
Both changed words must exceed three characters. It does not scan fuzzy arbitrary
substrings. `momemtum`, `fourrier transform` and `determinent` have bounded-typo
evidence. Unrecognized surrounding words cannot create a confident recovery.

| Evidence | Integer weight |
| --- | ---: |
| Canonical label / canonical ID | 100 |
| Ontology alias | 96 |
| Curated/historical query lexicon | round(92 × entry confidence) |
| Formula pattern | 90 |
| Symbolic operator / generated conservation composition | 88 |
| Abbreviation | 86 |
| Bounded typo | 76 |

Longer matching spans claim their component terms before shorter spans. This
prevents angular momentum from independently emitting momentum, while explicit
`动量与角动量` keeps both. Independent spans become AND concept groups; safe
multilingual equivalents within a concept remain OR variants. A whole structural
identity is interpreted as a unit before lexical components.

Unexplained letter/number content subtracts 45; competing interpretations subtract
10. Acceptance requires score ≥70 and an eight-point margin between competing
meanings on the **same span**. Independent requested concepts do not compete
against one another. Ties use canonical ID ordering, never incidental array
order. Ambiguous queries return no accepted IDs. Unknown queries expose rejected
candidates for debugging but cannot create canonical navigation.

## Restricted symbolic and formula parsing

Shared, anchored token patterns recognize ∇×F, ∇·F, ∇f, named grad/div/curl/det
operators, derivative notation, educational integrals, determinant bars,
eigenpair identities and selected formulas. `Av=λv` proposes eigenvalue and
eigenvector; the variable must agree on both sides. `Av=λu` does not count.

Formula patterns cover F=ma, F=-kx, p=mv, L=r×p, E=mc², V=IR, the ellipse standard
equation and selected harmonic motion identities. Recognized equations preserve
required variable relationships. They are a finite grammar, not a CAS, and do
not promise algebraic equivalence or arbitrary notation. F=-kx chooses Hooke's
law; a standalone second derivative is a derivative, not by itself an ODE.

## Safety and parity

The resolver bounds input at 512 UTF-16 units, parentheses at depth 32, and typo
phrase length at six words. Oversized input, malformed Unicode in JS, unbalanced
parentheses and incomplete structures gracefully abstain. The flat patterns
have no evaluation, code generation, recursive expression expansion, arbitrary
functions or remote calls. Normal search syntax parsing is also bounded before
token scanning. Production sources are checked for adversarial-fixture imports
and benchmark IDs. Rust test-only includes are compiled under `cfg(test)`.

Rust `search/resolver` mirrors normalization, indexing, candidates, span
constraints, integer scores, ranking and evidence. Both consume the same JSON.
`regex` was already present transitively and is now declared directly;
`unicode-normalization` is needed because Rust std lacks NFKC. It is dual
MIT/Apache-2.0 (locked at 0.1.25) and adds no frontend package. Native JS NFKC
and the Rust Unicode tables are verified against the shared corpus; arbitrary
future Unicode-version differences are not claimed to be exhaustively covered.

`npm run test:parity` retains the original search ranking/annotation parity and
adds 1,783 complete resolver contracts: representative mechanisms, 1,482 exact
canonical labels, malformed structures and all 220 frozen adversarial cases.
Scores, evidence, normalized groups, statuses and residuals compare exactly.
Canonical punctuation/idempotence and orthographic safety are also tested in
Rust's normal test suite.

## Benchmarks, gates and extension

The original 220 queries and independent gold remain unchanged. Every fourth
case within each category becomes the separate holdout (165 development, 55
holdout). The split was written before inspecting development data. Holdout was
first evaluated after rules froze; the only later pattern edits correct variable
consistency and the meaning of a standalone derivative, independently of held
queries. Future changes must treat this already evaluated holdout honestly and
add a separately reviewed new holdout if tuning on its failures.

Metrics name exactConceptSetAccuracy, top1ConceptAccuracy and
negativeRejectionRate explicitly. Top-1 uses the highest-ranked **accepted**
candidate on positives; abstentions count as failures. Baseline first-resolved
accuracy used alphabetically sorted old IDs and is not a calibrated ranker.
Mechanism counts are nonexclusive and only include exact successful positives.
Language, category and a fixed category-level difficulty rubric are reported.
Unknown abstention uses negative gold; independent ambiguity-status accuracy
uses the compact FT contract, one case, not the 220 concept-set gold.

Hard gates retain canonical quality, full parity, zero hard false positives,
negative rejection at least the old 67.86%, and holdout no more than five points
below its measured v1 40% baseline. Targets include overall/category improvement
and a dev/holdout gap ≤20 points. The first experimental gap assertion failed;
it was separated from the **regression** gate, and remains a loud reporting
failure. Draft status is retained because 26.06 points exceeds that quality
target. No benchmark thresholds or gold were modified to conceal a failure.

Artifacts report lexicon size, zero ontology-alias growth, normalized exact
lexicon/query overlap, accepted mechanisms, false positives and abstentions.
Node performance uses 3,300 fixed development queries and reports cold import
initialization, median/p95/max, batch time, heap and static-data size. It does not
claim browser latency. See [measured report](audits/v0.4-query-resolver-report.md).

To extend: document a reviewed phrase/rule and provenance outside ontology; add
independent positive and near-negative cases; validate all canonical mappings;
run both language implementations and full parity; measure on development and
then a new held set. Do not copy benchmark IDs or queries into runtime, weaken
boundary guards, or grow ontology merely to recognize a query.
