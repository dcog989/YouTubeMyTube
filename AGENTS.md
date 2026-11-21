# Agent Directives

## Project Specifics

- Name: YouTubeMyTube
- Description: MV3 WebExtension that blocks YouTube videos, channels, users, Shorts and comments. DOM/CSS-first with declarativeNetRequest for direct navigation; no vendored YouTube internals or MAIN-world monkey-patching.
- Tech: TypeScript, esbuild, Vitest, Firefox and Chrome Manifest V3.

### Architecture

Two layers, no page injection:

1. `declarativeNetRequest` rules (generated from state) redirect direct navigation to blocked videos, channels, handles and area pages. The background service worker reconciles them on every state change.
2. A content script (isolated world) applies CSS classes and a `MutationObserver` to hide matching cards, channels and comments, and handles SPA navigation that DNR cannot see.

URL parsing (`url.ts`), pattern utilities (`patterns.ts`), rule matching/area routing (`match.ts`) and rule lookups/compilation (`rules.ts`) live in `src/shared/`; all are pure and unit-tested. The rule model (entity rows plus pattern lists), area definitions, reason wire format, lookup/URL resolution and DNR generation are also in `src/shared/`. Content-script concerns are split under `src/content/` (wiring, filtering, areas, evaluation, menu).

### Key Files

- `src/shared/url.ts` — YouTube URL/host parsing and handle normalization (pure, unit-tested).
- `src/shared/patterns.ts` — filter-pattern parsing/compilation and active-entry helpers (pure, unit-tested).
- `src/shared/match.ts` — entity matching and area-redirect routing (pure, unit-tested).
- `src/shared/rules.ts` — rule lookups, mutations (`add`/`remove` video/channel, `channelMatches`), the `isChannelComplete` entry-completion predicate and `compileRules` shared by the UI surfaces (pure, unit-tested).
- `src/shared/filters.ts` — pattern-filter keys (`channelFilters` / `titleFilters` / `commentFilters`); display copy lives in `src/options/copy.ts`.
- `src/shared/areas.ts` — content-area behavior as a `mode: 'redirect' | 'hide'` union (redirect paths vs hide CSS classes); display copy lives in `src/options/copy.ts`.
- `src/shared/reason.ts` — per-kind reason registry (`REASONS`): wire format (format/parse), rule refs and entity URLs.
- `src/shared/reason-copy.ts` — UI copy for reasons (label/detail) keyed by `ReasonKind`, resolved through `t()`.
- `src/shared/i18n.ts` — `t(key, subs?)` (`browser.i18n` with an English `_locales/en` fallback) and `localizeDocument()` for `data-i18n` / `data-i18n-attr` markup.
- `_locales/<lang>/messages.json` — per-locale message catalogs; `en` is `default_locale` and the source of truth for keys/placeholders.
- `src/shared/dnr.ts` — generates declarativeNetRequest rules from state and wraps the dynamic-rule API.
- `src/shared/defaults.ts` — default rules, areas, settings and state.
- `src/shared/normalize.ts` — state normalization and `ruleCount` (entity rows, pattern lists and enabled areas, deduplicated).
- `src/shared/storage-ext.ts` — thin `browser.storage.local` get/set wrappers.
- `src/shared/mutations.ts` — serializable `Mutation` union and the pure `applyMutation` reducer (single-writer protocol).
- `src/shared/state.ts` — load/save/ensure the blocker state and `onLocalStorageChanged`; only the service worker writes.
- `src/shared/backup.ts` — rolling backup of the last non-empty state (`shouldSnapshot`, `shouldSeedBackup`, `readBackup`/`writeBackup`); the worker seeds it on writes and the options page restores it.
- `src/shared/rules-service.ts` — transactional block/unblock operations (`blockVideo`/`blockChannel`/`unblockReason`) used by the UI surfaces.
- `src/shared/runtime.ts` — `browser.runtime` wrappers (extension URL, sync request, mutation request, options page).
- `src/shared/tabs.ts` — `browser.tabs` wrappers (active tab, tab messaging).
- `src/shared/blocktube.ts` — BlockTube backup parsing and additive merge (pure, unit-tested).
- `src/shared/resolve.ts` — parses pasted URLs/IDs/handles and looks up channel metadata, video titles and a video's channel (oEmbed); `resolveChannelMeta` is the unified channel-completion strategy (`id` → `handle` → name).
- `src/shared/unblock.ts` — maps exact block reasons back to removals.
- `src/shared/navigation.ts` — builds YouTube entity URLs from block reasons.
- `src/shared/ui.ts` — `byId` (lookup that throws when missing) and `h` (element builder) shared by the options, content and overlay code.
- `src/content/content.ts` — content-script wiring; owns the factory instances (playback guard, overlay feedback, evaluator, filter engine, menu injector) and threads their dependencies.
- `src/content/store.ts` — the content script's single state source (`getSnapshot`/`setState` + `store`); `content.ts` is the only storage listener.
- `src/content/batch.ts` — `createBatcher`/`createCoalescer` for coalescing DOM work (microtask or timed).
- `src/content/apply-areas.ts` — `applyAreas`: toggles the `AREA_DEFINITIONS` hide classes on `<html>` from the store snapshot.
- `src/content/observer.ts` — the shared `MutationObserver` hub: per-root listeners, added/changed element sets, `href`/`title`/`aria-label` attributes.
- `src/content/dom.ts` — shadow-DOM helpers (`eventTarget`, `closestAcrossShadow`, `hasAncestorIn`, `walkShadowRoots`).
- `src/content/playback.ts` — `createPlaybackGuard`, the ref-counted play listener/pause-all shared by the blank cover and channel overlay.
- `src/content/entity-selectors.ts` — YouTube DOM selector data (`CARD_SELECTOR`, `COMMENT_SELECTOR`, `HIDDEN_CLASS`).
- `src/content/entity.ts` — entity extraction from cards, comments and the current page.
- `src/content/filter.ts` — `createFilterEngine`: card/comment DOM filtering.
- `src/content/evaluate.ts` — `createEvaluator`: block routing and overlay/blank decisions.
- `src/content/overlay.ts` — `createBlankCover` / `createChannelOverlay` / `createOverlayFeedback`.
- `src/content/menu/index.ts` + `src/content/menu/` — `createMenuInjector`: in-page menu injection.
- `src/content/menu/channel-cache.ts` — capped oEmbed channel cache (100 entries, 4 concurrent lookups, 60 s retry on empty) that fills a card's missing channel identity.
- `src/popup/popup.ts` + `src/popup/` — toolbar popup: active-tab context, block/unblock of the current video or channel, blocking toggle.
- `src/blocked/blocked.ts` + `src/blocked/` — DNR redirect target: renders the block reason and offers unblock, back, home and options.
- `src/background/service-worker.ts` — the single writer: applies `MUTATE_REQUEST` mutations to storage and keeps DNR rules in sync.
- `src/options/options.ts` + `src/options/` — settings UI, split into entry point, state store, panel modules (channels/videos/areas/patterns), shared table (`entity-table.ts`), sorter (`sort.ts`), counters (`counts.ts`), status/panel plumbing (`dom.ts`), lookup guards (`lookup.ts`), external-change classification (`conflict.ts`), tester, import/export and metadata backfill.
- `esbuild.config.mjs` — build/packaging for Firefox and Chrome (bundles entries, copies HTML/CSS/manifests and `_locales/`).
- `scripts/zip.mjs` — dependency-free ZIP writer for the store archives (`createZip`).
- `scripts/source-zip.mjs` — packages git-tracked files into the AMO review source archive (`createSourceZip`).
- `scripts/install-hooks.mjs` — installs Lefthook hooks via `prepare`, skipping when there is no `.git` (source archive builds).
- `scripts/sync-version.mjs` — writes cog's target version into `package.json` (the build's version source).
- `scripts/gen-icons.mjs` — generates the PNG icons from a vector description.
- `tests/` — Vitest suites for the pure logic (`vitest.config.ts` limits the run to this directory).
- `.github/workflows/ci.yml` — CI: install, check, typecheck, unit tests with coverage thresholds, build, `web-ext lint`, `bun audit`, artifacts.
- `.github/workflows/release.yml` — tag-triggered GitHub Release (archives attached).
- `.github/dependabot.yml` — GitHub Actions version updates (npm/Bun deps are updated locally).

### Workflow

- Install: `npm install` (or `bun install`); runs `prepare` → installs Lefthook git hooks.
- Check: `just check` (Biome, typecheck, tests, build:firefox); `just lint-webext` runs `web-ext lint` (downloads web-ext).
- Dev: `just dev` (rebuilds bundles and re-copies HTML/CSS/manifests on change).
- Test: `just test` (Vitest; `npm run test:coverage` for the thresholds CI enforces).
- Typecheck: `npm run typecheck` (`bun --check`) or `npm run typecheck:watch` alongside `just dev`; `checkJs` covers the `.mjs` build scripts too.
- Lint: `just lint` (Biome, HTML included).
- Format: `just format` (Biome lint + format, writing fixes). Config: `biome.json`. Firefox validation: `just lint-webext` (`web-ext lint`).
- Build: `just build` (or `npm run build:firefox` / `npm run build:chrome`); writes the store zips plus the AMO source archive to `dist/`. Set `SOURCE_DATE_EPOCH` for reproducible archives.
- Clean: `just clean` (removes `dist`, `node_modules` and `bun.lock`).
- Release: `npm run release` (`cog bump --auto`); `cog.toml` runs `scripts/sync-version.mjs` so `package.json` is bumped with the tag before the version commit, then builds (`esbuild.config.mjs all`) and pushes. Pushing the tag publishes via `release.yml`; AMO upload is manual.
- Commit messages: Conventional Commits, enforced by Lefthook + Cocogitto (`cog.toml`). Cocogitto is a system binary, not an npm dependency.

### Common Patterns

- Add a pattern filter: add an entry to `PATTERN_FILTER_KEYS` in `src/shared/filters.ts`, add the field to `FilterRules` in `src/shared/types.ts`, compile it in `compileRules`, match it in `matchEntity`, and render it in the options HTML/textareas. Entity rows (channels/videos) are edited in the options tables; their exact fields are compiled into the `CompiledRules` sets.
- Add a content area: add a `mode: 'redirect'` entry (with `path`) or a `mode: 'hide'` entry (with `className`) to `AREA_DEFINITIONS` in `src/shared/areas.ts` (keys, flags and the redirect set are derived from it), add matching `AREA_COPY` in `src/options/copy.ts`, and add a selector in `src/content/content.css` for hide entries.
- Add a reason kind: add an entry to `REASONS` in `src/shared/reason.ts` (wire pattern, format, rule ref and entity URL) and matching `LABELS`/`DETAILS` in `src/shared/reason-copy.ts`; `ReasonKind`, `formatReason`, `parseReason`, `reasonLabel`, `reasonDetail`, `ruleRefForReason` and `entityUrlForReason` all derive from them.
- Add a UI string / locale: add the key to `_locales/en/messages.json`, mirror it in every other `_locales/<lang>/messages.json` (the `tests/i18n.test.ts` key/placeholder parity check enforces this), and resolve it via `t()` or `data-i18n`. Manifest name/description/title use `__MSG_*__`; the wire format in `src/shared/reason.ts` stays English.
- Display copy vs behavior: domain modules (`areas.ts`, `filters.ts`, `reason.ts`) hold behavior; user-facing strings are message keys resolved via `t()` from `_locales/<lang>/messages.json` (English is `default_locale`). Options markup uses `data-i18n` / `data-i18n-attr`; `src/options/copy.ts` and `src/shared/reason-copy.ts` map events/reasons to message keys.
- Add a browser: add `manifests/<browser>.json` and add the name to `SUPPORTED` in `esbuild.config.mjs`.
- State access: load via `loadState()` in `src/shared/state.ts`; mutate via `requestMutation()` (`src/shared/runtime.ts`) or the `src/shared/rules-service.ts` operations; the worker applies them with `applyMutation` (`src/shared/mutations.ts`). Never write `browser.storage` directly (only the service worker calls `saveState`).

### Filter Syntax

One entry per line. Keywords match case-insensitively as substrings; `/pattern/flags` entries are treated as regular expressions. Lines starting with `//` are ignored. Global/sticky (`g`/`y`) flags are stripped before compiling.

### Known Limitations

- DOM filtering can briefly render content before it is hidden; the network layer covers direct navigation instead.
- Cold direct navigation to blocked content redirects to the block page (`declarativeNetRequest`); the in-page full-screen channel overlay and player blanking apply to in-page/SPA navigation.
- The `declarativeNetRequest` layer is capped by the browser's regex-rule and total-rule limits (`MAX_DNR_REGEX_RULES` / `MAX_DNR_RULES`); overflow is surfaced in the options UI and enforced in-page by the content script.
- Comment filtering requires comments to be rendered.
- In-menu blocking relies on YouTube's menu DOM (desktop popup, mobile bottom sheet) and may be affected by YouTube layout changes. The mobile sheet does not handle Escape, so it stays open after a block until dismissed manually.
- Watch-page related cards (`yt-lockup-view-model`) expose no channel link or ID, so the menu resolves the channel from the video's oEmbed metadata and falls back to the exact display name if that lookup fails.
- Shorts lockups (`ytm-shorts-lockup-view-model`, reel items) expose no channel link, name or ID either, so a blocked channel's shorts in a feed are hidden only after an oEmbed lookup resolves the video's channel; if that lookup is rate-limited or offline the short stays visible until it is opened.
- BlockTube imports map filter lists and the Trending/Shorts toggles. BlockTube-only features (duration filters, advanced JavaScript blocking, autoplay/mix/movie options, the block message) are not imported and are listed in the import report.
- On `music.youtube.com` the content script loads, but its in-page filter matches the `ytd-*` / `ytm-*` YouTube DOM. Music's `ytmusic-*` cards are not filtered in place; only direct-navigation redirects (`declarativeNetRequest`) apply.

### File System Access

- Allowed: project root and all contained directories + files; `/tmp/*`.
- Read-Only: `.env*`, `.git/`, `.docs`.
- Disallowed: everything not listed in 'Allowed' unless user grants permission.
- Require confirmation: adding/removing dependencies, any operation outside project root.
- Do not delete files or make destructive changes without permission / confirmation.

---

## General Guidelines

### Code Changes

- For non-trivial work, propose an approach and confirm before implementing, including architectural changes.
- Keep modifications minimal and scoped; prefer incremental improvements over rewrites.
- Use explicit types and named constants (no magic numbers).
- Return explicit error types; do not suppress exceptions.
- Follow standard repository linting and formatting configs.
- Decompose files over 400 lines if they mix concerns.
- Name things clearly; reserve comments for the non-obvious why (workarounds, edge cases).
- Never run git mutations (commit, push, reset, rebase, amend) unless explicitly instructed.
- Do not create documentation files unless explicitly requested.
- Adhere to <https://develop.kde.org/hig/>.

### Author Environment

- Ryzen 5800X3D, Radeon RX 7900 XT, Display (AW3225QF); CachyOS, KDE, KWin / Wayland, Btrfs.
- fish shell, Ghostty terminal, Fresh TUI editor, yay package manager, bun npm manager, Firefox, Zed code editor.

### Testing

- Add tests only when the logic is genuinely testable and worth guarding. No test files for trivial changes or behavior the environment cannot test reliably (e.g. UI layout/click mapping).

### Definition of Done

- Logic fully implemented.
- Existing docs updated if public interfaces changed.
- Run the corresponding `Workflow` command when `Verification` requires it.

### Commit Messages

- On completion of an update or fix, print a conventional commit message in a fenced code block.
- Add a body only when the "why" isn't obvious.
- Never hard-wrap: one physical line per paragraph, however long.

### Communication Style

- Format: short declarative sentences, one idea per line.
- Instructions: numbered steps, one action each (exact command, path, or code); no prose recap.
- Explanations: essential context only. End question answers with `TL;DR:`, one sentence; omit for status updates and completed work.
- Tone: no preamble, restating, hedging, disclaimers, emotional framing, or closing offers. Keep every fact, command, flag, path, default, caveat.
- Edge Cases: state risks explicitly; ask when requirements are ambiguous.
