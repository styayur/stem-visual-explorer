import type { UiLocale } from "../../lib/types";
import type { SceneFrame, ScenePrimitive } from "../types";
import JSXGraphRenderer from "./JSXGraphRenderer";

export interface VisualizationRendererProps {
  renderer: "jsxgraph";
  frame: SceneFrame;
  highlights: string[];
  description: string;
  locale: UiLocale;
  dark: boolean;
  onDrag: (
    kind: NonNullable<ScenePrimitive["draggable"]>,
    x: number,
    y: number,
  ) => void;
}
// Only this boundary selects an implementation. Lessons and their numeric models
// never import the drawing library or receive a board instance.
export default function VisualizationRenderer(
  props: VisualizationRendererProps,
) {
  switch (props.renderer) {
    case "jsxgraph":
      return <JSXGraphRenderer {...props} />;
  }
}
