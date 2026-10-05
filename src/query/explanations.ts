import { resolveQuery } from "./resolve.ts";
import { tokenize } from "./tokenize.ts";
export function explainQuery(query: string) {
  const result = resolveQuery(query);
  return { ...result, tokens: tokenize(result.normalizedQuery) };
}
