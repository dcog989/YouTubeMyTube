# Changelog
All notable changes to this project will be documented in this file. See [conventional commits](https://www.conventionalcommits.org/) for commit guidelines.

- - -
## 0.4.0 - 2026-09-18
#### Features
- (**areas**) add site-wide promo banner hiding - (5946c77) - dcog989
#### Continuous Integration
- (**deps**) bump softprops/action-gh-release from 2 to 3 - (109ea93) - dependabot[bot]
- (**deps**) bump actions/upload-artifact from 5 to 7 - (5bac24b) - dependabot[bot]
- (**deps**) bump actions/checkout from 5 to 7 - (9a52eca) - dependabot[bot]
#### Miscellaneous Chores
- (**rebrand**) use lowercase npm package name - (2700ee2) - dcog989
- rebrand to YouTubeMyTube - (522a2e0) - dcog989

- - -

## 0.3.0 - 2026-09-18
#### Continuous Integration
- use native bun audit and bump actions to node24 releases - (62f95a5) - dcog989

- - -

## 0.2.5 - 2026-09-18
#### Bug Fixes
- (**evaluate**) stop double-matching video/channel/handle rules on navigation - (daec921) - dcog989
#### Performance Improvements
- (**content**) avoid intermediate arrays in shadow-root walkers - (0465911) - dcog989
#### Build system
- (**manifest**) require Firefox 142 for data collection permissions support - (0562623) - dcog989
- (**manifest**) declare no data collection for Firefox - (2f5ca10) - dcog989
- (**scripts**) fold typecheck and web-ext lint into the check script - (b279062) - dcog989
#### Continuous Integration
- (**deps**) add Dependabot config and drop unused Renovate config - (d00974a) - dcog989
#### Refactoring
- (**content**) split card visibility and shadow observation out of menu - (576e205) - dcog989
- (**content**) share a single MutationObserver hub across filter and menu - (873251b) - dcog989
- (**content**) remove dead channelName guard in currentContext - (904295b) - dcog989

- - -

## 0.2.4 - 2026-09-18
#### Continuous Integration
- (**release**) disable Chrome Web Store publishing until credentials exist - (305b297) - dcog989

- - -

## 0.2.3 - 2026-09-18
#### Continuous Integration
- (**release**) disable AMO signing until API credentials exist - (ab10f4e) - dcog989

- - -

## 0.2.2 - 2026-09-18
#### Continuous Integration
- (**release**) guard AMO secrets and bump checkout to v5 - (0d734a1) - dcog989

- - -

## 0.2.1 - 2026-09-18
#### Build system
- (**release**) push branch and tag from cog post-bump hooks - (bcac5d0) - dcog989

- - -

## 0.2.0 - 2026-09-17
#### Continuous Integration
- add verify/e2e pipeline and tag-triggered store publishing - (be6a900) - dcog989
#### Miscellaneous Chores
- (**test**) enforce coverage thresholds and type-check build scripts - (eeeba23) - dcog989

- - -

## 0.1.0 - 2026-09-17
#### Features
- (**content**) full-screen channel overlay, video blanking, and split block behavior - (1cb8942) - dcog989
- (**content**) add block video/channel actions to YouTube overflow menus - (6f40d59) - dcog989
- (**options**) use the extension icon as the settings page favicon - (e35c15d) - dcog989
- (**options**) add BlockTube import and fix DNR/redirect gaps - (37b66b3) - dcog989
- scaffold MV3 YouTube blocker with DOM/DNR architecture - (2037389) - dcog989
#### Bug Fixes
- (**build**) regenerate icons when any size is missing - (f17302c) - dcog989
- (**content**) use undefined instead of void in forEachShadowRoot callback - (4bfb01a) - dcog989
- (**content**) apply blocked-video handling to embed pages - (24185e3) - dcog989
- (**content**) redirect watch pages whose channel is blocked - (315c88c) - dcog989
- (**dnr**) match video/channel ids case-sensitively - (20a03e5) - dcog989
- (**manifest**) pin minimum_chrome_version to the build target - (04f95be) - dcog989
- (**matcher**) handle malformed percent-encoding in URL handles - (2cd4be7) - dcog989
- (**matcher**) strip stateful g/y flags from user regex patterns - (887936e) - dcog989
- (**menu**) prune detached cards from hidden-card set - (d4dcd8e) - dcog989
- (**options**) grow filter textareas to content and stop duplicating channel names into comment authors - (3e5ecb0) - dcog989
- (**popup**) normalize handle comparisons when checking blocked state - (f040ad4) - dcog989
- (**unblock**) normalize handle comparison when removing rules - (da2c55b) - dcog989
#### Performance Improvements
- (**content**) throttle blocking evaluation on DOM mutations - (2457ca7) - dcog989
- (**entity**) early-exit shadow anchor and metadata scans - (34d0e52) - dcog989
- (**options**) use dirty flag and throttle textarea autosize - (bb2b0f4) - dcog989
- (**overlay**) cache resolved player box for cover positioning - (dce1bda) - dcog989
#### Documentation
- (**agents**) refresh key files after module splits - (297e922) - dcog989
- (**readme**) note filter registry and area definitions - (89e4514) - dcog989
- move technical sections from readme to agents - (5343468) - dcog989
- readme format - (4d92780) - dcog989
- readme refined - (042caef) - dcog989
#### Build system
- (**release**) sync package.json version from cog bump - (19f53e9) - dcog989
- (**watch**) re-copy static assets and manifests on change - (ea42516) - dcog989
- validate manifest drift and emit store zips - (dc89485) - dcog989
#### Refactoring
- (**areas**) centralize area definitions - (a5a000d) - dcog989
- (**blocktube**) drop unused import total field - (543d3bf) - dcog989
- (**content**) split content script into focused modules - (867936a) - dcog989
- (**content**) extract shared shadow-dom traversal helpers - (23e7b22) - dcog989
- (**filters**) drive compilation, matching, and options UI from a registry - (4dd2ffe) - dcog989
- (**matcher**) drop unused CompiledRules.isEmpty - (c242d80) - dcog989
- (**menu**) remove unreachable per-item click handler - (8957f19) - dcog989
- (**menu**) split menu injection into focused modules - (1b2f2d2) - dcog989
- (**reason**) centralize block-reason formatting and parsing - (fb09edc) - dcog989
- (**storage**) drop unused state version field - (0081a2f) - dcog989
- (**storage**) derive filter rule keys from a single list - (a8a7658) - dcog989
- (**storage**) use STATE_KEY constant for storage change lookups - (ad79a2e) - dcog989
- (**theme**) extract shared applyTheme helper - (7550029) - dcog989
- (**types**) drop unused CompiledPattern.raw field - (5d50e49) - dcog989
- (**ui**) extract shared byId helper - (e5f2685) - dcog989
#### Miscellaneous Chores
- (**lint**) format HTML with Biome and typecheck on pre-commit - (7911b30) - dcog989
- (**scripts**) add typecheck:watch - (ee0fc82) - dcog989
- (**tooling**) add biome, lefthook and cocogitto config - (8d69206) - dcog989
- updates - (82d74be) - dcog989
- lock biome to node - (c7cbb53) - dcog989
- updates - (b8b4ab3) - dcog989
- biome format - (a0c917e) - dcog989
- update again, clean package-lock - (33f8920) - dcog989
- updates, package.json scripts - (4eef4d3) - dcog989
#### Style
- (**options**) place save button on the panel title row - (409c187) - dcog989
- (**options**) center the settings layout and header - (f87a193) - dcog989
- (**options**) align header to the layout columns and drop content max-width - (b2743b5) - dcog989

- - -

Changelog generated by [cocogitto](https://github.com/cocogitto/cocogitto).