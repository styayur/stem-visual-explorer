# Concept-driven STEM Learning Workbench

Search discovers objects. Opening a concept changes a **ConceptSession** without
running another textual search. The current concept determines the work area.

Query discovery now follows `Raw Query → Resolver v2 → Canonical Concept IDs →
ConceptSession → Workbench`. Universal Search projects ranked accepted concepts
before their capabilities. Ambiguous queries expose explicit localized concept
choices; unknown queries retain ordinary resource search. Neither opens a
Workbench automatically. The [resolver document](query-resolver-v2.md) owns the
normalization, scoring, abstention and parity contract.

```text
Query / Graph / Resource / Learning Path
                 ↓
           ConceptSession
                 ↓
         Concept Workbench
                 ↓
         Capability Registry
         Learn / Visualize / Read / Explore / Practice
```

## Ownership and navigation

`workbench/conceptSession.ts` implements pure transitions. The separate Zustand
store owns one Concept ID, entry provenance, surface, selected capability/lesson
entry and a bounded trail. It owns neither SearchResponse nor search history.
The trail holds at most 32 entries; new navigation after Back truncates Forward.
Returning restores the surface while resetting lesson playback and resource
selection. Reopening the current concept preserves its context.

Prerequisite, related/next and graph links use canonical navigation. Resource
preview concept links do too; in a separate resource workspace they follow the
existing `?route=search` route with a validated `concept` parameter. Ordinary
workspace return, notes and previews remain available. **Search resources for
this concept** is an explicit action that closes the workbench and calls the
existing search store.

Per-window `sve.workbench.v1` sessionStorage contains only validated Concept IDs,
surfaces and trail cursor. **Resume Concept Session** restores them explicitly.
Queries, origins, resource payloads, lesson state and commands are not persisted.
Malformed histories are rejected; unavailable surfaces become Overview. Storage
failure is non-fatal.

## Resource resolution

`resolveConceptResources(conceptId)` reuses webIndex's manifest, provider-index
validation, pending-request deduplication and caches on Web and Tauri. The
reviewed static indexes ship with both frontends. `resourcesForConcept` selects
direct `concept_ids` membership and sorts by provider/title/ID. It never uses
the last query, exploratory matches or last search response. Ordinary provider
search retains its enabled-provider, ranking and native Rust behavior.

Workbench resources are **known snapshot resources**, including providers
disabled for ordinary search. They are not a live native refresh. Partial
failures retain successful providers and show missing sources with Retry.
Empty concepts offer ordinary resource search. A concept change clears the
display immediately; obsolete asynchronous loads cannot publish into the
replacement workbench.

## Capability registry and curriculum

`capabilities/registry.ts` adapts existing learning profiles, lightweight
visualization metadata, curriculum references and provider entries. Original
data stays in its owning module. IDs, Concept IDs, typed kind and native/external
availability form the unified read model.

Guided lessons map to Learn; standalone visualizations to Visualize;
articles/textbooks/proofs to Read; simulations to Explore; exercises to Practice.
Empty groups disappear. A guided lesson also opens in the dominant Visualize
surface as another view of the same capability. Proof/exercise types are
supported without inventing content. Provider resources are classified
conservatively; proof or license status is never inferred from a title.

`learning/curriculum.ts` defines CurriculumSource and one real adapter for
数理化自学丛书. Its seven original reviewed references retain source/book/section,
language, URL and rights provenance. No prose, scan or illustration is imported.
External provider licenses remain **unknown** when no metadata exists.
Historical spellings stay outside the canonical ontology and use existing
shared TS/Rust recognition.

## Surfaces and Inspector

- Overview: semantic identity, prerequisites, next/related concepts, capabilities.
- Learn: objectives and ordered teaching path; stages open reviewed lesson steps.
- Visualize: dominant numeric board, authored equations, controls, descriptions
  and reduced-motion snapshots.
- Resources: direct annotations, textbook paths and only represented type
  filters. Selecting a row changes Inspector provenance.
- Graph: deterministic current node plus one-hop prerequisite/next/related
  relation groups. Default limit: 20 nodes. No force simulation or graph backend.

The Inspector follows concept, resource or lesson context. The common player
publishes step/status/parameter changes and registered reducer actions, not
per-frame animation ticks. Optional observation/cause/consequence/misconception
fields contain reviewed trilingual examples at SHM crossing, ellipse focal sum
and determinant area; other steps receive no filler.

Desktop uses navigation / work area / Inspector. Below 1200px Inspector becomes
a toggleable panel; below 650px navigation also collapses. The center scrolls
independently, lesson controls stay accessible, and 390px tests verify overflow
and actual board geometry. Landmarks, headings, focus, labels, equations and
textual relation names preserve keyboard and screen-reader access.

## Universal Search and commands

SearchBar retains provider queries and history suggestions. Object suggestions
use the existing `parseAndExpand`, then project Concept, Lesson, Visualization,
Textbook and Graph-command entries in deterministic categories. Resource entries
require a matching current search response. This is bounded object search,
not a second fuzzy/semantic resolver.

`registeredCommands(context)` creates local actions from available surfaces,
graph projection and live lesson actions. Play disappears for unavailable or
reduced motion; Previous/Next respect bounds. No command string is executed.
The palette supports filtering, arrows, Enter, Tab containment and focus return.

| Shortcut | Behavior |
| --- | --- |
| Ctrl/Cmd+K | Toggle Command Palette, including from a typing control. |
| Ctrl/Cmd+L | Focus universal search. |
| Escape | Close palette, expanded workbench panel or workbench. |
| Alt+Left / Alt+Right | Navigate concept trail when not typing and a destination exists. |

Existing search-list and lesson controls remain in their own context.

## Lesson loading and security

The small visualization catalog registers explicit dynamic imports for
`lessons/shm.ts`, `ellipse.ts`, `linear.ts`. LazyLesson loads only the selected
definition, then the shared player. JSXGraph, KaTeX and equation rendering remain
lazy; Overview and Resources load neither. `definitions.ts` is an eager
compatibility barrel for offline schema/math tests only. Production never
imports it. Shared reducer/math/scenes/renderer remain reusable.

JSXGraph is pinned to **1.13.3**. Vite substitutes fail-closed JessieCode and
Geonext interfaces and removes the obsolete Function ES6 probe with an
exact-source guard. Numeric callbacks and SVG primitives are reviewed source;
no generated JavaScript or dependency source vendoring is involved.
**JSXGraph upgrades require explicit security review.**

Build provenance rejects original JSXGraph parser modules and unexpected
versions, recording `visualization-boundary.json`. `test:visual-bundle` parses
final JS assets with the TypeScript AST, checking global eval/Function call/new
syntax, indirect comma calls and global-object call/apply/bind. Strings/comments
and JSXGraph's numeric `.eval` callback helper are not JavaScript execution.
This targeted invariant is complemented by real interactions with global
eval/Function blocked; it is not a general-purpose security analyzer.

External links retain httpUrl, Tauri boundaries and existing preview policies.
No CSP, arbitrary iframe or remote-script permission is expanded.

## Extension guide

1. Reuse a reviewed canonical Concept ID and create a real learning profile.
2. Add a static independently loaded definition and lightweight catalog entry.
3. Reuse the common reducer/renderer or introduce an explicit reviewed adapter.
4. Add mathematical invariants, complete localization and capability adapters.
5. Add metadata-only curriculum sources with actual provenance/rights status.
6. Register commands only for implemented actions.
7. Run schema/math, context, browser, native and final-asset checks.

The independent Adversarial Query Robustness Benchmark stores 220 reviewed
queries separately from gold expectations. It measures this resolver's lexical
robustness, not general semantic understanding. Weak scores and case-level
failures remain in its output. It does not replace canonical benchmark/parity
gates. See the validation report for metrics and limitations.
