import type { Vec2 } from "./types";

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export const TAU = 2 * Math.PI;
export function shmState(A: number, k: number, m: number, phase: number) {
  if (![A, k, m, phase].every(Number.isFinite) || A < 0 || k <= 0 || m <= 0)
    throw new Error("Invalid SHM parameters");
  const omega = Math.sqrt(k / m);
  const x = A * Math.cos(phase),
    v = -A * omega * Math.sin(phase);
  const force = -k * x,
    acceleration = force / m;
  const kinetic = 0.5 * m * v * v,
    potential = 0.5 * k * x * x;
  return {
    omega,
    x,
    v,
    force,
    acceleration,
    kinetic,
    potential,
    energy: kinetic + potential,
    period: TAU / omega,
  };
}
export function ellipseState(a: number, c: number, theta: number) {
  if (![a, c, theta].every(Number.isFinite) || a <= 0 || c < 0 || c >= a)
    throw new Error("Ellipse requires 0 ≤ c < a");
  const b = Math.sqrt(a * a - c * c);
  const point: Vec2 = [a * Math.cos(theta), b * Math.sin(theta)];
  const r1 = Math.hypot(point[0] + c, point[1]),
    r2 = Math.hypot(point[0] - c, point[1]);
  return { b, point, r1, r2, sum: r1 + r2 };
}
export interface Matrix2 {
  a: number;
  b: number;
  c: number;
  d: number;
}
export const transform = (A: Matrix2, [x, y]: Vec2): Vec2 => [
  A.a * x + A.b * y,
  A.c * x + A.d * y,
];
export const determinant = (A: Matrix2) => A.a * A.d - A.b * A.c;
export const orientation = (det: number) =>
  Math.abs(det) < 1e-10 ? 0 : det > 0 ? 1 : -1;
export const interpolateMatrix = (A: Matrix2, s: number): Matrix2 => ({
  a: 1 + s * (A.a - 1),
  b: s * A.b,
  c: s * A.c,
  d: 1 + s * (A.d - 1),
});
export function orientedArea(vertices: Vec2[]) {
  return (
    vertices.reduce((sum, p, i) => {
      const q = vertices[(i + 1) % vertices.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2
  );
}
