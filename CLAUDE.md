# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A zero-dependency JS library (~5KB minified) that auto-detects a visitor's OS/architecture and links them to the correct binary from a GitHub repo's latest release. Works as a `<script>` tag with `data-*` attributes or programmatically via the `DownloadLatest` class.

## Testing

Tests run in the browser — open `test/test.html` directly. No Node.js test runner. The test suite uses a custom harness (no framework) in `test/tests.js`.

To verify: open `test/test.html` in a browser and confirm all tests show green checkmarks. The last integration test hits the live GitHub API (for `rustdesk/rustdesk`), so it requires internet access.

## Building

Minify after changing `download-latest.js`:
```
npx terser download-latest.js -o download-latest.min.js -c -m
```
No other build step. No bundler, no framework.

## Architecture

**`download-latest.js`** — The entire library in one file, wrapped in UMD (works as `<script>`, CommonJS, ES module):
- `detectPlatform()` — OS/arch detection via `navigator.userAgentData` → UA string fallback. macOS defaults to arm64.
- `DEFAULT_MATCH` — Priority-ordered regex arrays per `{os}-{arch}` key (e.g., `macos-arm64`, `linux-x64`). First match wins.
- `matchAsset(assets, os, arch, customMatch)` — Iterates patterns, returns first matching asset.
- `filterAssets(rawAssets)` — Strips `.sha256`, `.sig`, `.blockmap`, etc. from asset lists.
- `fetchRelease(repo, version)` — GitHub API with 5-min `sessionStorage` cache (avoids 60/hr rate limit).
- `DownloadLatest` class — `get()` returns a Promise with `{url, asset, os, arch, version, releasesUrl, allAssets, matched}`. `attach(el)` binds a button. `attachFallback(el)` renders all assets. `attachSelector(el, opts)` renders a platform dropdown grouped by OS.
- `autoInit()` — Reads `data-*` from `document.currentScript` on load. This is how the zero-config script tag mode works.
- Static methods exposed for testing: `DownloadLatest.detectPlatform`, `.matchAsset`, `.filterAssets`, `.DEFAULT_MATCH`.

**`docs/`** — GitHub Pages site (served from `/docs` on `main`):
- `index.html` + `style.css` — Documentation and interactive configurator.
- `configurator.js` — Generates embed snippets based on user selections (mode, source, version, platform overrides). Renders a live preview using the library.
- `CNAME` — Points to `www.generouscorp.com`.

**`examples/`** — Six standalone HTML files demonstrating different usage modes. All reference the library via `../download-latest.js` (relative path for local testing).

**`test/`** — Browser-based test suite. Tests cover: asset filtering, per-platform matching with RustDesk fixture data, custom match overrides, detectPlatform shape validation, constructor behavior, and a live GitHub API integration test.

## Key Conventions

- Plain ES5-compatible JS in the library (no arrow functions, no `let`/`const`, no template literals) for maximum browser compatibility.
- The library never throws to the user — all errors fall back to a releases page link. When no match is found, `noMatchText` is shown and links to `noMatchUrl` or the releases page.
- Platform keys follow the `{os}-{arch}` format: `macos-arm64`, `macos-x64`, `windows-x64`, `windows-arm64`, `linux-x64`, `linux-arm64`.
- jsDelivr CDN is the recommended hosting (`https://cdn.jsdelivr.net/gh/danielraffel/download-latest@{tag}/download-latest.min.js`). No deployment step needed — jsDelivr auto-serves any public GitHub repo by convention.

## Release Process

1. Update version in `download-latest.js` header comment and `package.json`
2. Run `npx terser download-latest.js -o download-latest.min.js -c -m`
3. Commit, tag (e.g., `git tag v1.1.0`), push with tags
4. jsDelivr picks up the new tag automatically
