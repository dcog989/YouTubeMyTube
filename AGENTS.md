# Agent Directives

## Project Specifics

- Name: YouTubeMyTube
- Description: MV3 WebExtension that blocks YouTube videos, channels, users, Shorts and comments. DOM/CSS-first with declarativeNetRequest for direct navigation; no vendored YouTube internals or MAIN-world monkey-patching.
- Tech: TypeScript, esbuild, Vitest, Chrome/Firefox Manifest V3.

### Architecture

Two layers, no page injection:

1. `declarativeNetRequest` rules (generated from state) redirect direct navigation to blocked videos, channels, handles and area pages. The background service worker reconciles them on every state change.
2. A content script (isolated world) applies CSS classes and a `MutationObserver` to hide matching cards, channels and comments, and handles SPA navigation that DNR cannot see.

URL parsing (`url.ts`), pattern utilities (`patterns.ts`), rule matching/area routing (`match.ts`) and rule lookups/compilation (`rules.ts`) live in `src/shared/`; all are pure and unit-tested. The rule model (entity rows plus pattern lists), area definitions, reason wire format, lookup/URL resolution and DNR generation are also in `src/shared/`. Content-script concerns are split under `src/content/` (wiring, filtering, areas, evaluation, menu).

### Key Files

- `src/shared/url.ts` — YouTube URL/host parsing and handle normalization (pure, unit-tested).
- `src/shared/patterns.ts` — filter-pattern parsing/compilation and active-entry helpers (pure, unit-tested).
- `src/shared/match.ts` — entity matching and area-redirect routing (pure, unit-tested).
- `src/shared/rules.ts` — rule lookups, mutations (`add`/`remove` video/channel, `channelMatches`) and `compileRules` shared by the UI surfaces (pure, unit-tested).
- `src/shared/filters.ts` — pattern-filter metadata (`channelFilters` / `titleFilters` / `commentFilters`) used by the options UI.
- `src/shared/areas.ts` — content-area definitions and path mapping.
- `src/shared/reason.ts` — per-kind reason registry (`REASONS`): wire format (format/parse), copy (label/detail), rule refs and entity URLs.
- `src/shared/dnr.ts` — generates declarativeNetRequest rules from state and wraps the dynamic-rule API.
- `src/shared/storage.ts` — rule model, defaults, normalization (entity rows + pattern lists, deduplicated).
- `src/shared/storage-ext.ts` — thin `chrome.storage.local` get/set wrappers.
- `src/shared/state.ts` — load/save/ensure the blocker state, serialized `mutateState` and `onLocalStorageChanged`.
- `src/shared/rules-service.ts` — transactional block/unblock operations (`blockVideo`/`blockChannel`/`unblockReason`) used by the UI surfaces.
- `src/shared/runtime.ts` — `chrome.runtime` wrappers (extension URL, sync request, options page).
- `src/shared/tabs.ts` — `chrome.tabs` wrappers (active tab, tab messaging).
- `src/shared/blocktube.ts` — BlockTube backup parsing and additive merge (pure, unit-tested).
- `src/shared/resolve.ts` — parses pasted URLs/IDs/handles and looks up channel metadata and video titles.
- `src/shared/unblock.ts` — maps exact block reasons back to removals.
- `src/shared/navigation.ts` — builds YouTube entity URLs from block reasons.
- `src/content/content.ts` — content-script wiring (state lifecycle, observer, messaging).
- `src/content/entity-selectors.ts` — YouTube DOM selector data (`CARD_SELECTOR`, `COMMENT_SELECTOR`, `HIDDEN_CLASS`).
- `src/content/entity.ts` — entity extraction from cards, comments and the current page.
- `src/content/filter.ts` — card/comment DOM filtering engine.
- `src/content/menu.ts` + `src/content/menu/` — in-page menu injection.
- `src/background/service-worker.ts` — keeps DNR rules in sync with storage.
- `src/options/options.ts` + `src/options/` — settings UI, split into entry point, state store, panel modules (channels/videos/areas/patterns), tester, import/export and metadata backfill.
- `esbuild.config.mjs` — build/packaging for both browsers.
- `scripts/manifest-check.mjs` — validates the shared fields of the Chrome/Firefox manifests (`validateManifests`).
- `scripts/zip.mjs` — dependency-free ZIP writer for the store archives (`createZip`).
- `scripts/source-zip.mjs` — packages git-tracked files into the AMO review source archive (`createSourceZip`).
- `scripts/install-hooks.mjs` — installs lefthook hooks via `prepare`, skipping when there is no `.git` (source archive builds).
- `scripts/sync-version.mjs` — writes cog's target version into `package.json` (the build's version source).
- `scripts/gen-icons.mjs` — generates the PNG icons from a vector description.
- `tests/` — Vitest suites for the pure logic (`vitest.config.ts` limits the run to this directory).
- `e2e/extension.spec.ts` — Playwright smoke test that loads `dist/chrome` and asserts the background service worker starts (`playwright.config.ts`).
- `.github/workflows/ci.yml` — CI: install, check, typecheck, unit tests with coverage thresholds, build, `web-ext lint`, `bun audit`, artifacts, e2e.
- `.github/workflows/release.yml` — tag-triggered AMO/Chrome Web Store publish and GitHub Release.
- `.github/dependabot.yml` — GitHub Actions version updates (npm/bun deps are updated locally).

### Workflow

- Install: `npm install` (or `bun install`); runs `prepare` → installs lefthook git hooks.
- Dev: `npm run watch` (rebuilds bundles and re-copies HTML/CSS/manifests on change).
- Test: `npm test` (or `npm run test:coverage`, whose thresholds CI enforces); e2e: `npm run test:e2e` after `npm run build:chrome` and `bunx playwright install chromium`.
- Typecheck: `npm run typecheck` (or `npm run typecheck:watch` alongside `npm run watch`); `checkJs` covers the `.mjs` build scripts too.
- Build: `npm run build` (or `npm run build:chrome` / `npm run build:firefox`); validates manifest drift and writes store zips plus the AMO source archive to `dist/`. Set `SOURCE_DATE_EPOCH` for reproducible archives.
- Lint: `npm run check` (Biome, HTML included; `npm run check:fix` to write). Config: `biome.json`. Firefox validation: `npm run lint:webext` (`web-ext lint`).
- Release: `npm run release` (`cog bump --auto`); `cog.toml` runs `scripts/sync-version.mjs` so `package.json` is bumped with the tag before the version commit. Pushing the tag publishes via `release.yml` (secrets listed in `README.md`).
- Commit messages: Conventional Commits, enforced by lefthook + cocogitto (`cog.toml`). Cocogitto is a system binary, not an npm dependency.

### Common Patterns

- Add a pattern filter: add an entry to `PATTERN_FILTERS` in `src/shared/filters.ts`, add the field to `FilterRules` in `src/shared/types.ts`, compile it in `compileRules`, match it in `matchEntity`, and render it in `src/options/options.ts`. Entity rows (channels/videos) are edited in the options tables; their exact fields are compiled into the `CompiledRules` sets.
- Add a content area: add an entry to `AREA_DEFINITIONS` in `src/shared/areas.ts` (keys, flags, redirect set and classes are derived from it) and add a matching selector to `src/content/content.css`.
- Add a reason kind: add an entry to `REASONS` in `src/shared/reason.ts` (wire pattern, format, optional label/detail, rule ref and entity URL); `ReasonKind`, `formatReason`, `parseReason`, `reasonLabel`, `reasonDetail`, `ruleRefForReason` and `entityUrlForReason` all derive from it.
- Add a browser: add `manifests/<browser>.json` and add the name to `SUPPORTED` in `esbuild.config.mjs`.
- State access: load via `loadState()` in `src/shared/state.ts`; mutate via `mutateState()` or the `src/shared/rules-service.ts` operations; never write `chrome.storage` directly.

### Filter Syntax

One entry per line. Keywords match case-insensitively as substrings; `/pattern/flags` entries are treated as regular expressions. Lines starting with `//` are ignored. Global/sticky (`g`/`y`) flags are stripped before compiling.

### Known Limitations

- DOM filtering can briefly render content before it is hidden; the network layer covers direct navigation instead.
- Cold direct navigation to blocked content redirects to the block page (`declarativeNetRequest`); the in-page full-screen channel overlay and player blanking apply to in-page/SPA navigation.
- The `declarativeNetRequest` layer is capped at the browser's regex-rule limit (`MAX_DNR_REGEX_RULES`); overflow is surfaced in the options UI and enforced in-page by the content script.
- Comment filtering requires comments to be rendered.
- In-menu blocking is desktop-only and relies on YouTube's menu DOM; it may be affected by YouTube layout changes.
- BlockTube imports map filter lists and the Trending/Shorts toggles. BlockTube-only features (duration filters, advanced JavaScript blocking, autoplay/mix/movie options, the block message) are not imported and are listed in the import report.

### File System Access

- Allowed: project root and all contained directories + files; `/tmp/*`.
- Read-Only: `.env*`, `.git/`.
- Disallowed: everything not listed in 'Allowed' unless user grants permission.
- Require confirmation: adding/removing dependencies, any operation outside project root.
- Do not delete files or make destructive changes without permission / confirmation.

---

## General Guidelines

### Code Changes

- For non-trivial work, propose an approach and confirm before implementing.
- Keep modifications minimal and scoped; prefer incremental improvements over rewrites. Ask before architectural changes.
- Use explicit types and named constants (no magic numbers).
- Return explicit error types; do not suppress exceptions.
- Follow standard repository linting and formatting configs.
- Decompose files over 400 lines if they mix concerns.
- Use clear naming over comments; reserve comments for complex workarounds or non-obvious issues — why, not what.
- Never run git mutations (commit, push, reset, rebase, amend) unless explicitly instructed.
- Do not create documentation files unless explicitly requested.

### Verification

- Do not run test, lint, format, or type-check commands; the user builds, tests, and lints manually.
- Run them only when the user explicitly asks.

### Author Environment

- CachyOS, KDE Plasma 6, Wayland, Btrfs.
- fish shell, Ghostty terminal, Fresh TUI editor, yay package manager, bun npm manager, Firefox, and Zed code editor.

### Testing

- Do not create test files for trivial changes, or for behavior that is not reliably unit-testable in the test environment (e.g. UI layout/click mapping). Prefer no new files; only add a test when the logic is genuinely testable and worth guarding.

### Definition of Done

- Logic fully implemented.
- Existing docs updated if public interfaces changed.
- When required by the `Verification` rules, run the corresponding `Workflow` command.
- On completion of an update or fix, print a concise conventional commit message in a fenced code block.

### Communication Style

- Provide concise, actionable responses.
- Ask clarifying questions when requirements are ambiguous.
- Flag potential risks or edge cases proactively.
- Do not pretend to understand how the user feels.
- Never editorialise your answer. No "to be honest", "honestly", hedging, disclaimers, or meta-commentary — just answer.
