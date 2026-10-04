import data from "./historicalAliases.json" with { type: "json" };
import type { HistoricalAlias } from "./types";

// A query-recognition extension, never a canonical label or a resource annotation.
export const historicalAliases: readonly HistoricalAlias[] =
  data as HistoricalAlias[];
