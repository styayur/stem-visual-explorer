import type { LocalizedText } from "../learning/types";

export type VisualizationKind = "guided-lesson" | "sandbox";
export type SceneFamily = "shm" | "ellipse" | "linear";
export interface SceneDefinition {
  family: SceneFamily;
  stage: number;
  motion: "none" | "once" | "loop";
  duration: number;
}
export interface ControlDefinition {
  parameterId: string;
}
export interface GuidedStep {
  id: string;
  conceptId?: string;
  title: LocalizedText;
  explanation: LocalizedText;
  equations: string[];
  invariant: LocalizedText;
  scene: SceneDefinition;
  controls: ControlDefinition[];
  highlights: string[];
  misconception?: LocalizedText;
  observation?: LocalizedText;
  cause?: LocalizedText;
  consequence?: LocalizedText;
}
export interface LessonContext {
  definition: GuidedVisualizationDefinition;
  step: GuidedStep;
  stepIndex: number;
  parameters: Record<string, number>;
  status: "paused" | "playing" | "completed";
  canPlay: boolean;
  actions: { previous: () => void; next: () => void; play: () => void; pause: () => void; restart: () => void };
}
export interface VisualizationParameter {
  id: string;
  label: LocalizedText;
  min: number;
  max: number;
  step: number;
  initial: number;
  unit?: string;
}
export interface VisualizationPreset {
  id: string;
  title: LocalizedText;
  parameters: Record<string, number>;
}
export interface GuidedVisualizationDefinition {
  id: string;
  title: LocalizedText;
  conceptIds: string[];
  renderer: "jsxgraph";
  kind: VisualizationKind;
  steps: GuidedStep[];
  parameters: VisualizationParameter[];
  presets: VisualizationPreset[];
}
export type Vec2 = [number, number];
export interface ScenePrimitive {
  id: string;
  kind: "point" | "path" | "polygon" | "arrow";
  points: Vec2[];
  label?: string;
  color: "ink" | "muted" | "position" | "force" | "velocity";
  visible: boolean;
  draggable?: "mass" | "ellipse-point";
  dashed?: boolean;
}
export interface SceneFrame {
  bounds: [number, number, number, number];
  primitives: ScenePrimitive[];
  readouts: { label: string; value: number; unit?: string }[];
}
