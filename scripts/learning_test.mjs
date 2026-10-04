import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import katex from "katex";
import { conceptById, annotateResource } from "../src/lib/concepts.ts";
import { parseAndExpand } from "../src/lib/searchEngine.ts";
import { httpUrl } from "../src/lib/urls.ts";
import {
  getLearningProfile,
  learningProfiles,
} from "../src/learning/registry.ts";
import { historicalAliases } from "../src/learning/historicalAliases.ts";
import { learningText } from "../src/learning/uiText.ts";
import {
  visualizationDefinitions,
  getVisualization,
} from "../src/visualizations/definitions.ts";
import {
  shmState,
  ellipseState,
  determinant,
  transform,
  orientedArea,
  orientation,
  TAU,
} from "../src/visualizations/math.ts";
import {
  initialLessonState,
  reduceLesson,
  normalizeParameters,
  lessonDuration,
} from "../src/visualizations/stateMachine.ts";
import { buildScene, currentMatrix } from "../src/visualizations/scenes.ts";

let checks = 0;
const test = (name, fn) => {
  fn();
  console.log(`ok ${++checks} - ${name}`);
};
const near = (a, b, tolerance = 1e-10) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
const localized = (text) => {
  assert.deepEqual(Object.keys(text).sort(), ["en", "zh-CN", "zh-TW"]);
  for (const value of Object.values(text)) assert.ok(value.trim().length > 0);
};

test("learning registry: valid graph edges, supported-only profiles, full path resolution and external metadata", () => {
  assert.equal(learningProfiles.length, 4);
  assert.equal(new Set(learningProfiles.map((p) => p.conceptId)).size, 4);
  for (const profile of learningProfiles) {
    for (const id of [
      profile.conceptId,
      ...profile.prerequisites,
      ...profile.nextConcepts,
    ])
      assert.ok(conceptById.has(id), id);
    assert.ok(profile.learningObjectives.length);
    profile.learningObjectives.forEach(localized);
    for (const stage of profile.sequence) {
      localized(stage.title);
      assert.ok(profile.visualizations.includes(stage.visualizationId));
      assert.ok(
        getVisualization(stage.visualizationId).steps.some(
          (s) => s.id === stage.stepId,
        ),
      );
    }
    for (const id of profile.visualizations)
      assert.ok(getVisualization(id).conceptIds.includes(profile.conceptId));
    for (const reference of profile.textbookReferences ?? []) {
      assert.equal(reference.rightsStatus, "external-reference");
      assert.equal(reference.language, "zh-CN");
      assert.equal(new URL(httpUrl(reference.url)).hostname, "github.com");
      assert.ok(reference.book && reference.section && reference.collection);
      assert.ok(reference.conceptIds.includes(profile.conceptId));
      assert.ok(!("content" in reference) && !("image" in reference));
    }
  }
  assert.equal(getLearningProfile("curl"), undefined);
  assert.equal(getLearningProfile("unknown"), undefined);
  assert.equal(getVisualization("unknown"), undefined);
});

test("visualization schema, three-language completeness, parameters, presets and valid equations", () => {
  assert.deepEqual(
    visualizationDefinitions.map((d) => d.steps.length),
    [10, 7, 7],
  );
  assert.equal(new Set(visualizationDefinitions.map((d) => d.id)).size, 3);
  Object.values(learningText).forEach(localized);
  for (const definition of visualizationDefinitions) {
    localized(definition.title);
    assert.equal(definition.renderer, "jsxgraph");
    assert.equal(definition.kind, "guided-lesson");
    assert.equal(
      new Set(definition.steps.map((s) => s.id)).size,
      definition.steps.length,
    );
    for (const p of definition.parameters) {
      localized(p.label);
      assert.ok(p.min <= p.initial && p.initial <= p.max && p.step > 0);
    }
    for (const preset of definition.presets) {
      localized(preset.title);
      for (const id of Object.keys(preset.parameters))
        assert.ok(definition.parameters.some((p) => p.id === id));
    }
    for (const step of definition.steps) {
      [step.title, step.explanation, step.invariant].forEach(localized);
      assert.ok(step.scene.stage >= 0 && step.scene.duration > 0);
      assert.ok(step.highlights.length);
      for (const control of step.controls)
        assert.ok(
          definition.parameters.some((p) => p.id === control.parameterId),
        );
      for (const equation of step.equations)
        assert.ok(
          katex
            .renderToString(equation, { strict: "error", trust: false })
            .includes("<math"),
        );
    }
  }
});

test("normal search concept IDs resolve all three lessons in EN / simplified / traditional", () => {
  for (const [id, queries] of [
    [
      "simple-harmonic-motion",
      ["simple harmonic motion", "简谐振动", "簡諧振動"],
    ],
    ["ellipse", ["ellipse", "椭圆", "橢圓"]],
    ["determinant", ["determinant", "行列式"]],
    [
      "linear-transformation",
      ["linear transformation", "线性变换", "線性變換"],
    ],
  ])
    for (const query of queries) {
      assert.deepEqual(parseAndExpand(query).concept_ids, [id]);
      assert.ok(getVisualization(getLearningProfile(id).visualizations[0]));
    }
});

test("historical aliases recognize queries without changing modern names or recall annotations", () => {
  assert.ok(historicalAliases.length >= 3 && historicalAliases.length <= 10);
  for (const alias of historicalAliases) {
    assert.equal(alias.status, "legacy");
    assert.ok(alias.source);
    assert.deepEqual(parseAndExpand(alias.text).concept_ids, [alias.conceptId]);
    assert.ok(
      ![
        conceptById.get(alias.conceptId).en,
        conceptById.get(alias.conceptId).zh_cn,
      ].includes(alias.text),
    );
    assert.ok(
      !annotateResource(alias.text, []).concept_ids.includes(alias.conceptId),
    );
  }
});

test("SHM restores toward equilibrium, has correct frequency and conserves energy", () => {
  for (const A of [0.2, 1.2, 2])
    for (const k of [0.5, 2, 8])
      for (const m of [0.5, 1, 4])
        for (let i = 0; i < 100; i++) {
          const s = shmState(A, k, m, (i * TAU) / 99);
          assert.ok(s.force * s.x <= 0);
          near(s.omega, Math.sqrt(k / m));
          near(s.acceleration, -(s.omega ** 2) * s.x);
          near(s.energy, 0.5 * k * A * A);
          near(s.period, TAU / s.omega);
        }
  const crossing = shmState(1.2, 2, 1, Math.PI / 2);
  near(crossing.force, 0);
  near(Math.abs(crossing.v), 1.2 * Math.sqrt(2));
  assert.throws(() => shmState(1, 0, 1, 0));
});

test("ellipse keeps its focal sum and geometric relation, including the circle limit", () => {
  for (const a of [1, 2, 4])
    for (const c of [0, a / 2, a - 0.1])
      for (let i = 0; i < 100; i++) {
        const e = ellipseState(a, c, (i * TAU) / 99);
        near(e.sum, 2 * a);
        near(e.b ** 2, a * a - c * c);
        near(e.point[0] ** 2 / a ** 2 + e.point[1] ** 2 / e.b ** 2, 1);
      }
  assert.throws(() => ellipseState(2, 2, 0));
  assert.throws(() => ellipseState(2, -1, 0));
  const d = getVisualization("guided-ellipse");
  const normalized = normalizeParameters(d, { a: 1, c: 3.9, theta: NaN });
  assert.ok(normalized.c >= 0 && normalized.c < normalized.a);
});

test("matrix basis, actual polygon area ratio, singular collapse and signed orientation", () => {
  for (const preset of getVisualization("guided-linear").presets) {
    const A = preset.parameters;
    assert.deepEqual(transform(A, [1, 0]), [A.a, A.c]);
    assert.deepEqual(transform(A, [0, 1]), [A.b, A.d]);
    const image = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ].map((p) => transform(A, p));
    near(orientedArea(image), determinant(A));
    near(Math.abs(orientedArea(image)), Math.abs(determinant(A)));
    assert.equal(
      orientation(determinant(A)),
      preset.id === "singular" ? 0 : preset.id === "reflection" ? -1 : 1,
    );
    if (preset.id === "singular") near(orientedArea(image), 0);
  }
});

test("pedagogical state machine: bounds, static snapshots, pause/resume, reset and reduced motion", () => {
  for (const d of visualizationDefinitions) {
    let s = initialLessonState(d);
    assert.equal(reduceLesson(d, s, { type: "seek", index: -1 }).stepIndex, 0);
    assert.equal(
      reduceLesson(d, s, { type: "play", reducedMotion: false }).status,
      "paused",
    );
    const moving = d.steps.findIndex((step) => step.scene.motion !== "none");
    s = reduceLesson(d, s, { type: "seek", index: moving });
    assert.equal(
      reduceLesson(d, s, { type: "play", reducedMotion: true }).status,
      "paused",
    );
    s = reduceLesson(d, s, { type: "play", reducedMotion: false });
    s = reduceLesson(d, s, { type: "tick", dt: 0.05 });
    assert.ok(s.elapsed > 0);
    s = reduceLesson(d, s, { type: "pause" });
    assert.equal(
      reduceLesson(d, s, { type: "tick", dt: 0.05 }).elapsed,
      s.elapsed,
    );
    const elapsed = s.elapsed;
    s = reduceLesson(d, s, { type: "play", reducedMotion: false });
    assert.equal(s.elapsed, elapsed);
    s = reduceLesson(d, s, {
      type: "parameters",
      values: { [d.parameters[0].id]: 999 },
    });
    assert.equal(s.status, "paused");
    assert.deepEqual(
      reduceLesson(d, s, { type: "restart" }),
      initialLessonState(d),
    );
    for (let index = 0; index < d.steps.length; index++) {
      s = reduceLesson(d, s, { type: "seek", index });
      const f = buildScene(d, s);
      assert.ok(f.primitives.length);
      assert.equal(
        new Set(f.primitives.map((p) => p.id)).size,
        f.primitives.length,
      );
      assert.ok(
        f.primitives.every((p) =>
          p.points.every((point) => point.every(Number.isFinite)),
        ),
      );
      assert.ok(f.readouts.every((r) => Number.isFinite(r.value)));
      for (const highlight of d.steps[index].highlights)
        assert.ok(
          f.primitives.some(
            (p) => p.id === highlight || p.id.startsWith(highlight + "-"),
          ),
          highlight,
        );
    }
  }
});

test("one-shot SHM stops at crossing and never advances the pedagogical step", () => {
  const d = getVisualization("guided-shm");
  let s = initialLessonState(d, 4);
  s = reduceLesson(d, s, { type: "play", reducedMotion: false });
  for (let i = 0; i < 100; i++)
    s = reduceLesson(d, s, { type: "tick", dt: 0.08 });
  assert.equal(s.status, "completed");
  assert.equal(s.stepIndex, 4);
  near(s.elapsed, lessonDuration(d, s));
  near(buildScene(d, s).readouts.find((r) => r.label === "F").value, 0);
});

test("ellipse trace records numeric visited points and clears on geometry changes", () => {
  const d = getVisualization("guided-ellipse");
  let s = initialLessonState(d, 3);
  s = reduceLesson(d, s, { type: "parameters", values: { theta: 1 } });
  s = reduceLesson(d, s, { type: "parameters", values: { theta: 2 } });
  assert.ok(s.trace.length >= 2);
  for (const [x, y] of s.trace)
    near(
      Math.hypot(x + s.parameters.c, y) + Math.hypot(x - s.parameters.c, y),
      2 * s.parameters.a,
    );
  s = reduceLesson(d, s, { type: "parameters", values: { a: 2 } });
  assert.equal(s.trace.length, 1);
});

test("transformation scrubbing uses displayed B, with correct intermediate area and target A", () => {
  const d = getVisualization("guided-linear");
  let s = initialLessonState(d, 2);
  s = reduceLesson(d, s, {
    type: "parameters",
    values: { a: -1, b: 0, c: 0, d: 1, blend: 0.5 },
  });
  near(determinant(currentMatrix(d, s)), 0);
  const frame = buildScene(d, s);
  near(orientedArea(frame.primitives.find((p) => p.id === "image").points), 0);
  s = reduceLesson(d, s, { type: "parameters", values: { blend: 1 } });
  near(determinant(currentMatrix(d, s)), -1);
});

test("renderer boundary excludes remote code and fails closed on expression strings", () => {
  const shim = readFileSync(
    "src/visualizations/renderers/DisabledJessieCode.ts",
    "utf8",
  );
  assert.ok(
    shim.includes("snippet(): never") && shim.includes("parse(): never"),
  );
  const renderer = readFileSync(
    "src/visualizations/renderers/JSXGraphRenderer.tsx",
    "utf8",
  );
  assert.ok(
    renderer.includes('display: "internal"') && renderer.includes("freeBoard"),
  );
  assert.ok(!/\beval\(|new Function\(|dangerouslySetInnerHTML/.test(renderer));
});
console.log(`LEARNING TESTS: ${checks} groups passed`);
