# YouTube Blocker

Manifest V3 WebExtension for Chrome and Firefox. Blocks videos, channels, users,
Shorts and comments on YouTube.

Built on a DOM/CSS-first architecture with `declarativeNetRequest` for direct
navigation. It does not depend on YouTube's internal renderer schemas or inject
into the page's JavaScript, which keeps it resilient to YouTube UI changes.

## Features

- Block videos by ID, channels by ID or handle, and channel names by keyword/regex.
- Block videos by title keyword/regex.
- Block comments by author or content.
- Block Shorts, including shelves and direct links.
- Optional content-area blocking (home feed, Trending, Explore, Subscriptions, comments, live chat, related videos).
- Direct navigation to blocked content redirects to a block page.
- Import/export settings; light/dark/system theme.
- Popup with a quick "block this video/channel" action.

## Install

Not published. Build and load unpacked:

```sh
npm install
npm run build
```

- Chrome: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome`.
- Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox/manifest.json`.

## Development

```sh
npm run watch        # rebuild on change (both browsers)
npm test             # Vitest unit tests
npm run typecheck    # tsc --noEmit
npm run build:chrome
npm run build:firefox
```

## Architecture

Two layers, no page injection:

1. `declarativeNetRequest` rules (generated from settings) redirect direct
   navigation to blocked videos, channels, handles and area pages. These are
   reconciled by the background service worker whenever state changes.
2. A content script (isolated world) applies CSS classes and a `MutationObserver`
   to hide matching cards, channels and comments. It also handles SPA navigation,
   which DNR cannot see.

Rule matching and URL parsing live in `src/shared/matcher.ts` and are pure and
unit-tested. The rule model and DNR generation are in `src/shared/`.

### Filter syntax

One entry per line. Keywords match case-insensitively as substrings; `/pattern/flags`
entries are treated as regular expressions. Lines starting with `//` are ignored.

## Limitations

- DOM filtering can briefly render content before it is hidden; the network layer
  covers direct navigation instead.
- The `declarativeNetRequest` rule count is capped (`MAX_DNR_RULES`); the DOM layer
  remains authoritative beyond that.
- Comment filtering requires comments to be rendered.

## License

GPL-3.0. See [LICENSE](LICENSE).
