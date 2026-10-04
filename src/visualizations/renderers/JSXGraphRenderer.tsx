import { useEffect, useId, useRef } from "react";
import JXG from "./numericCore";
import type JSXGraph from "jsxgraph";
import type { VisualizationRendererProps } from "./VisualizationRenderer";

export default function JSXGraphRenderer(props: VisualizationRendererProps) {
  const id = `sve-board-${useId().replace(/:/g, "")}`;
  const live = useRef(props);
  live.current = props;
  const board = useRef<JSXGraph.Board | null>(null);
  const points = useRef(new Map<string, JSXGraph.Point>());
  const structure = props.frame.primitives
    .map(
      (p) =>
        `${p.id}:${p.kind}:${p.points.length === 4 && p.kind === "polygon" ? "4" : "dynamic"}`,
    )
    .join("|");

  useEffect(() => {
    const colors = props.dark
      ? {
          ink: "#e4e4e7",
          muted: "#71717a",
          position: "#a5b4fc",
          force: "#fda4af",
          velocity: "#5eead4",
        }
      : {
          ink: "#27272a",
          muted: "#71717a",
          position: "#4338ca",
          force: "#be123c",
          velocity: "#0f766e",
        };
    // JSXGraph's published types omit its documented keyboard option.
    const options: Partial<JSXGraph.BoardAttributes> & {
      keyboard: { enabled: boolean };
    } = {
      boundingbox: props.frame.bounds,
      keepaspectratio: true,
      axis: false,
      renderer: "svg",
      showNavigation: false,
      showCopyright: false,
      pan: { enabled: false },
      zoom: {
        wheel: false,
        pinchHorizontal: false,
        pinchVertical: false,
        pinchSensitivity: 0,
      },
      resize: { enabled: true, throttle: 100 },
      keyboard: { enabled: false },
    };
    const b = JXG.JSXGraph.initBoard(id, options);
    board.current = b;
    b.suspendUpdate();
    for (const original of props.frame.primitives) {
      const current = () =>
        live.current.frame.primitives.find((p) => p.id === original.id)!;
      const emphasized = () =>
        live.current.highlights.some(
          (h) => original.id === h || original.id.startsWith(`${h}-`),
        );
      const attrs = {
        strokeColor: colors[original.color],
        fillColor: colors[original.color],
        strokeWidth: () => (emphasized() ? 3 : 1.5),
        visible: () => current().visible,
        fixed: true,
        highlight: false,
        withLabel: false,
        name: "",
        dash: original.dashed ? 2 : 0,
      };
      if (original.kind === "point") {
        const point = b.create("point", original.points[0], {
          ...attrs,
          size: 3,
          fixed: () => !current().draggable,
        }) as JSXGraph.Point;
        points.current.set(original.id, point);
        point.rendNode.setAttribute("data-scene-id", original.id);
        // User input is numeric; no JessieCode, expression strings, HTML labels or remote code.
        point.on("drag", () => {
          const kind = current().draggable;
          if (kind) live.current.onDrag(kind, point.X(), point.Y());
        });
      } else if (original.kind === "polygon") {
        b.create(
          "polygon",
          original.points.map((_, i) => [
            () => current().points[i][0],
            () => current().points[i][1],
          ]),
          {
            ...attrs,
            fillOpacity: 0.18,
            borders: attrs,
            vertices: { visible: false, fixed: true, withLabel: false },
          },
        );
      } else {
        const xs = () => current().points.map((p) => p[0]),
          ys = () => current().points.map((p) => p[1]);
        // A numeric data curve also represents arrows, avoiding generated expressions.
        const line = b.create("curve", [[], []], {
          ...attrs,
          fillOpacity: 0,
          lastArrow: original.kind === "arrow",
        }) as JSXGraph.Curve;
        line.updateDataArray = () => {
          line.dataX = xs();
          line.dataY = ys();
        };
      }
      if (original.label) {
        b.create(
          "text",
          [
            () => current().points[current().points.length - 1][0] + 0.12,
            () =>
              current().points[current().points.length - 1][1] +
              (original.id.startsWith("corner") ? -0.24 : 0.16),
            () => current().label ?? "",
          ],
          {
            ...attrs,
            display: "internal",
            parse: false,
            fontSize: 14,
            strokeColor: colors.ink,
          },
        );
      }
    }
    b.unsuspendUpdate();
    return () => {
      board.current = null;
      points.current.clear();
      JXG.JSXGraph.freeBoard(b);
    };
  }, [id, structure, props.dark]);

  const lastBounds = useRef<string>("");
  useEffect(() => {
    const b = board.current;
    if (!b) return;
    b.suspendUpdate();
    for (const primitive of props.frame.primitives)
      points.current
        .get(primitive.id)
        ?.setPosition(JXG.COORDS_BY_USER, primitive.points[0]);
    const bounds = props.frame.bounds.join(",");
    if (bounds !== lastBounds.current) {
      b.setBoundingBox(props.frame.bounds, true);
      lastBounds.current = bounds;
    }
    b.unsuspendUpdate();
  }, [props.frame, props.highlights, props.dark]);

  return (
    <div
      className="visual-board"
      id={id}
      data-testid="visual-board"
      role="img"
      aria-label={props.description}
    />
  );
}
