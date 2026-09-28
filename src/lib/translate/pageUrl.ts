/** Build an external "translated page" URL the user can open in a new tab. */
export function buildTranslatedPageUrl(
  url: string,
  lang: string,
  proxyTemplate?: string
): string {
  const tpl = (proxyTemplate ?? "").trim();
  if (tpl.includes("{url}")) {
    return tpl
      .split("{url}").join(encodeURIComponent(url))
      .split("{lang}").join(encodeURIComponent(lang));
  }
  return `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(
    lang
  )}&u=${encodeURIComponent(url)}`;
}

/**
 * URL that can safely be embedded in an iframe for translation. Only a
 * user-supplied proxy is used here, because public translation proxies do not
 * reliably allow framing.
 */
export function buildEmbeddableTranslatedUrl(
  url: string,
  lang: string,
  proxyTemplate?: string
): string | null {
  const tpl = (proxyTemplate ?? "").trim();
  if (!tpl.includes("{url}")) return null;
  return tpl
    .split("{url}").join(encodeURIComponent(url))
    .split("{lang}").join(encodeURIComponent(lang));
}