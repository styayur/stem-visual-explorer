import { clamp, ellipseState, TAU } from "./math.ts";
import type { GuidedVisualizationDefinition, Vec2 } from "./types";

export interface LessonState {
  stepIndex: number;
  status: "paused" | "playing" | "completed";
  elapsed: number;
  parameters: Record<string, number>;
  trace: Vec2[];
}
export type LessonAction =
  | { type: "seek"; index: number }
  | { type: "play"; reducedMotion: boolean }
  | { type: "pause" }
  | { type: "restart" }
  | { type: "tick"; dt: number }
  | { type: "parameters"; values: Record<string, number> };

export function normalizeParameters(
  definition: GuidedVisualizationDefinition,
  values: Record<string, number>,
) {
  const parameters: Record<string, number> = {};
  for (const parameter of definition.parameters) {
    const value = values[parameter.id];
    parameters[parameter.id] = clamp(
      Number.isFinite(value) ? value : parameter.initial,
      parameter.min,
      parameter.max,
    );
  }
  if (definition.steps[0].scene.family === "ellipse")
    parameters.c = Math.min(parameters.c, parameters.a - 0.1);
  return parameters;
}
export function initialLessonState(
  definition: GuidedVisualizationDefinition,
  stepIndex = 0,
): LessonState {
  return {
    stepIndex: clamp(stepIndex, 0, definition.steps.length - 1),
    status: "paused",
    elapsed: 0,
    parameters: normalizeParameters(definition, {}),
    trace: [],
  };
}
export function lessonDuration(
  definition: GuidedVisualizationDefinition,
  state: LessonState,
) {
  const scene = definition.steps[state.stepIndex].scene;
  if (scene.family === "shm")
    return (
      (scene.stage === 4 ? Math.PI / 2 : TAU) /
      Math.sqrt(state.parameters.k / state.parameters.m)
    );
  return scene.duration;
}
export function ellipseTheta(state: LessonState, duration: number) {
  return state.parameters.theta + (state.elapsed / duration) * TAU;
}
function appendTrace(
  state: LessonState,
  definition: GuidedVisualizationDefinition,
): LessonState {
  if (
    definition.steps[state.stepIndex].scene.family !== "ellipse" ||
    definition.steps[state.stepIndex].scene.stage !== 3
  )
    return state;
  const p = ellipseState(
    state.parameters.a,
    state.parameters.c,
    ellipseTheta(state, lessonDuration(definition, state)),
  ).point;
  const last = state.trace[state.trace.length - 1];
  if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.025) return state;
  return { ...state, trace: [...state.trace.slice(-599), p] };
}
export function reduceLesson(
  definition: GuidedVisualizationDefinition,
  state: LessonState,
  action: LessonAction,
): LessonState {
  switch (action.type) {
    case "restart":
      return initialLessonState(definition);
    case "seek":
      return {
        ...state,
        stepIndex: clamp(action.index, 0, definition.steps.length - 1),
        elapsed: 0,
        status: "paused",
        trace: [],
      };
    case "pause":
      return { ...state, status: "paused" };
    case "play":
      if (
        action.reducedMotion ||
        definition.steps[state.stepIndex].scene.motion === "none"
      )
        return state;
      return {
        ...state,
        status: "playing",
        elapsed: state.status === "completed" ? 0 : state.elapsed,
      };
    case "parameters": {
      const parameters = normalizeParameters(definition, {
        ...state.parameters,
        ...action.values,
      });
      const geometryChanged =
        parameters.a !== state.parameters.a ||
        parameters.c !== state.parameters.c;
      return appendTrace(
        {
          ...state,
          parameters,
          status: "paused",
          elapsed: 0,
          trace: geometryChanged ? [] : state.trace,
        },
        definition,
      );
    }
    case "tick": {
      if (
        state.status !== "playing" ||
        !Number.isFinite(action.dt) ||
        action.dt <= 0
      )
        return state;
      const duration = lessonDuration(definition, state);
      const elapsed = state.elapsed + Math.min(action.dt, 0.08);
      const once = definition.steps[state.stepIndex].scene.motion === "once";
      return appendTrace(
        {
          ...state,
          elapsed: once ? Math.min(elapsed, duration) : elapsed % duration,
          status: once && elapsed >= duration ? "completed" : "playing",
        },
        definition,
      );
    }
  }
}
