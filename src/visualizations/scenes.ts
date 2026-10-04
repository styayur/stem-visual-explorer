import {
  clamp,
  determinant,
  ellipseState,
  interpolateMatrix,
  shmState,
  TAU,
  transform,
  type Matrix2,
} from "./math.ts";
import {
  ellipseTheta,
  lessonDuration,
  type LessonState,
} from "./stateMachine.ts";
import type {
  GuidedVisualizationDefinition,
  SceneFrame,
  ScenePrimitive,
  Vec2,
} from "./types";

const primitive = (
  id: string,
  kind: ScenePrimitive["kind"],
  points: Vec2[],
  color: ScenePrimitive["color"],
  visible = true,
  label?: string,
  extras: Partial<ScenePrimitive> = {},
): ScenePrimitive => ({ id, kind, points, color, visible, label, ...extras });
const curve = (
  fn: (t: number) => Vec2,
  from: number,
  to: number,
  count = 120,
) =>
  Array.from({ length: count + 1 }, (_, i) =>
    fn(from + ((to - from) * i) / count),
  );
const rect = (x: number, y: number, w: number, h: number): Vec2[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

function shmFrame(
  definition: GuidedVisualizationDefinition,
  state: LessonState,
): SceneFrame {
  const n = definition.steps[state.stepIndex].scene.stage,
    p = state.parameters;
  const omega = Math.sqrt(p.k / p.m);
  const phase =
    n === 0
      ? 0
      : n <= 3
        ? 0
        : n === 5
          ? Math.PI / 2
          : n === 6
            ? Math.PI
            : omega * state.elapsed + (n >= 8 ? p.phi : 0);
  const s = shmState(n === 0 ? 0 : p.A, p.k, p.m, phase);
  // Force and velocity arrows use explicitly labeled display scales to stay legible.
  const forceLength = (s.force / p.k) * 0.6,
    velocityLength = (s.v / omega) * 0.6;
  const spring = curve(
    (t) => [
      -3.8 + (s.x - 0.25 + 3.8) * t,
      t < 0.06 || t > 0.94 ? 1 : 1 + 0.13 * Math.sin(t * 20 * Math.PI),
    ],
    0,
    1,
    180,
  );
  const plot = curve(
    (t) => [
      (t / s.period) * 4 - 2,
      -2.3 + p.A * Math.cos(omega * t + (n >= 8 ? p.phi : 0)) * 0.45,
    ],
    0,
    s.period,
  );
  const at = n === 5 ? 0.25 : n === 6 ? 0.5 : (state.elapsed / s.period) % 1;
  const total = 0.5 * p.k * p.A ** 2;
  const primitives: ScenePrimitive[] = [
    primitive(
      "wall",
      "path",
      [
        [-3.8, 0.4],
        [-3.8, 1.6],
      ],
      "ink",
    ),
    primitive(
      "floor",
      "path",
      [
        [-4, 0.65],
        [3, 0.65],
      ],
      "muted",
    ),
    primitive(
      "equilibrium",
      "path",
      [
        [0, 0.5],
        [0, 1.6],
      ],
      "muted",
      true,
      undefined,
      { dashed: true },
    ),
    primitive("origin", "point", [[0, 0.35]], "muted", true, "x = 0"),
    primitive("spring", "path", spring, "ink"),
    primitive(
      "mass-shape",
      "polygon",
      rect(s.x - 0.25, 0.75, 0.5, 0.5),
      "position",
    ),
    primitive(
      "mass",
      "point",
      [[s.x, 1]],
      "position",
      true,
      "m",
      n >= 1 && n <= 3 ? { draggable: "mass" } : {},
    ),
    primitive(
      "displacement",
      "arrow",
      [
        [0, 0.05],
        [s.x, 0.05],
      ],
      "position",
      n > 0 && Math.abs(s.x) > 1e-6,
      "x",
    ),
    primitive(
      "force",
      "arrow",
      [
        [s.x, 1.7],
        [s.x + forceLength, 1.7],
      ],
      "force",
      n >= 2 && Math.abs(s.force) > 1e-6,
      "F",
    ),
    primitive(
      "acceleration",
      "arrow",
      [
        [s.x, 2.25],
        [s.x + forceLength, 2.25],
      ],
      "force",
      n === 3,
      "a",
    ),
    primitive(
      "velocity",
      "arrow",
      [
        [s.x, 2.25],
        [s.x + velocityLength, 2.25],
      ],
      "velocity",
      n >= 4 && Math.abs(s.v) > 1e-6,
      "v",
    ),
    primitive(
      "plot-axis",
      "path",
      [
        [-2, -2.3],
        [2, -2.3],
      ],
      "muted",
      n >= 4,
    ),
    primitive("plot-zero", "point", [[-2, -3.45]], "muted", n >= 4, "0"),
    primitive("plot-end", "point", [[2, -3.45]], "muted", n >= 4, "T"),
    primitive("plot", "path", plot, "position", n >= 4),
    primitive(
      "plot-marker",
      "point",
      [[at * 4 - 2, -2.3 + s.x * 0.45]],
      "force",
      n >= 4,
      "x(t)",
    ),
    primitive(
      "kinetic",
      "polygon",
      rect(3.05, -3.2, 0.24, (2 * s.kinetic) / total),
      "velocity",
      n === 9,
    ),
    primitive(
      "potential",
      "polygon",
      rect(3.6, -3.2, 0.24, (2 * s.potential) / total),
      "force",
      n === 9,
    ),
    primitive(
      "total",
      "polygon",
      rect(4.15, -3.2, 0.24, 2),
      "position",
      n === 9,
    ),
    ...["K", "U", "E"].map((label, i) =>
      primitive(
        `energy-label-${i}`,
        "point",
        [[3.12 + i * 0.55, -3.5]],
        "ink",
        n === 9,
        label,
      ),
    ),
  ];
  return {
    bounds: [-4.3, 3.1, 4.8, -4.2],
    primitives,
    readouts: [
      { label: "x", value: s.x, unit: "m" },
      { label: "v", value: s.v, unit: "m/s" },
      { label: "F", value: s.force, unit: "N" },
      { label: "a", value: s.acceleration, unit: "m/s²" },
      { label: "ω", value: s.omega, unit: "rad/s" },
      { label: "T", value: s.period, unit: "s" },
      ...(n === 9
        ? [
            { label: "K", value: s.kinetic, unit: "J" },
            { label: "U", value: s.potential, unit: "J" },
            { label: "E", value: s.energy, unit: "J" },
          ]
        : []),
    ],
  };
}
function ellipseFrame(
  definition: GuidedVisualizationDefinition,
  state: LessonState,
): SceneFrame {
  const n = definition.steps[state.stepIndex].scene.stage,
    { a, c } = state.parameters;
  const theta =
    n === 5
      ? Math.PI / 2
      : ellipseTheta(state, lessonDuration(definition, state));
  const e = ellipseState(a, c, theta),
    top: Vec2 = [0, e.b];
  const locus =
    n === 3
      ? state.trace.length > 1
        ? state.trace
        : [e.point, e.point]
      : curve((t) => ellipseState(a, c, t).point, 0, TAU);
  const extent = a + 0.7;
  return {
    bounds: [-extent, extent, extent, -extent],
    primitives: [
      primitive(
        "axis-x",
        "path",
        [
          [-4.5, 0],
          [4.5, 0],
        ],
        "muted",
      ),
      primitive(
        "axis-y",
        "path",
        [
          [0, -4.5],
          [0, 4.5],
        ],
        "muted",
      ),
      primitive("f1", "point", [[-c, 0]], "force", true, "F₁"),
      primitive("f2", "point", [[c, 0]], "force", true, "F₂"),
      primitive("locus", "path", locus, "position", n >= 3),
      primitive("r1", "path", [[-c, 0], e.point], "force", n >= 1),
      primitive("r2", "path", [[c, 0], e.point], "velocity", n >= 1),
      primitive(
        "p",
        "point",
        [e.point],
        "position",
        n >= 1,
        "P",
        n !== 5 ? { draggable: "ellipse-point" } : {},
      ),
      primitive(
        "axis-a",
        "arrow",
        [
          [0, 0],
          [a, 0],
        ],
        "position",
        n >= 4,
        "a",
      ),
      primitive("axis-b", "arrow", [[0, 0], top], "velocity", n >= 4, "b"),
      primitive(
        "axis-c",
        "arrow",
        [
          [0, -0.35],
          [c, -0.35],
        ],
        "force",
        n >= 4 && c > 0,
        "c",
      ),
      primitive(
        "triangle",
        "path",
        [[0, 0], [c, 0], top, [0, 0]],
        "ink",
        n === 5,
      ),
    ],
    readouts: [
      { label: "a", value: a },
      { label: "b", value: e.b },
      { label: "c", value: c },
      ...(n >= 1
        ? [
            { label: "PF₁", value: e.r1 },
            { label: "PF₂", value: e.r2 },
            { label: "PF₁ + PF₂", value: e.sum },
          ]
        : []),
      ...(n === 6
        ? [
            {
              label: "x²/a² + y²/b²",
              value: e.point[0] ** 2 / a ** 2 + e.point[1] ** 2 / e.b ** 2,
            },
          ]
        : []),
    ],
  };
}
export function currentMatrix(
  definition: GuidedVisualizationDefinition,
  state: LessonState,
): Matrix2 {
  const n = definition.steps[state.stepIndex].scene.stage;
  const A = state.parameters as unknown as Matrix2;
  if (n === 0) return { a: 1, b: 0, c: 0, d: 1 };
  const s =
    n === 2 || n === 6
      ? state.status === "playing" || state.elapsed > 0
        ? clamp(state.elapsed / lessonDuration(definition, state), 0, 1)
        : state.parameters.blend
      : 1;
  return interpolateMatrix(A, s);
}
function linearFrame(
  definition: GuidedVisualizationDefinition,
  state: LessonState,
): SceneFrame {
  const n = definition.steps[state.stepIndex].scene.stage,
    B = currentMatrix(definition, state);
  const e1 = transform(B, [1, 0]),
    e2 = transform(B, [0, 1]);
  const square: Vec2[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const image = square.map((p) => transform(B, p));
  const grid: ScenePrimitive[] = [];
  for (let i = -3; i <= 3; i++)
    for (const vertical of [true, false]) {
      const line: Vec2[] = vertical
        ? [
            [i, -3],
            [i, 3],
          ]
        : [
            [-3, i],
            [3, i],
          ];
      grid.push(
        primitive(
          `original-grid-${i}-${vertical}`,
          "path",
          line,
          "muted",
          true,
          undefined,
          { dashed: true },
        ),
      );
      grid.push(
        primitive(
          `grid-${i}-${vertical}`,
          "path",
          line.map((p) => transform(B, p)),
          "position",
          n >= 2,
        ),
      );
    }
  const extent = Math.max(
    3.7,
    Math.abs(B.a) + Math.abs(B.b) + 1.2,
    Math.abs(B.c) + Math.abs(B.d) + 1.2,
  );
  return {
    bounds: [-extent, extent, extent, -extent],
    primitives: [
      ...grid,
      primitive("square", "polygon", square, "muted"),
      primitive("image", "polygon", image, "position", n >= 3),
      primitive(
        "e1",
        "arrow",
        [[0, 0], e1],
        "force",
        true,
        n === 0 ? "e₁" : n === 2 || n === 6 ? "Be₁" : "Ae₁",
      ),
      primitive(
        "e2",
        "arrow",
        [[0, 0], e2],
        "velocity",
        true,
        n === 0 ? "e₂" : n === 2 || n === 6 ? "Be₂" : "Ae₂",
      ),
      ...image.map((p, i) =>
        primitive(`corner${i}`, "point", [p], "ink", n >= 5, String(i)),
      ),
    ],
    readouts: [
      {
        label: "det(A)",
        value: determinant(state.parameters as unknown as Matrix2),
      },
      { label: "det(B)", value: determinant(B) },
      { label: "|det(B)|", value: Math.abs(determinant(B)) },
    ],
  };
}
export function buildScene(
  definition: GuidedVisualizationDefinition,
  state: LessonState,
): SceneFrame {
  switch (definition.steps[state.stepIndex].scene.family) {
    case "shm":
      return shmFrame(definition, state);
    case "ellipse":
      return ellipseFrame(definition, state);
    case "linear":
      return linearFrame(definition, state);
  }
}
