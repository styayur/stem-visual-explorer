# Concept-driven visual learning

The v0.4.0-alpha.1 MVP adds native guided lessons to the existing Web and Tauri search client. It preserves provider search, ranking, preview policies, favorites, history, workspaces and translation. Search for **简谐振动 / simple harmonic motion**, **椭圆 / ellipse**, or **行列式 / determinant** and click the resolved concept's **Learn visually** action. A concept can be learned even when the current provider filter returns no resources.

## Architecture

```text
Ontology — what the concept is
  ↓ existing Concept ID and query resolver (TypeScript / Rust parity)
Learning Registry — how to understand it
  ↓ prerequisite IDs, objectives, ordered path, references, visualization IDs
Visualization Registry — reviewed teaching definitions
  ↓ localized steps, equations, invariants, parameters, presets, scene descriptions
Guided State Machine — explicit learner actions and bounded numeric state
  ↓ numeric scene frame (points, paths, polygons, arrows, readouts)
VisualizationRenderer → JSXGraphRenderer — drawing and pointer input
```

`src/lib/concepts.json` remains the canonical ontology. Only four missing concepts were added: ellipse, Hooke's law, spring constant and mechanical equilibrium. The existing `newton-s-second-law` ID is reused. The Chinese synonyms 简谐振动 / 簡諧振動 were moved from `harmonic-oscillator` to `simple-harmonic-motion`; the oscillator keeps its modern labels and other synonyms. This intentional correction also updates the glossary expectation, without removing an assertion.

`src/learning/types.ts` defines `ConceptLearningProfile`, `LearningStage`, `TextbookReference`, `HistoricalAlias` and `LocalizedText`. The small registry has **four supported profiles**: SHM, ellipse, linear transformation and determinant. The last two share one lesson. Paths refer to a visualization ID and a step ID; registry tests check all links and ontology edges. Unsupported concepts open an overview with their ontology prerequisites, related concepts and external-resource search. No empty profiles or placeholder animations are generated.

## Teaching definitions and renderer boundary

`GuidedVisualizationDefinition` in `src/visualizations/types.ts` declares the title, concept IDs, kind, renderer, steps, bounded parameters and presets. Each `GuidedStep` supplies three-language title/explanation/invariant, TeX equations, scene stage, visible controls and highlighted primitive IDs. An invariant expresses the structure the learner should recognize, including whether it applies only while parameters are fixed.

`definitions.ts` contains all authored lesson content, outside JSX. `math.ts` contains analytic models; `scenes.ts` turns those models into `SceneFrame` data. Models do not import React or JSXGraph. A scene frame has a numeric bounding box, labeled numeric geometry and readouts. `VisualizationRenderer` selects the adapter; only `renderers/` imports JSXGraph. Future adapters would implement the same numeric-frame boundary and extend the renderer discriminator; this MVP implements only JSXGraph in 2D.

Boards are initialized once per primitive structure/theme. Updates change point coordinates and data curves, rather than recreating the board every animation frame. Board, resize handlers, animation callbacks and media/theme observers are disposed on unmount. Trace history is bounded at 600 samples. The ellipse's P is projected to its locus after a pointer drag; labeled sliders provide an equivalent keyboard route.

## Pedagogical state machine

`stateMachine.ts` owns the step index, paused/playing/completed state, elapsed physical time, normalized parameters and visited locus points. Its pure reducer handles `seek`, `play`, `pause`, `restart`, `tick` and `parameters`.

- Previous/Next and path entries change the teaching state, reset its clock and pause. Playback never silently advances the learner to another step.
- Play/Pause animate or freeze the current scene. Completed one-shot scenes restart on Play. Static steps have playback disabled.
- Parameter changes pause playback and establish a new system. Restart resets the lesson to its first step and default parameters.
- SHM playback uses physical time and `ω = √(k/m)`; the release stops at the first equilibrium crossing and the periodicity step stops after a full period.
- Ellipse tracing records only visited points, clearing when a or c changes. Later steps show the complete locus.
- Transformation playback interpolates `B(s) = (1−s)I + sA`; the progress slider can inspect any intermediate matrix. This interpolation can pass through a singular B even when A is invertible. Readouts distinguish the target A from the displayed B.
- Hidden tabs pause. Frame deltas are bounded, avoiding large jumps after a stall. A change to reduced-motion preference pauses immediately and disables playback.

## Implemented lessons

| Lesson | Guided states | Controls / structure |
| --- | --- | --- |
| SHM (10) | Equilibrium → displacement → restoring force → Newton II → release → equilibrium crossing → opposite displacement → periodicity → equation/phase → energy | Drag the mass in the displacement/force stages; A, k, m, φ sliders; spring/mass view, force/velocity/acceleration vectors, x(t), K/U/E bars. `F = −kx`, `a = −ω²x`, `x = A cos(ωt+φ)`, `K+U = ½kA²`. |
| Ellipse (7) | Foci → P and distances → constant sum → traced locus → a/b/c → right triangle → standard equation | Drag P, or use θ; a and c sliders enforce `0 ≤ c < a` (a 0.1 safety margin). `PF₁+PF₂ = 2a`, `b² = a²−c²`, `x²/a²+y²/b² = 1`. The c=0 circle limit is supported. |
| Linear transformation / determinant (7) | Identity → basis images → continuous grid transform → parallelogram → area → orientation/collapse → exploration | Four matrix-entry sliders, progress, rotation/scaling/shear/reflection/singular presets. Original dashed grid and square remain as references. Columns determine the basis images; `|det(A)|` is the area ratio and its sign is the orientation. Corner order makes orientation observable without relying on color. |

SHM assumes an ideal horizontal spring with no friction, and no damping or forcing. Vectors use disclosed display scales; readouts give the exact SI values. Energy stays constant during motion with fixed parameters; changing A or k changes the total energy. In displacement stages the mass is held to the positive side before release; the opposite-side state demonstrates compression and force reversal.

## Textbook references and historical terminology

The [upstream collection](https://github.com/tradecatlabs/shulihuazixuecongshu) is an external reference provider. Its [rights statement](https://github.com/tradecatlabs/shulihuazixuecongshu#权利说明) does not grant a new license to the original prose, layout or scans. Titles were checked against the [catalog](https://github.com/tradecatlabs/shulihuazixuecongshu/blob/main/catalog.json) and book headings on **2026-10-05**:

- 物理（第二册）: § 1.1 简谐振动; § 1.2 简谐振动方程; § 1.3 简谐振动方程中的参量; § 1.6 简谐振动的能量.
- 平面解析几何, 第四章 圆锥曲线: § 4·5 椭圆的定义; § 4·6 椭圆的标准方程; § 4·7 椭圆的性质.

`textbooks.ts` stores only source ID, collection/book/chapter/section labels, concept IDs, language, URL and `rightsStatus: "external-reference"`. The UI shows those labels, the **External textbook reference** marker and a link to the source book. It does not fetch or display book prose, scans or figures. Third-party content is not relicensed under this project's AGPL license. No textbook mapping is claimed for the linear-algebra lesson.

`historicalAliases.json` contains four reviewed spellings: 倔强系数 / 倔強係數 → spring constant, and 振动的位相 / 振動的位相 → phase. The traditional spellings are explicitly marked as transcriptions in their source metadata. Both TypeScript and Rust extend their existing query lookup from this shared JSON; canonical names take precedence. Aliases do not become resource annotations or additional recall variants. The search context shows the legacy spelling alongside the modern resolved label. No bulk import is performed.

## Security

Definitions and equations are static reviewed source. Parameters and pointer input are bounded numbers. Scenes never accept expression strings, remote scripts, LLM-generated executable code or user HTML. JSXGraph labels use internal SVG text with parsing disabled. External resource and textbook URLs pass through the existing `httpUrl` and platform `openExternal` boundary.

JSXGraph 1.13.3 is pinned. Its default entry includes an executable expression parser and a `Function`-based ES6 probe. The numeric-only module entry registers the required 2D primitives. The `jsxgraph-numeric-only` Vite plugin redirects JessieCode imports to `DisabledJessieCode`, whose expression entry points throw, and replaces the obsolete ES6 probe with a no-op because the application targets ES2021. It checks the exact probe before replacing it, failing on an unexpected upstream change. No installed dependency files are edited or vendored. Review this boundary when upgrading JSXGraph.

KaTeX renders the authored equations as selectable HTML plus accessible MathML with `trust: false`, strict parsing and bounded expansion/size. There is no `dangerouslySetInnerHTML` in lesson components. Browser regressions run the actual adapter with global eval and Function blocked and check that the application never attempts to use them; Playwright's own attempted string evaluation is separately identified by its UtilityScript stack. No remote executable script requests are allowed by that test.

## Accessibility and localization

All titles, explanations, invariants, parameter labels, presets and lesson UI messages have EN / zh-CN / zh-TW values. Numeric/math symbols are shared. Screen-reader users receive the step explanation, invariant, MathML, named controls and numeric readouts independently of the diagram. Changing steps announces the new reasoning. SVG has a descriptive accessible label. The panel focuses its heading, Escape returns to search, and closing restores focus to the initiating concept button. Existing search shortcuts do not act on hidden search results while the learning surface is open.

Native buttons and range inputs support keyboard exploration, with visible focus. Force/velocity labels, numeric values and corner ordering complement color. `prefers-reduced-motion` disables playback while every meaningful static state remains accessible through steps/sliders. The diagram and explanation stack on narrow screens; the suite verifies a 390px viewport without horizontal overflow. The board itself is pointer-driven; keyboard manipulation uses equivalent labeled sliders.

## Loading and performance

The overview and compact path registry load with search. React.lazy imports `GuidedVisualization` only when a lesson or path entry is opened. Full lesson content, numeric scenes, JSXGraph, KaTeX, formula CSS/fonts and visualization CSS are in that dynamic dependency graph. Browser tests assert neither initial search nor the unopened overview requests lesson-engine assets. Search is independent of their successful loading; a lesson error boundary retains the overview and references.

The three lessons currently share a single lazy engine chunk. This is deliberate for the small MVP; it is larger than 500kB uncompressed and produces Vite's chunk-size warning. Later modules can split by adapter/family as the registry grows. No Three.js, MathBox, physics engine, database, account or backend service is added. See the validation report for measured bundle sizes.

## Validation and extension

`npm test` includes `test:learning`: profile/visualization schemas, graph/path resolution, historical lookup, all localization fields, KaTeX equation parsing, state transitions, analytic SHM force/frequency/energy, ellipse distances/constraints, transformed basis/polygon area/orientation and numeric scene geometry. Existing assertions remain; the glossary assertion changes only to reflect the corrected SHM synonym. Search golden parity includes new lesson queries and legacy aliases.

`test:web` and `test:web:build` both run the shared `visual_learning_regression.mjs` against real app assets. It covers search → overview → lesson, every step in every language, pointer dragging, keyboard sliders, play/pause/reset, all matrix presets, references, focus restoration, fallback, reduced motion, mobile layout and the security/lazy-loading boundaries. `test:desktop` also exercises native learning in the existing isolated test profile. Browser screenshots are generated under ignored `artifacts/visual-learning/`.

To add a visualization:

1. Reuse an ontology concept ID; add a canonical concept only if it is genuinely missing. Never use a second keyword matcher.
2. Write the learning objectives, prerequisites and ordered path in `learning/registry.ts`. Every stage links to a real step.
3. Author a `GuidedVisualizationDefinition` with all three languages. Each state must say what changes, what is invariant, why the next state follows and which equation describes it. Address a specific misconception in the explanation.
4. Implement a pure numeric model and scene-family builder using the existing primitives. Extend the static scene union and renderer contract deliberately if new geometry is required; do not generate code at runtime.
5. Add parameter normalization, mathematical invariant tests, localization/schema/path checks and actual browser interactions. Verify static reduced-motion states and a narrow viewport.
6. Add only reviewed external metadata references, retaining their rights status. Keep any legacy recognition separate from canonical terms. Measure lazy loading and preserve all search/desktop regressions.
