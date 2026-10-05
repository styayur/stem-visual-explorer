import type { LocalizedText } from "../../learning/types";
import type { GuidedStep, SceneFamily, VisualizationParameter } from "../types";
export const step = (
  family: SceneFamily,
  stage: number,
  id: string,
  title: LocalizedText,
  explanation: LocalizedText,
  invariant: LocalizedText,
  equations: string[],
  controls: string[],
  highlights: string[],
  motion: "none" | "once" | "loop" = "none",
  duration = 4,
): GuidedStep => ({
  id,
  title,
  explanation,
  invariant,
  equations,
  controls: controls.map((parameterId) => ({ parameterId })),
  highlights,
  scene: { family, stage, motion, duration },
});
export const parameter = (
  id: string,
  label: LocalizedText,
  min: number,
  max: number,
  initial: number,
  unit?: string,
  increment = 0.1,
): VisualizationParameter => ({
  id,
  label,
  min,
  max,
  initial,
  unit,
  step: increment,
});
