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
- Blocked channels show a full-screen overlay when you visit the channel or watch one of its videos, showing the channel name/ID, a YouTube home link and a "Remove from blocklist" button.
- Blocked videos just blank the player (or hide the card), leaving the page usable.
- Popup with a quick "block this video/channel" action.
- "Block video" / "Block channel" entries injected into YouTube's own `...` menus on video cards and the watch-page action bar; these become "Unblock ..." when the item is already blocked.
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

## Package

`bun run build` also writes store-ready archives to `dist/youtube-blocker-chrome.zip` and `dist/youtube-blocker-firefox.zip`. The build fails if the shared fields in `manifests/chrome.json` and `manifests/firefox.json` drift.

## License

[GNU GPL-3.0](LICENSE).
