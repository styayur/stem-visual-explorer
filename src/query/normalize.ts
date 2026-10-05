import data from "./rules.json" with { type: "json" };
export const MAX_QUERY_LENGTH = 512;
const replacements = new Map(Object.entries(data.characters));
const scripts = new Map(Object.entries(data.scripts));
/** Mechanical normalization only. No concept names or student phrases are rewritten. */
export function normalizeQuery(raw: string): string {
  return Array.from(raw)
    .map((c) => replacements.get(c) ?? c)
    .join("")
    .normalize("NFKC")
    .toLowerCase()
    .split("")
    .map((c) => replacements.get(c) ?? c)
    .join("")
    .split("")
    .map((c) => scripts.get(c) ?? c)
    .join("")
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑–—−]/g, "-")
    .replace(/[，、；：！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
