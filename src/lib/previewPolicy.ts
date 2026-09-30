import policies from "./previewCapabilities.json" with { type: "json" };
import type { PreviewCapability, SearchResult } from "./types";

export function providerCapability(id: string): PreviewCapability {
  return (policies.find((p) => p.id === id)?.capability as PreviewCapability | undefined) ?? "NativeCard";
}
export function providerForUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!["https:", "http:"].includes(parsed.protocol)) return undefined;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return policies.find((p) => p.hosts.includes(host));
  } catch { return undefined; }
}
export function previewCapability(result: Pick<SearchResult, "source_id" | "url">): PreviewCapability {
  // Validate both declared provider and destination; a stale/corrupt result cannot
  // use an Embed provider ID to load an unrelated origin.
  const provider = providerForUrl(result.url);
  return provider && provider.id === result.source_id ? providerCapability(provider.id) : "NativeCard";
}
export function resourceForUrl(url: string): SearchResult {
  const provider = providerForUrl(url);
  return { id: url, url, source_id: provider?.id ?? "unknown", source_name: provider?.id ?? "Resource",
    title: url, description: null, result_type: "unknown", tags: [], score: 0, thumbnail: null };
}
