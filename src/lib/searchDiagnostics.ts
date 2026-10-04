import type { SearchResponse } from "./types";
import { parseAndExpand } from "./searchEngine.ts";
export type ZeroResultReason =
  | "unknown-concept"
  | "known-concept-no-resource"
  | "filtered-out"
  | "provider-disabled"
  | "provider-error"
  | "index-stale"
  | "language-mapping-gap"
  | "true-no-match";
export interface SearchDiagnostics {
  reasons: ZeroResultReason[];
  recognized_concepts: string[];
  snapshot_date: string | null;
  stale: boolean;
}
export function diagnose(
  response: SearchResponse,
  visibleCount = response.total,
  now = Date.now(),
): SearchDiagnostics {
  const query = parseAndExpand(response.query);
  const selected = response.providers.filter((p) => p.state !== "idle");
  const dates = selected
    .map((p) => p.last_updated)
    .filter((d): d is string => !!d)
    .sort();
  const stale = dates.some(
    (d) =>
      !Number.isFinite(Date.parse(d)) || now - Date.parse(d) > 30 * 86400000,
  );
  const reasons: ZeroResultReason[] = [];
  if (visibleCount === 0) {
    if (response.total > 0 || (response.unfiltered_total ?? 0) > 0)
      reasons.push("filtered-out");
    if (!selected.length) reasons.push("provider-disabled");
    if (selected.some((p) => p.state === "error"))
      reasons.push("provider-error");
    if (stale) reasons.push("index-stale");
    if (response.language_mapping_gap) reasons.push("language-mapping-gap");
    if (!reasons.length)
      reasons.push(
        query.concept_ids.length
          ? "known-concept-no-resource"
          : query.groups.length
            ? "unknown-concept"
            : "true-no-match",
      );
  }
  return {
    reasons,
    recognized_concepts: query.concept_ids,
    snapshot_date: dates[0] ?? null,
    stale,
  };
}
export const diagnosticMessages: Record<
  ZeroResultReason,
  [string, string, string]
> = {
  "unknown-concept": [
    "This term is not currently represented in the STEM ontology. No matching indexed resources were found.",
    "术语尚未收录到 STEM 概念库，当前索引未找到匹配。",
    "術語尚未收錄到 STEM 概念庫，目前索引未找到符合項目。",
  ],
  "known-concept-no-resource": [
    "Concept recognized. No direct match in the enabled provider indexes.",
    "已识别概念，已启用来源的索引中没有直接匹配。",
    "已辨識概念，已啟用來源的索引中沒有直接符合項目。",
  ],
  "filtered-out": [
    "Matches exist, but the current filters hide them.",
    "存在匹配资源，但被当前筛选条件隐藏。",
    "存在符合資源，但被目前篩選條件隱藏。",
  ],
  "provider-disabled": [
    "No provider is selected. Enable a source or check the source filter.",
    "未选择可搜索来源，请启用来源或检查来源筛选。",
    "未選取可搜尋來源，請啟用來源或檢查來源篩選。",
  ],
  "provider-error": [
    "A provider failed. Coverage is incomplete; check source status and retry.",
    "部分来源请求失败，覆盖不完整；请检查来源状态并重试。",
    "部分來源請求失敗，涵蓋不完整；請檢查來源狀態並重試。",
  ],
  "index-stale": [
    "The index is over 30 days old; newer resources may be missing.",
    "索引已超过 30 天，可能缺少较新的资源。",
    "索引已超過 30 天，可能缺少較新的資源。",
  ],
  "language-mapping-gap": [
    "An indexed concept lacks a usable language mapping.",
    "索引中的概念缺少可用的语言映射。",
    "索引中的概念缺少可用的語言映射。",
  ],
  "true-no-match": [
    "No direct indexed match for this query.",
    "当前索引没有此查询的直接匹配。",
    "目前索引沒有此查詢的直接符合項目。",
  ],
};
