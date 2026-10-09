import { L } from "./types.ts";
import type { ConceptLearningProfile } from "./types";
import { shmReferences, ellipseReferences } from "./textbooks.ts";

// Lightweight path metadata is independent of the lazy-loaded lesson definitions.
const path = (
  visualizationId: string,
  entries: [string, string, string, string][],
) =>
  entries.map(([id, en, cn, tw]) => ({
    id,
    title: L(en, cn, tw),
    visualizationId,
    stepId: id,
  }));
const linearPath = path("guided-linear", [
  ["identity", "Identity", "恒等变换", "恆等變換"],
  ["basis", "Basis images", "基向量的像", "基向量的像"],
  ["grid", "Transform the grid", "变换网格", "變換網格"],
  ["parallelogram", "Parallelogram", "平行四边形", "平行四邊形"],
  ["area", "Area scale", "面积缩放", "面積縮放"],
  ["orientation", "Orientation", "取向", "取向"],
  ["explore", "Exploration", "探索", "探索"],
]);
const linearObjectives = [
  L(
    "Read the columns as transformed basis vectors.",
    "把矩阵的列理解为基向量的像。",
    "把矩陣的列理解為基向量的像。",
  ),
  L(
    "Connect determinant magnitude to area and its sign to orientation.",
    "把行列式的大小与面积、符号与取向联系起来。",
    "把行列式的大小與面積、符號與取向聯繫起來。",
  ),
  L(
    "Recognize a singular transformation as dimension collapse.",
    "把奇异变换理解为维度塌缩。",
    "把奇異變換理解為維度塌縮。",
  ),
];
export const learningProfiles: readonly ConceptLearningProfile[] = [
  {
    conceptId: "simple-harmonic-motion",
    prerequisites: ["hookes-law", "newton-s-second-law", "equilibrium"],
    learningObjectives: [
      L(
        "Explain why restoring force points toward equilibrium.",
        "说明回复力为何指向平衡位置。",
        "說明回復力為何指向平衡位置。",
      ),
      L(
        "Connect F = −kx with a = −ω²x.",
        "连接 F = −kx 与 a = −ω²x。",
        "連接 F = −kx 與 a = −ω²x。",
      ),
      L(
        "Explain maximum speed at equilibrium and kinetic/potential energy exchange.",
        "解释平衡位置处的最大速率和动能、势能交换。",
        "解釋平衡位置處的最大速率和動能、勢能交換。",
      ),
    ],
    sequence: path("guided-shm", [
      ["equilibrium", "Equilibrium", "平衡", "平衡"],
      ["displacement", "Displacement", "位移", "位移"],
      ["restoring-force", "Restoring force", "回复力", "回復力"],
      ["acceleration", "Acceleration", "加速度", "加速度"],
      ["release", "Release", "释放", "釋放"],
      ["crossing", "Equilibrium crossing", "穿越平衡", "穿越平衡"],
      ["opposite", "Force reversal", "力反向", "力反向"],
      ["periodicity", "Periodicity", "周期性", "週期性"],
      ["equation", "Equation & phase", "方程与相位", "方程與相位"],
      ["energy", "Energy exchange", "能量交换", "能量交換"],
    ]),
    textbookReferences: shmReferences,
    visualizations: ["guided-shm"],
    nextConcepts: [
      "damped-oscillation",
      "forced-oscillation",
      "resonance",
      "wave-motion",
    ],
  },
  {
    conceptId: "ellipse",
    prerequisites: ["vector", "sine"],
    learningObjectives: [
      L(
        "Recognize an ellipse by its constant focal distance sum.",
        "用焦距之和不变识别椭圆。",
        "用焦距之和不變識別橢圓。",
      ),
      L(
        "Connect the locus, semi-axes and standard equation.",
        "连接轨迹、半轴与标准方程。",
        "連接軌跡、半軸與標準方程。",
      ),
    ],
    sequence: path("guided-ellipse", [
      ["foci", "Foci", "焦点", "焦點"],
      ["point", "Distances", "距离", "距離"],
      ["sum", "Constant sum", "固定和", "固定和"],
      ["locus", "Locus", "轨迹", "軌跡"],
      ["axes", "Semi-axes", "半轴", "半軸"],
      ["triangle", "Right triangle", "直角三角形", "直角三角形"],
      ["standard-equation", "Standard equation", "标准方程", "標準方程"],
    ]),
    textbookReferences: ellipseReferences,
    visualizations: ["guided-ellipse"],
    nextConcepts: ["polar-coordinates"],
  },
  ...["linear-transformation", "determinant"].map((conceptId) => ({
    conceptId,
    prerequisites: ["vector", "matrix", "basis"],
    learningObjectives: linearObjectives,
    sequence: linearPath,
    visualizations: ["guided-linear"],
    nextConcepts: ["matrix-rank", "eigenvalue", "change-of-basis"],
  })),
];
const byConceptId = new Map(
  learningProfiles.map((profile) => [profile.conceptId, profile]),
);
export const getLearningProfile = (conceptId: string) =>
  byConceptId.get(conceptId);
