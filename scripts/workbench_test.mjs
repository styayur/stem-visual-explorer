import assert from "node:assert/strict";
import {
  openConcept,
  visitTrail,
  switchSurface,
  restoreSession,
  TRAIL_LIMIT,
} from "../src/workbench/conceptSession.ts";
import { resourcesForConcept } from "../src/workbench/resourceResolver.ts";
import {
  capabilitiesForConcept,
  groupCapabilities,
} from "../src/capabilities/registry.ts";
import { curriculumSources } from "../src/learning/curriculum.ts";
import { projectGraph } from "../src/workbench/graph.ts";
import {
  loadVisualization,
  visualizationCatalog,
} from "../src/visualizations/registry.ts";
import { registeredCommands } from "../src/commands/commandRegistry.ts";
import { universalObjects } from "../src/capabilities/universalSearch.ts";
import { availableSurfaces } from "../src/workbench/surfaces.ts";
import { forbiddenExecution } from "./visual_bundle_security.mjs";

let session = openConcept(null, "simple-harmonic-motion", {
  type: "search",
  query: "简谐振动",
});
session = switchSurface(session, "learn");
session = {
  ...session,
  selectedVisualizationId: "guided-shm",
  selectedLearningStepId: "release",
};
session = openConcept(session, "resonance", {
  type: "concept-link",
  sourceConceptId: session.conceptId,
});
assert.equal(session.conceptId, "resonance");
assert.equal(session.selectedVisualizationId, undefined);
assert.deepEqual(
  session.trail.map((e) => e.conceptId),
  ["simple-harmonic-motion", "resonance"],
);
assert.equal(visitTrail(session, 0).activeSurface, "learn");
assert.equal(visitTrail(session, 0).selectedLearningStepId, undefined);
assert.equal(visitTrail(session, 99), session);
assert.equal(openConcept(visitTrail(session, 0), "ellipse").trail.length, 2);
for (let i = 0; i < 100; i++)
  session = openConcept(session, i % 2 ? "ellipse" : "resonance");
assert.equal(session.trail.length, TRAIL_LIMIT);
assert.equal(
  restoreSession({
    trail: [{ conceptId: "evil", surface: "overview" }],
    cursor: 0,
  }),
  null,
);
assert.equal(restoreSession({ ...session, cursor: -1 }), null);
assert.equal(
  restoreSession({
    trail: [{ conceptId: "resonance", surface: "visualize" }],
    cursor: 0,
  }).activeSurface,
  "overview",
);
assert.equal(
  restoreSession(JSON.parse(JSON.stringify(session))).conceptId,
  session.conceptId,
);
assert.throws(() => openConcept(null, "unknown"));
const provider = {
  source_id: "fixture",
  source_name: "Fixture",
  entries: [
    {
      title: "SHM",
      url: "https://example.com/shm",
      concept_ids: ["simple-harmonic-motion"],
      result_type: "simulation",
      tags: [],
      description: null,
    },
    {
      title: "Resonance",
      url: "https://example.com/resonance",
      concept_ids: ["resonance"],
      result_type: "article",
      tags: [],
      description: null,
    },
  ],
};
assert.deepEqual(
  resourcesForConcept("resonance", [provider]).map((r) => r.title),
  ["Resonance"],
);
assert.equal(resourcesForConcept("ellipse", [provider]).length, 0);
const shm = capabilitiesForConcept(
  "simple-harmonic-motion",
  resourcesForConcept("simple-harmonic-motion", [provider]),
);
assert.deepEqual(
  groupCapabilities(shm).map((g) => g.group),
  ["learn", "read", "explore"],
);
assert.equal(shm.filter((c) => c.type === "textbook").length, 4);
assert.equal(shm.find((c) => c.resource).provenance.rightsStatus, "unknown");
assert.equal(capabilitiesForConcept("curl").length, 0);
assert.equal(
  capabilitiesForConcept(
    "resonance",
    resourcesForConcept("resonance", [provider]),
  ).length,
  1,
);
assert.equal(capabilitiesForConcept("determinant").length, 1);
assert.equal(curriculumSources[0].resolveConcept("ellipse").length, 3);
assert.equal(curriculumSources[0].resolveConcept("curl").length, 0);
assert.ok(projectGraph("simple-harmonic-motion", 4).length <= 4);
assert.equal(projectGraph("unknown").length, 0);
for (const v of visualizationCatalog) {
  const d = await loadVisualization(v.id);
  assert.equal(d.id, v.id);
  assert.deepEqual(d.conceptIds, [...v.conceptIds]);
}
for (const v of visualizationCatalog) {
  const d = await loadVisualization(v.id);
  assert.ok(d.steps.some((s) => s.misconception));
  for (const s of d.steps)
    for (const field of [
      "misconception",
      "observation",
      "cause",
      "consequence",
    ])
      if (s[field]) {
        assert.deepEqual(Object.keys(s[field]).sort(), [
          "en",
          "zh-CN",
          "zh-TW",
        ]);
        assert.ok(Object.values(s[field]).every((v) => v.trim()));
      }
}
await assert.rejects(loadVisualization("constructor"));
let ran = "";
const context = {
  conceptId: "simple-harmonic-motion",
  locale: "en",
  surface: (s) => {
    ran = s;
  },
  navigate: () => {},
  focusSearch: () => {},
  copy: () => {},
};
const commands = registeredCommands(context);
commands.find((c) => c.id === "surface:visualize").run();
assert.equal(ran, "visualize");
assert.ok(commands.some((c) => c.id === "concept:resonance"));
assert.ok(
  !registeredCommands({ ...context, conceptId: "resonance" }).some(
    (c) => c.id === "surface:visualize",
  ),
);
assert.equal(
  registeredCommands({ ...context, conceptId: undefined }).length,
  1,
);
const def = await loadVisualization("guided-shm");
const actions = {
  previous: () => {},
  next: () => {},
  play: () => {},
  pause: () => {},
  restart: () => {},
};
const lesson = {
  definition: def,
  step: def.steps[0],
  stepIndex: 0,
  parameters: {},
  status: "paused",
  canPlay: false,
  actions,
};
assert.ok(
  !registeredCommands({ ...context, lesson }).some((c) =>
    ["lesson:play", "lesson:pause", "lesson:previous"].includes(c.id),
  ),
);
assert.ok(
  registeredCommands({
    ...context,
    lesson: { ...lesson, stepIndex: 4, step: def.steps[4], canPlay: true },
  }).some((c) => c.id === "lesson:play"),
);
assert.ok(!availableSurfaces("curl").includes("visualize"));
assert.ok(universalObjects("简谐振动", "en").some((e) => e.group === "lesson"));
assert.equal(
  universalObjects("ellipse", "zh-TW").filter((e) => e.group === "textbook")
    .length,
  3,
);
assert.equal(universalObjects("no-such-query", "en").length, 0);
const sharedObjects = universalObjects(
  "linear transformation determinant",
  "en",
);
assert.equal(sharedObjects.filter((e) => e.id === "guided-linear").length, 1);
assert.equal(
  new Set(sharedObjects.map((e) => e.id)).size,
  sharedObjects.length,
);
assert.deepEqual(
  forbiddenExecution(
    "const explanation='eval( and new Function('; // eval()\nfunction harmless(){}",
  ),
  [],
);
for (const source of [
  "eval('x')",
  "new Function('x')",
  "(0, eval)('x')",
  "globalThis['eval']('x')",
  "window.eval.call(null,'x')",
])
  assert.equal(forbiddenExecution(source).length, 1);
process.stdout.write(
  "WORKBENCH: session, bounded trail, safe restoration, direct resource isolation, capabilities, curriculum, graph and lesson loaders PASS\n",
);
