# Security Policy

## Supported versions

Security fixes target the latest release and current `main`.

## Report privately

Do not report exploitable issues in a public issue. Use GitHub private vulnerability reporting:

https://github.com/styayur/stem-visual-explorer/security/advisories/new

Include the affected surface/version, source URL or query, Windows/browser environment, reproduction, impact, and minimal proof-of-concept details. Remove browsing history, cookies, local paths, and personal data.

## Scope

Relevant issues include URL-scheme validation, path or IPC escapes from WebViewer windows, unsafe injection into embedded pages, proxy/header bypasses, dependency compromise, index poisoning, and translation data leakage.

STEM Visual Explorer does not bypass CSP, X-Frame-Options, authentication, CAPTCHAs, or anti-bot controls. It is a resource discovery/comparison tool, not a general-purpose browser.
