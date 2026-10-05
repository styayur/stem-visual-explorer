import rules from "./rules.json" with { type: "json" };
const scaffolds = rules.scaffolds.map((p) => new RegExp(p, "gu"));
/** Scaffolding is removed downstream, after normalization, never rewritten into a concept. */
export function stripScaffolding(text: string): string {
  for (const pattern of scaffolds) text = text.replace(pattern, " ");
  return text.replace(/\s+/g, " ").trim();
}
export function tokenize(text: string): string[] {
  return (
    text.match(/[a-z0-9]+(?:[-'][a-z0-9]+)*|[\u3400-\u9fff]+|[^\s]/gu) ?? []
  );
}
export const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function word(c: string | undefined): boolean {
  return !!c && /[\p{L}\p{N}_]/u.test(c);
}
