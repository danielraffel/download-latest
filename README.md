# download-latest

Add a "download latest" button to any site. Detects the visitor's OS and architecture, fetches the matching binary from your GitHub releases, and links directly to it.

**No build tools. No dependencies. One script tag.**

## Quick Start

### Script tag (easiest)

```html
<script
  src="https://cdn.jsdelivr.net/gh/danielraffel/download-latest@1.0.0/download-latest.min.js"
  data-repo="your-org/your-app"
></script>
```

This inserts a download button that auto-detects the visitor's platform and links to the right asset.

### Bind to your own button

```html
<a id="dl" href="#">Download</a>
<script
  src="https://cdn.jsdelivr.net/gh/danielraffel/download-latest@1.0.0/download-latest.min.js"
  data-repo="your-org/your-app"
  data-target="#dl"
></script>
```

### Auto-redirect (skip the button)

```html
<script
  src="https://cdn.jsdelivr.net/gh/danielraffel/download-latest@1.0.0/download-latest.min.js"
  data-repo="your-org/your-app"
  data-auto
></script>
```

### Programmatic

```html
<script src="https://cdn.jsdelivr.net/gh/danielraffel/download-latest@1.0.0/download-latest.min.js"></script>
<script>
  const dl = new DownloadLatest({ repo: 'your-org/your-app' });
  dl.get().then(result => {
    console.log(result.url);   // direct download URL
    console.log(result.os);    // 'macos', 'windows', or 'linux'
    console.log(result.arch);  // 'arm64' or 'x64'
  });
</script>
```

## Configuration

### `data-*` attributes

| Attribute | Description |
|---|---|
| `data-repo` | **Required.** GitHub `owner/repo` |
| `data-target` | CSS selector of an existing element to bind |
| `data-auto` | Auto-redirect to the download (no button) |
| `data-fallback` | CSS selector of an element to populate with all asset links |
| `data-selector` | CSS selector of an element to render a platform dropdown into |
| `data-version` | Pin to a specific release tag (e.g., `v2.1.0`) |
| `data-text` | Button text template. Use `{os}`, `{arch}`, `{version}` as placeholders. Default: `"Download for {os}"` |
| `data-no-match-text` | Text shown when visitor's platform has no matching binary. Default: `"View all downloads"` |
| `data-no-match-url` | URL to link to when no binary matches (default: releases page) |
| `data-theme` | Button theme: `auto` (follows system light/dark), `dark`, or omit for light default |
| `data-context-menu` | Enable right-click / long-press to open the releases page (disabled by default) |

### Programmatic config

```js
new DownloadLatest({
  repo: 'owner/repo',              // required
  version: 'v2.1.0',               // optional: pin to a tag
  text: 'Get {os} build',          // optional: button text
  noMatchText: 'Not available',    // optional: text when no match found
  noMatchUrl: 'https://...',       // optional: URL when no match (default: releases page)
  contextMenu: true,               // optional: right-click opens releases page (default: false)
  match: {                          // optional: override asset matching
    'macos-arm64': /\.dmg$/i,
    'linux-x64':  [/\.deb$/i, /\.AppImage$/i],  // array = priority order
  }
})
```

## Custom Matching

The library has built-in patterns for common naming conventions. Override them per platform if your assets use different names:

```js
new DownloadLatest({
  repo: 'owner/repo',
  match: {
    'macos-arm64':   /arm64\.dmg$/i,
    'macos-x64':     /x64\.dmg$/i,
    'windows-x64':   /Setup\.exe$/i,
    'windows-arm64': /arm64-setup\.exe$/i,
    'linux-x64':     /amd64\.deb$/i,
    'linux-arm64':   /arm64\.deb$/i,
  }
});
```

Each value can be a single regex or an array (tried in order, first match wins).

### Built-in defaults

| Platform | Patterns tried (in order) |
|---|---|
| macOS arm64 | `aarch64.dmg`, `arm64.dmg`, any `.dmg` |
| macOS x64 | `x86_64.dmg`, `x64.dmg`, `intel.dmg`, any `.dmg` |
| Windows x64 | `x86_64.exe`, `x64.exe`, any `.exe`, `.msi` |
| Windows arm64 | `arm64.exe`, `x86_64.exe`, any `.exe` |
| Linux x64 | `x86_64.AppImage`, `amd64.deb`, `x86_64.deb` |
| Linux arm64 | `aarch64.AppImage`, `arm64.deb`, `aarch64.deb` |

### Theming (light/dark mode)

The auto-created button uses CSS custom properties, so it works with any site theme:

- **Default** — light background, dark text (no `data-theme` needed)
- **`data-theme="auto"`** — follows the visitor's system preference via `prefers-color-scheme`
- **`data-theme="dark"`** — dark background, light text

Override the button's look from your own CSS:

```css
:root {
  --dl-bg: #007bff;
  --dl-color: #fff;
  --dl-radius: 4px;
}
```

When using "Bind existing element" mode, the button inherits your site's styling naturally — the library only sets `textContent` and `href`, not visual styles.

### Unsupported platforms

When no binary matches the visitor's platform (e.g., a Windows user visiting a macOS-only download page), the button shows `noMatchText` (default: "View all downloads") and links to either `noMatchUrl` or the releases page. The element gets a `data-dl-matched="false"` attribute that you can use for CSS styling.

## API

### `dl.get()` → `Promise<Result>`

```js
{
  url:         'https://github.com/.../asset.dmg',  // direct download URL (or releases page if no match)
  asset:       'app-1.0-arm64.dmg',                 // matched asset filename (or null)
  os:          'macos',                              // detected OS
  arch:        'arm64',                              // detected architecture
  version:     'v1.0.0',                             // release tag
  releasesUrl: 'https://github.com/.../releases/tag/v1.0.0',
  allAssets:   [...],                                // all release assets
  matched:     true                                  // whether a platform match was found
}
```

### `dl.attach(selectorOrElement)`

Binds a download link/button to the matched asset. Sets `href`, updates text, adds `data-dl-os`, `data-dl-arch`, and `data-dl-matched` attributes. Right-click opens the releases page.

When no match is found, shows `noMatchText` and links to `noMatchUrl` (or the releases page).

### `dl.attachFallback(selectorOrElement)`

Populates an element with links to all assets (with file sizes).

### `dl.attachSelector(selectorOrElement, options?)`

Renders a platform selector dropdown grouped by OS. Auto-detects the visitor's platform and pre-selects the matching asset.

```js
dl.attachSelector('#download-area', {
  include: ['macos-arm64', 'macos-x64', 'linux-x64'],  // only these platforms
  exclude: ['windows-arm64'],                            // hide these platforms
  buttonText: 'Download',                                // download button text
});
```

## Hosting

### jsDelivr CDN (recommended)

```
https://cdn.jsdelivr.net/gh/danielraffel/download-latest@1.0.0/download-latest.min.js
```

Pin to a version with `@1.0.0` or track latest with `@main`.

### Raw GitHub

```
https://raw.githubusercontent.com/danielraffel/download-latest/main/download-latest.min.js
```

Works for `<script>` tags. Note: serves as `text/plain` (browsers still execute it).

### Self-hosted

Copy `download-latest.min.js` into your project. Use the [configurator](https://www.generouscorp.com/download-latest/) to generate the snippet.

## How It Works

1. Detects visitor's OS and architecture via `navigator.userAgentData` (Chromium) with fallback to user-agent string parsing
2. Fetches latest release from the GitHub API (cached in `sessionStorage` for 5 minutes to stay within rate limits)
3. Matches assets against platform-specific regex patterns
4. If matched: links directly to the binary. If not: shows configurable fallback text and links to releases page or custom URL
5. Filters out `.sha256`, `.sig`, `.blockmap`, and other non-binary files automatically

## Examples

See the [`examples/`](examples/) directory:

- [minimal.html](examples/minimal.html) — one script tag, that's it
- [custom-button.html](examples/custom-button.html) — your own styled button
- [url-only.html](examples/url-only.html) — get the URL programmatically
- [fallback-list.html](examples/fallback-list.html) — show all available downloads
- [auto-redirect.html](examples/auto-redirect.html) — auto-start download on page load
- [platform-selector.html](examples/platform-selector.html) — dropdown menu grouped by OS

## License

MIT
