import { L } from "../../learning/types.ts";
import type { GuidedVisualizationDefinition } from "../types";
import { step, parameter } from "./helpers.ts";
const ellipseInvariant = L(
  "The sum of the distances to the two foci is 2a.",
  "到两个焦点的距离之和恒为 2a。",
  "到兩個焦點的距離之和恆為 2a。",
);
export const guidedEllipse: GuidedVisualizationDefinition = {
  id: "guided-ellipse",
  title: L(
    "Ellipse: definition to equation",
    "椭圆：从定义到方程",
    "橢圓：從定義到方程",
  ),
  conceptIds: ["ellipse"],
  renderer: "jsxgraph",
  kind: "guided-lesson",
  presets: [],
  parameters: [
    parameter("a", L("Semi-major axis a", "半长轴 a", "半長軸 a"), 1, 4, 3),
    parameter("c", L("Focal distance c", "半焦距 c", "半焦距 c"), 0, 3.9, 1.8),
    parameter(
      "theta",
      L("Point angle θ", "点的参数角 θ", "點的參數角 θ"),
      0,
      6.28,
      0.8,
      "rad",
      0.01,
    ),
  ],
  steps: [
    step(
      "ellipse",
      0,
      "foci",
      L("Two foci", "两个焦点", "兩個焦點"),
      L(
        "Place F₁ and F₂ symmetrically about the origin. c is half their separation. When c = 0 the foci coincide and the ellipse becomes a circle.",
        "把 F₁ 与 F₂ 对称放在原点两侧。c 是两焦点间距的一半。c = 0 时焦点重合，椭圆成为圆。",
        "把 F₁ 與 F₂ 對稱放在原點兩側。c 是兩焦點間距的一半。c = 0 時焦點重合，橢圓成為圓。",
      ),
      L(
        "The distance between the foci is 2c.",
        "两焦点间距为 2c。",
        "兩焦點間距為 2c。",
      ),
      ["F_1=(-c,0),\\quad F_2=(c,0)"],
      ["a", "c"],
      ["f1", "f2"],
    ),
    step(
      "ellipse",
      1,
      "point",
      L("A point and two distances", "一点与两段距离", "一點與兩段距離"),
      L(
        "Drag P or move θ. P is constrained to the candidate locus. Watch PF₁ and PF₂ change; measure both, not just the distance to the center.",
        "拖动 P 或调整 θ。P 被约束在候选轨迹上。观察 PF₁ 与 PF₂ 如何变化；应测量这两段距离，而非只测到中心的距离。",
        "拖動 P 或調整 θ。P 被約束在候選軌跡上。觀察 PF₁ 與 PF₂ 如何變化；應測量這兩段距離，而非只測到中心的距離。",
      ),
      L(
        "Both focal distances depend on P.",
        "两段焦距随 P 的位置改变。",
        "兩段焦距隨 P 的位置改變。",
      ),
      ["r_1=PF_1,\\quad r_2=PF_2"],
      ["a", "c", "theta"],
      ["p", "r1", "r2"],
    ),
    step(
      "ellipse",
      2,
      "sum",
      L("Keep the sum fixed", "固定距离之和", "固定距離之和"),
      L(
        "One distance increases while the other decreases. Their sum is 2a, greater than 2c. This is the geometric definition of the ellipse, not constant distance to its center.",
        "一段距离增大，另一段减小。它们的和是 2a，且大于 2c。这是椭圆的几何定义，并非到中心距离不变。",
        "一段距離增大，另一段減小。它們的和是 2a，且大於 2c。這是橢圓的幾何定義，並非到中心距離不變。",
      ),
      ellipseInvariant,
      ["PF_1+PF_2=2a,\\quad 0\\le c<a"],
      ["a", "c", "theta"],
      ["r1", "r2"],
    ),
    step(
      "ellipse",
      3,
      "locus",
      L("Trace the locus", "描出轨迹", "描出軌跡"),
      L(
        "Play or drag P to accumulate a trace. Every visited point satisfies the same distance sum. Changing a or c starts a fresh trace because the locus has changed.",
        "播放或拖动 P 来积累轨迹。每个经过的点都满足同一距离和。改变 a 或 c 会重新描线，因为轨迹已改变。",
        "播放或拖動 P 來積累軌跡。每個經過的點都滿足同一距離和。改變 a 或 c 會重新描線，因為軌跡已改變。",
      ),
      ellipseInvariant,
      ["P(\\theta)=(a\\cos\\theta,b\\sin\\theta)"],
      ["a", "c", "theta"],
      ["locus", "p"],
      "loop",
      8,
    ),
    step(
      "ellipse",
      4,
      "axes",
      L("Name a, b and c", "认识 a、b、c", "認識 a、b、c"),
      L(
        "a is the horizontal semi-axis, b the vertical semi-axis, and c the center-to-focus distance. They are half-lengths; a is not the full width.",
        "a 是水平半轴，b 是竖直半轴，c 是中心到焦点的距离。它们都是半长度；a 不是完整宽度。",
        "a 是水平半軸，b 是豎直半軸，c 是中心到焦點的距離。它們都是半長度；a 不是完整寬度。",
      ),
      ellipseInvariant,
      ["w=2a,\\quad h=2b"],
      ["a", "c", "theta"],
      ["axis-a", "axis-b", "axis-c"],
    ),
    step(
      "ellipse",
      5,
      "triangle",
      L("The right triangle", "直角三角形", "直角三角形"),
      L(
        "At the top vertex both focal distances equal a. The right triangle has legs b and c and hypotenuse a. Pythagoras therefore determines b; it is not an independent parameter.",
        "在上顶点，两段焦距均为 a。直角三角形的直角边为 b、c，斜边为 a。因此勾股关系确定 b，b 不是独立参数。",
        "在上頂點，兩段焦距均為 a。直角三角形的直角邊為 b、c，斜邊為 a。因此勾股關係確定 b，b 不是獨立參數。",
      ),
      L(
        "a² = b² + c², with a greater than c.",
        "a² = b² + c²，且 a 大于 c。",
        "a² = b² + c²，且 a 大於 c。",
      ),
      ["c^2=a^2-b^2", "b=\\sqrt{a^2-c^2}"],
      ["a", "c"],
      ["triangle", "axis-b", "axis-c"],
    ),
    step(
      "ellipse",
      6,
      "standard-equation",
      L("From distances to coordinates", "从距离到坐标", "從距離到座標"),
      L(
        "Write the two distances using coordinates, isolate one radical and square twice. Using b² = a² − c² gives the standard equation. Its intercepts are ±a and ±b; each plotted point satisfies both descriptions.",
        "用坐标写出两段距离，移项分离一个根式，再平方两次。代入 b² = a² − c² 得到标准方程。截距为 ±a 与 ±b；每个轨迹点同时满足两种描述。",
        "用座標寫出兩段距離，移項分離一個根式，再平方兩次。代入 b² = a² − c² 得到標準方程。截距為 ±a 與 ±b；每個軌跡點同時滿足兩種描述。",
      ),
      ellipseInvariant,
      [
        "\\sqrt{(x+c)^2+y^2}+\\sqrt{(x-c)^2+y^2}=2a",
        "\\frac{x^2}{a^2}+\\frac{y^2}{b^2}=1",
      ],
      ["a", "c", "theta"],
      ["locus", "axis-a", "axis-b"],
      "loop",
      8,
    ),
  ],
};

const teachingStep = guidedEllipse.steps.find((s) => s.id === "sum")!;
teachingStep.misconception = L(
  "A squashed-circle drawing does not define an ellipse. The constant sum of focal distances does.",
  "椭圆的定义不是压扁的圆，而是到两焦点距离之和不变的轨迹。",
  "橢圓的定義不是壓扁的圓，而是到兩焦點距離之和不變的軌跡。",
);
teachingStep.observation = L(
  "Each distance changes while their sum stays 2a.",
  "每段距离在变，距离之和保持 2a。",
  "每段距離在變，距離之和保持 2a。",
);
