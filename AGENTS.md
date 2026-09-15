# Agent Directives

## Project Specifics

- Name: YouTube Blocker
- Description: MV3 WebExtension that blocks YouTube videos, channels, users, Shorts and comments. DOM/CSS-first with declarativeNetRequest for direct navigation; no vendored YouTube internals or MAIN-world monkey-patching.
- Tech: TypeScript, esbuild, Vitest, Chrome/Firefox Manifest V3.

### Key Files

- `src/shared/matcher.ts` — URL parsing and rule matching (pure, unit-tested).
- `src/shared/dnr.ts` — generates declarativeNetRequest rules from state.
- `src/shared/storage.ts` — rule model, defaults, normalization.
- `src/content/content.ts` — MutationObserver + CSS filtering engine.
- `src/background/service-worker.ts` — keeps DNR rules in sync with storage.
- `src/options/options.ts` — settings UI controller.
- `esbuild.config.mjs` — build/packaging for both browsers.
- `tests/` — Vitest suites for the pure logic.

### Workflow

- Install: `npm install` (or `bun install`)
- Dev: `npm run watch`
- Test: `npm test`
- Typecheck: `npm run typecheck`
- Build: `npm run build` (or `npm run build:chrome` / `npm run build:firefox`)
- Lint/Format: not configured.

### Common Patterns

- Add a filter type: extend `FilterRules` in `src/shared/types.ts`, add a default in `src/shared/storage.ts`, add matcher logic in `src/shared/matcher.ts`, then declare it in `FILTER_LISTS` in `src/options/options.ts`.
- Add a content area: extend `AreaFlags`, wire an `AREA_CLASSES` entry in `src/content/content.ts` and a selector in `src/content/content.css`; use `NAVIGABLE_AREAS` for redirect-style areas.
- Add a browser: add `manifests/<browser>.json` and add the name to `SUPPORTED` in `esbuild.config.mjs`.
- State access: load via `loadState()` / persist via `saveState()` in `src/shared/state.ts`; never write `chrome.storage` directly.

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
