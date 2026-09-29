/** The web and desktop backends accept the same external URL schemes. */
export function httpUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid URL");
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
    throw new Error("Only HTTP and HTTPS URLs are supported");
  }
  return url.href;
}

export function workspaceUrls(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 4) throw new Error("A workspace supports up to four pages");
  return [...new Set(value.map(httpUrl))];
}
