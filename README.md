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
bun run watch             # rebuild JS + copy HTML/CSS/manifests on change (both browsers)
bun run test              # Vitest unit tests
bun run test:coverage     # Vitest with coverage report
bun run test:e2e          # Playwright extension smoke test (needs dist/chrome)
bun run typecheck         # tsc --noEmit
bun run typecheck:watch   # continuous type-check (run alongside watch)
bun run check             # Biome lint + format check
bun run check:fix         # Biome lint + format, writing fixes
bun run lint:webext       # web-ext lint on dist/firefox
bun run build:chrome
bun run build:firefox
bun run release           # cog bump --auto: tag + changelog, syncs package.json
```

`bun run test:e2e` needs the Playwright Chromium build once: `bunx playwright install chromium`.

`bun install` runs `prepare`, which installs the [lefthook](https://lefthook.dev) git hooks. The `pre-commit` hook runs Biome against staged files and a full `tsc --noEmit` type-check, and the `commit-msg` hook enforces [Conventional Commits](https://www.conventionalcommits.org) via [cocogitto](https://docs.cocogitto.io) (`cog`). Cocogitto is a system binary, not an bun dependency; install it separately (e.g. `pacman -S cocogitto`, `cargo install cocogitto`, or your package manager).

## Package

`bun run build` also writes store-ready archives to `dist/youtube-blocker-chrome.zip` and `dist/youtube-blocker-firefox.zip`. The build fails if the shared fields in `manifests/chrome.json` and `manifests/firefox.json` drift.

Set `SOURCE_DATE_EPOCH` for byte-reproducible archives, e.g. `SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) bun run build`.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests: frozen install, `check`, `typecheck`, unit tests with coverage thresholds, build, `web-ext lint`, `bun audit`, and artifact upload, followed by a Playwright smoke test that loads `dist/chrome` in Chromium and asserts the background service worker starts.

## Release and publishing

`bun run release` (`cog bump --auto`) bumps `package.json` and tags the version. Pushing the tag triggers `.github/workflows/release.yml`, which rebuilds both browsers and publishes:

- Firefox: `web-ext sign --channel listed` to AMO.
- Chrome: `chrome-webstore-upload-cli` upload, then publish.
- Both archives are attached to the GitHub Release.

Required repository secrets: `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`, `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`.

Both stores require the extension to already exist: AMO needs the `browser_specific_settings.gecko.id` from `manifests/firefox.json` registered, and Chrome needs the extension created in the developer dashboard.

## License

[GNU GPL-3.0](LICENSE).
