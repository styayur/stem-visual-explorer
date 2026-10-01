# Architecture

STEM Visual Explorer is a local-first resource discovery and comparison tool. Its architecture is intentionally narrower than a general browser.

## Core domain

- Normalize multilingual STEM queries into stable concepts and weighted variants.
- Search enabled providers concurrently and merge results into one normalized shape.
- Rank by transparent lexical, concept, exact-title, and interaction rules.
- Support favorites, history, preview selection, and bounded four-pane comparison.
- Keep search, provider, and ranking policy shared between desktop and web where practical.

## UI boundary

React owns search state, filters, result presentation, workspaces, keyboard interaction, and preview selection. Provider-specific parsing does not belong in UI components. Web and desktop may differ in storage and window capabilities, but the search contract remains shared.

## Provider boundary

Each source implements `SearchProvider` and returns normalized `SearchResult` values. Providers own source-specific fetching/parsing and declare experimental status, index metadata, and PreviewCapability. See [provider-extension.md](provider-extension.md).

## Preview and WebViewer boundary

`src/lib/previewCapabilities.json` is the conservative source-host policy shared by Rust and the browser. WebViewer is a supporting inspection surface for a selected result, not a tabbed browser or an embedding-policy bypass. CSP and X-Frame-Options remain authoritative.

## Persistence boundary

Favorites, history, settings, and desktop indexes are local. The web build uses browser storage and a published index snapshot; the desktop build uses local files/SQLite and provider refreshes. No account, cloud database, or telemetry service is required.

## External service boundary

Network requests go directly from the user's machine to source providers. Translation is opt-in and sends only selected text to the configured translation service. External pages are never granted application IPC.

## Extension points

- New providers must add parser fixtures, registry metadata, an explicit host policy, and preview capability.
- Ranking changes require shared-language regressions and concept/weight tests.
- New preview behavior must preserve URL validation and embedding policy.
- New persistence fields require migration/default handling and web/desktop parity notes.

## Release boundary

Desktop releases use `vX.Y.Z` tags, exact-source validation, Windows build checks, stable portable/installer names, and `SHA256SUMS.txt`. The GitHub Pages build is generated from the same source and deployed separately. Maintainers own tagging and publication.
