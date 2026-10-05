import { L } from "../../learning/types.ts";
import type { GuidedVisualizationDefinition } from "../types";
import { step, parameter } from "./helpers.ts";
const linearInvariant = L(
  "The columns of A are the images of the basis vectors.",
  "矩阵 A 的列就是基向量的像。",
  "矩陣 A 的列就是基向量的像。",
);
export const guidedLinear: GuidedVisualizationDefinition = {
  id: "guided-linear",
  title: L(
    "Linear transformation & determinant",
    "线性变换与行列式",
    "線性變換與行列式",
  ),
  conceptIds: ["linear-transformation", "determinant"],
  renderer: "jsxgraph",
  kind: "guided-lesson",
  parameters: [
    ...["a", "b", "c", "d"].map((id) =>
      parameter(
        id,
        L(`Matrix entry ${id}`, `矩阵元素 ${id}`, `矩陣元素 ${id}`),
        -2,
        2,
        ({ a: 1.5, b: 0.5, c: 0, d: 1 } as Record<string, number>)[id],
      ),
    ),
    parameter(
      "blend",
      L("Transformation progress", "变换进度", "變換進度"),
      0,
      1,
      1,
      undefined,
      0.01,
    ),
  ],
  presets: [
    {
      id: "rotation",
      title: L("Rotation (90°)", "旋转（90°）", "旋轉（90°）"),
      parameters: { a: 0, b: -1, c: 1, d: 0, blend: 1 },
    },
    {
      id: "scaling",
      title: L("Scaling", "缩放", "縮放"),
      parameters: { a: 2, b: 0, c: 0, d: 1.5, blend: 1 },
    },
    {
      id: "shear",
      title: L("Shear", "剪切", "剪切"),
      parameters: { a: 1, b: 1, c: 0, d: 1, blend: 1 },
    },
    {
      id: "reflection",
      title: L("Reflection", "反射", "反射"),
      parameters: { a: -1, b: 0, c: 0, d: 1, blend: 1 },
    },
    {
      id: "singular",
      title: L("Singular transform", "奇异变换", "奇異變換"),
      parameters: { a: 1, b: 2, c: 0.5, d: 1, blend: 1 },
    },
  ],
  steps: [
    step(
      "linear",
      0,
      "identity",
      L(
        "Identity and the unit square",
        "恒等变换与单位正方形",
        "恆等變換與單位正方形",
      ),
      L(
        "Start with e₁, e₂ and a square of area 1. The identity sends every point to itself. The original grid remains as a reference throughout this lesson.",
        "从 e₁、e₂ 和面积为 1 的正方形开始。恒等变换把每个点映到自身。原网格始终作为参照保留。",
        "從 e₁、e₂ 和面積為 1 的正方形開始。恆等變換把每個點映到自身。原網格始終作為參照保留。",
      ),
      L(
        "The initial area is 1 and the orientation is positive.",
        "初始面积为 1，取向为正。",
        "初始面積為 1，取向為正。",
      ),
      ["I=\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}"],
      [],
      ["square", "e1", "e2"],
    ),
    step(
      "linear",
      1,
      "basis",
      L("Transform the basis", "变换基向量", "變換基向量"),
      L(
        "A maps e₁ to its first column and e₂ to its second. Change one entry and inspect which basis image moves. Keep the unit square as a reference.",
        "A 把 e₁ 映到第一列，把 e₂ 映到第二列。改变一个元素，观察哪个基向量的像移动。单位正方形仍作为参照。",
        "A 把 e₁ 映到第一列，把 e₂ 映到第二列。改變一個元素，觀察哪個基向量的像移動。單位正方形仍作為參照。",
      ),
      linearInvariant,
      [
        "A=\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}",
        "Ae_1=(a,c),\\quad Ae_2=(b,d)",
      ],
      ["a", "b", "c", "d"],
      ["e1", "e2"],
    ),
    step(
      "linear",
      2,
      "grid",
      L("Move the whole grid", "变换整个网格", "變換整個網格"),
      L(
        "Play or scrub progress. Each point (x,y) follows xAe₁ + yAe₂. The preview interpolates B = (1−s)I + sA; it can become singular on the way even when A is invertible.",
        "播放或调整进度。每点 (x,y) 映为 xAe₁ + yAe₂。预览插值 B = (1−s)I + sA；即使 A 可逆，途中仍可能出现奇异矩阵。",
        "播放或調整進度。每點 (x,y) 映為 xAe₁ + yAe₂。預覽插值 B = (1−s)I + sA；即使 A 可逆，途中仍可能出現奇異矩陣。",
      ),
      L(
        "Linear combinations follow their transformed basis vectors.",
        "线性组合由变换后的基向量决定。",
        "線性組合由變換後的基向量決定。",
      ),
      ["B(s)=(1-s)I+sA", "B(x,y)=xBe_1+yBe_2"],
      ["a", "b", "c", "d", "blend"],
      ["grid", "e1", "e2"],
      "once",
    ),
    step(
      "linear",
      3,
      "parallelogram",
      L("Square to parallelogram", "正方形到平行四边形", "正方形到平行四邊形"),
      L(
        "The square's four corners map to 0, Ae₁, Ae₁+Ae₂ and Ae₂. Opposite edges stay parallel because linear maps preserve vector addition.",
        "正方形四个角映到 0、Ae₁、Ae₁+Ae₂、Ae₂。线性映射保持向量加法，因此对边仍平行。",
        "正方形四個角映到 0、Ae₁、Ae₁+Ae₂、Ae₂。線性映射保持向量加法，因此對邊仍平行。",
      ),
      linearInvariant,
      ["A(e_1+e_2)=Ae_1+Ae_2"],
      ["a", "b", "c", "d"],
      ["image", "e1", "e2"],
    ),
    step(
      "linear",
      4,
      "area",
      L("Measure area change", "测量面积变化", "測量面積變化"),
      L(
        "The parallelogram's area is |ad−bc|. Compare it with the original area 1. A shear changes the shape but leaves the area unchanged.",
        "平行四边形面积为 |ad−bc|，与原面积 1 对照。剪切改变形状，却保持面积不变。",
        "平行四邊形面積為 |ad−bc|，與原面積 1 對照。剪切改變形狀，卻保持面積不變。",
      ),
      L(
        "The unsigned area scale is |det(A)|.",
        "无向面积缩放因子是 |det(A)|。",
        "無向面積縮放因子是 |det(A)|。",
      ),
      [
        "\\det(A)=ad-bc",
        "\\frac{\\mathrm{Area}_{after}}{\\mathrm{Area}_{before}}=|\\det(A)|",
      ],
      ["a", "b", "c", "d"],
      ["image", "square"],
    ),
    step(
      "linear",
      5,
      "orientation",
      L("Orientation and collapse", "取向与维度塌缩", "取向與維度塌縮"),
      L(
        "Follow the labeled corners in order. Positive determinant preserves their orientation, negative reverses it, and zero makes the area collapse to a line or point. Area itself is never negative.",
        "按顺序观察标出的各角。行列式为正时保持取向，为负时反转，为零时面积塌缩成线或点。面积本身不会为负。",
        "按順序觀察標出的各角。行列式為正時保持取向，為負時反轉，為零時面積塌縮成線或點。面積本身不會為負。",
      ),
      L(
        "det(A) is an oriented area scale, not just an area.",
        "det(A) 是有向面积缩放因子，不只是面积。",
        "det(A) 是有向面積縮放因子，不只是面積。",
      ),
      ["\\det(A)>0:\\ +,\\quad\\det(A)<0:\\ -,\\quad\\det(A)=0:\\ 0"],
      ["a", "b", "c", "d"],
      ["image", "corner1", "corner2", "corner3"],
    ),
    step(
      "linear",
      6,
      "explore",
      L("Explore five transformations", "探索五种变换", "探索五種變換"),
      L(
        "Choose rotation, scaling, shear, reflection or a singular matrix. Predict the determinant's sign and area first, then inspect the result. Use Play or progress to compare intermediate B with the target A.",
        "选择旋转、缩放、剪切、反射或奇异矩阵。先预测行列式的符号与面积，再观察结果。播放或调整进度，对照中间矩阵 B 与目标 A。",
        "選擇旋轉、縮放、剪切、反射或奇異矩陣。先預測行列式的符號與面積，再觀察結果。播放或調整進度，對照中間矩陣 B 與目標 A。",
      ),
      L(
        "The determinant connects basis, area and orientation.",
        "行列式连接基向量、面积与取向。",
        "行列式連接基向量、面積與取向。",
      ),
      ["\\det(A)=ad-bc", "B(s)=(1-s)I+sA"],
      ["a", "b", "c", "d", "blend"],
      ["image", "grid"],
      "once",
    ),
  ],
};

const teachingStep = guidedLinear.steps.find((s) => s.id === "area")!;
teachingStep.misconception = L(
  "The determinant is an oriented area scale, not only a matrix calculation. Its magnitude gives area; its sign gives orientation.",
  "行列式是有向面积的倍率，不只是矩阵计算公式。绝对值描述面积，符号描述取向。",
  "行列式是有向面積的倍率，不只是矩陣計算公式。絕對值描述面積，符號描述取向。",
);
teachingStep.cause = L(
  "The two transformed basis vectors span the image of the unit square.",
  "两个变换后的基向量张成单位正方形的像。",
  "兩個變換後的基向量張成單位正方形的像。",
);
