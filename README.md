# YouTubeMyTube

Firefox extension that blocks YouTube videos, channels, users, Shorts, comments.

[Install from AMO](https://addons.mozilla.org/en-GB/firefox/addon/youtubemytube/)

![screenshot](assets/screen-1.webp)

## Features

- Block channels by ID, handle or name.
- Block videos by ID or title.
- Block comments by author or content.
- Block content-areas: home feed, Shorts, Trending, Explore, Subscriptions, comments, live chat.
- Block/Unblock entries via YouTube `...` menus or Firefox toolbar popup.
- Import/export settings; supports BlockTube backups.
- Light/Dark/System theming.

## Privacy

YouTubeMyTube collects no personal data and sends nothing to the developer. Settings are stored locally and the only network requests go directly to YouTube to resolve public metadata. See [PRIVACY.md](PRIVACY.md).

---

## Technical

### Architecture

Manifest V3, DOM/CSS-first, with `declarativeNetRequest` for direct navigation. The extension relies on pre-compiled sets and CSS classes rather than YouTube's internal renderer schemas or page-level JavaScript injection, so it stays fast and resilient to YouTube UI changes.

- **Constant-time lookups.** IDs, handles and names are compiled into sets and checked in one step; performance doesn't degrade as the blocklist grows.
- **Batched DOM work.** Page changes are collapsed into a single pass, processed nodes are skipped, and hiding is a single CSS class rather than per-element style writes.
- **Bounded matching.** Regex only runs on capped text fields, so it can't be used as a performance footgun.
- **Serialized writes.** A single service worker is the only writer, and redundant rule updates are diffed away.
- **No internals.** No JavaScript injection or network interception, so there's no per-response parsing and less to break.

### Development

```sh
bun run watch       # rebuild JS and copy static assets on change
bun run test        # Vitest unit tests
bun run check       # Biome + typecheck + build:firefox + web-ext lint
bun run check:fix   # Biome lint + format, writing fixes
```

[Conventional Commit](https://www.conventionalcommits.org) with `cog bump --auto`; bumps version and creates the tag.

### Building from source

```sh
git clone https://github.com/dcog989/YouTubeMyTube
cd YouTubeMyTube
bun install --frozen-lockfile
bun run build      # store + source archives; build:firefox omits them
```

This writes the unpacked extension to `dist/firefox/`, the store archive to `dist/youtubemytube-firefox.zip` and the AMO source archive to `dist/youtubemytube-source.zip`.

Temporary load it in Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on.

### Release and publish

Pushing a version tag triggers the release workflow, which rebuilds the archives and attaches them to a GitHub Release. Upload the built archive to AMO manually.

---

## License

[GNU GPL-3.0](LICENSE).
