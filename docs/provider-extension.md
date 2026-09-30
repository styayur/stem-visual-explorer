# Provider extension contract

A provider is a source adapter for resource discovery. It is not allowed to turn STEM Visual Explorer into a general browser or bypass a site's embedding policy.

## Required metadata

Each `SearchProvider` implementation must expose:

- stable lowercase `id`
- display `name`
- source `homepage`
- `preview_capability`
- `experimental` status when parsing is not yet stable
- optional index count and last-refresh timestamp

`preview_capability` is resolved from `src/lib/previewCapabilities.json`, shared by Rust and the browser build. A provider-specific override requires an explicit security/product review.

## PreviewCapability

| Capability | Contract |
| --- | --- |
| `Embed` | Only declared HTTPS/HTTP source hosts may be embedded; CSP/X-Frame-Options must remain respected |
| `NativeCard` | Show indexed metadata and an explicit external-open action; do not embed by default |
| `ExternalOnly` | Always open externally; do not attempt an iframe |

Unknown provider IDs and mismatched hosts default conservatively to `NativeCard` or external opening. Translation proxies are not iframe fallbacks.

## Search contract

1. Return normalized `SearchResult` records with stable IDs and validated HTTP(S) URLs.
2. Do not leak provider-specific HTML or scripts into shared UI code.
3. Handle source HTML/schema changes as provider errors without crashing the whole search.
4. Declare experimental parsers honestly.
5. Keep index refresh bounded, cached, and offline-tolerant.
6. Add fixture tests for parser changes and a registry contract test for metadata/capability coverage.

## Review checklist

- Does the provider stay within the discovery/comparison domain?
- Is preview behavior conservative and documented?
- Are URLs validated before any WebViewer/system-browser action?
- Is source licensing/attribution appropriate?
- Do web and desktop behavior remain coherent?
- Are Chinese and English limitations updated?
