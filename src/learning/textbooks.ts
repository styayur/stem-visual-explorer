import type { TextbookReference } from "./types";

const root =
  "https://github.com/tradecatlabs/shulihuazixuecongshu/blob/main/books/";
const reference = (
  book: string,
  chapter: string,
  section: string,
  conceptIds: string[],
): TextbookReference => ({
  sourceId: "shulihua",
  collection: "数理化自学丛书",
  book,
  chapter,
  section,
  conceptIds,
  language: "zh-CN",
  url: root + encodeURIComponent(`${book} - 数理化自学丛书编委会.md`),
  rightsStatus: "external-reference",
});

// Titles checked against the upstream table of contents on 2026-10-05.
// No book prose, scans, illustrations or third-party executable content is stored.
export const shmReferences = [
  "1.1 简谐振动",
  "1.2 简谐振动方程",
  "1.3 简谐振动方程中的参量",
  "1.6 简谐振动的能量",
].map((section) =>
  reference("物理（第二册）", "第一章", section, ["simple-harmonic-motion"]),
);
export const ellipseReferences = [
  "4·5 椭圆的定义",
  "4·6 椭圆的标准方程",
  "4·7 椭圆的性质",
].map((section) =>
  reference("平面解析几何", "第四章 圆锥曲线", section, ["ellipse"]),
);
