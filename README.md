# YouTube Blocker

Browser extension for Chrome and Firefox. Blocks videos, channels, users, Shorts and comments on YouTube.

Built on a Manifest V3 WebExtension DOM/CSS-first architecture with `declarativeNetRequest` for direct navigation. It does not depend on YouTube's internal renderer schemas or inject into the page's JavaScript, keeping it resilient to YouTube UI changes.

## Features

- Block channels by ID or handle, and channel names by keyword/regex.
- Block videos by ID, title keyword/regex.
- Block comments by author or content.
- Block Shorts, including shelves and direct links.
- Optional content-area blocking (home feed, Trending, Explore, Subscriptions, comments, live chat, related videos).
- Direct navigation to blocked content redirects to a block page.
- Popup with a quick "block this video/channel" action.
- "Block video" / "Block channel" entries injected into YouTube's own `...` menus on video cards and the watch-page action bar.
- Import/export settings; BlockTube backups are auto-detected on import and merged additively (unsupported fields are reported, not dropped silently).
- Light/dark/system theme.

## Install

Build and load unpacked:

```sh
bun install
bun run build
```

- Chrome: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome`.
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json`.

## Development

```sh
bun run watch             # rebuild on change (both browsers)
bun test                  # Vitest unit tests
bun run typecheck         # tsc --noEmit
bun run check             # Biome lint + format check
bun run check:fix         # Biome lint + format, writing fixes
bun run build:chrome
bun run build:firefox
```

`bun install` runs `prepare`, which installs the [lefthook](https://lefthook.dev) git hooks. The `pre-commit` hook runs Biome against staged files and the `commit-msg` hook enforces [Conventional Commits](https://www.conventionalcommits.org) via [cocogitto](https://docs.cocogitto.io) (`cog`). Cocogitto is a system binary, not an bun dependency; install it separately (e.g. `pacman -S cocogitto`, `cargo install cocogitto`, or your package manager).

## Architecture

Two layers, no page injection:

1. `declarativeNetRequest` rules (generated from settings) redirect direct navigation to blocked videos, channels, handles and area pages. These are reconciled by the background service worker whenever state changes.
2. A content script (isolated world) applies CSS classes and a `MutationObserver` to hide matching cards, channels and comments. It also handles SPA navigation, which DNR cannot see.

Rule matching and URL parsing live in `src/shared/matcher.ts` and are pure and unit-tested. The rule model and DNR generation are in `src/shared/`.

### Filter syntax

One entry per line. Keywords match case-insensitively as substrings; `/pattern/flags` entries are treated as regular expressions. Lines starting with `//` are ignored.

## Limitations

- DOM filtering can briefly render content before it is hidden; the network layer covers direct navigation instead.
- The `declarativeNetRequest` rule count is capped (`MAX_DNR_RULES`); the DOM layer remains authoritative beyond that.
- Comment filtering requires comments to be rendered.
- In-menu blocking is desktop-only and relies on YouTube's menu DOM; it may be affected by YouTube layout changes.
- BlockTube imports map filter lists, the Trending/Shorts toggles and the block message. BlockTube-only features (duration filters, advanced JavaScript blocking, autoplay/mix/movie options) are not imported and are listed in the import report.

## License

[GNU GPL-3.0](LICENSE).
