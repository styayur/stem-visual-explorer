// Offline STEM glossary (English -> Chinese). Acts as an instant, network-free
// translation path for single terms and as a fallback when the API is offline.
const EN_ZH: Record<string, string> = {
  gradient: "梯度",
  curl: "旋度",
  divergence: "散度",
  "standing wave": "驻波",
  "harmonic oscillator": "简谐振动",
  "gauss theorem": "高斯定理",
  "divergence theorem": "散度定理",
  "stokes theorem": "斯托克斯定理",
  "directional derivative": "方向导数",
  "electromagnetic induction": "电磁感应",
  "electromagnetic wave": "电磁波",
  "electromagnetic field": "电磁场",
  "electric field": "电场",
  "magnetic field": "磁场",
  "electric potential": "电势",
  "quantum mechanics": "量子力学",
  quantum: "量子",
  fourier: "傅里叶",
  "fourier transform": "傅里叶变换",
  "wave equation": "波动方程",
  thermodynamics: "热力学",
  mechanics: "力学",
  optics: "光学",
  relativity: "相对论",
  derivative: "导数",
  integral: "积分",
  vector: "向量",
  "vector field": "向量场",
  matrix: "矩阵",
  eigenvalue: "特征值",
  "differential equation": "微分方程",
  "partial derivative": "偏导数",
  "multiple integral": "多重积分",
  "simple harmonic motion": "简谐运动",
  pendulum: "单摆",
  wave: "波",
  interference: "干涉",
  diffraction: "衍射",
  refraction: "折射",
  reflection: "反射",
  momentum: "动量",
  energy: "能量",
  entropy: "熵",
  circuit: "电路",
  capacitor: "电容",
  inductor: "电感",
  resistance: "电阻",
  current: "电流",
  voltage: "电压",
  frequency: "频率",
  wavelength: "波长",
  amplitude: "振幅",
  probability: "概率",
  statistics: "统计",
  topology: "拓扑",
  fluid: "流体",
  oscillation: "振动",
  resonance: "谐振",
  acceleration: "加速度",
  velocity: "速度",
  displacement: "位移",
  "simulation": "模拟",
  "applet": "小程序",
  "interactive": "互动",
  "visualization": "可视化",
};

const ZH_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_ZH).map(([k, v]) => [v, k])
);

/** Instant glossary lookup; returns null when the term is unknown. */
export function glossaryLookup(text: string, target: string): string | null {
  const key = text.trim().toLowerCase();
  if (!key) return null;
  if (target.startsWith("zh")) return EN_ZH[key] ?? null;
  if (target === "en") return ZH_EN[text.trim()] ?? null;
  return null;
}

export function glossarySize(): number {
  return Object.keys(EN_ZH).length;
}