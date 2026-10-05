import { L } from "../learning/types.ts";
import type { GuidedVisualizationDefinition } from "./types";
export const visualizationCatalog = [
  {
    id: "guided-shm",
    conceptIds: ["simple-harmonic-motion"],
    title: L("Guided SHM Explorer", "简谐振动引导探索", "簡諧振動引導探索"),
  },
  {
    id: "guided-ellipse",
    conceptIds: ["ellipse"],
    title: L(
      "Ellipse: definition to equation",
      "椭圆：从定义到方程",
      "橢圓：從定義到方程",
    ),
  },
  {
    id: "guided-linear",
    conceptIds: ["linear-transformation", "determinant"],
    title: L(
      "Linear transformation & determinant",
      "线性变换与行列式",
      "線性變換與行列式",
    ),
  },
] as const;
const loaders: Record<string, () => Promise<GuidedVisualizationDefinition>> = {
  "guided-shm": () => import("./lessons/shm.ts").then((m) => m.guidedShm),
  "guided-ellipse": () =>
    import("./lessons/ellipse.ts").then((m) => m.guidedEllipse),
  "guided-linear": () =>
    import("./lessons/linear.ts").then((m) => m.guidedLinear),
};
export function loadVisualization(id: string) {
  if (!Object.prototype.hasOwnProperty.call(loaders, id))
    return Promise.reject(new Error("Unknown visualization ID"));
  return loaders[id]();
}
