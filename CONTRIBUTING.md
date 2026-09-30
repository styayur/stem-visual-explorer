# Contributing

STEM Visual Explorer is a search and comparison tool for STEM resources. Keep the core domain focused on discovery, preview selection, comparison, and learning-oriented context.

## Development

Requirements: Node.js 22.12+, npm, Rust stable, and WebView2/Windows C++ build tools for the desktop app.

```bash
npm ci
npm test
npm run build
npm run build:web

cd src-tauri
cargo fmt --check
cargo test --no-default-features
cargo clippy --no-default-features --all-targets -- -D warnings
```

Run browser tests documented in the README for UI/search/provider changes. Desktop WebViewer changes require the Windows regression workflow or an equivalent local run.

## Architecture boundaries

- Core domain: resource discovery, multilingual query normalization, ranking, preview selection, favorites/history, and comparison.
- Providers implement `SearchProvider` and return normalized `SearchResult` values.
- Preview behavior is declared in `src/lib/previewCapabilities.json` and must be conservative.
- WebViewer is a supporting capability for inspecting a selected resource, not a browser product.
- CSP and X-Frame-Options are never bypassed with proxy/header-rewrite fallbacks.
- New providers require a fixture or parser contract test and metadata aligned across Rust/browser policy.
- Provider-specific behavior belongs in the provider module, not in generic UI components.

## Pull requests

Add tests for parsing, ranking, normalization, and regression cases. Keep Chinese and English README claims synchronized. Maintainers perform releases. Security issues must follow [SECURITY.md](SECURITY.md).
