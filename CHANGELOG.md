# Changelog
All notable changes to this project will be documented in this file. See [conventional commits](https://www.conventionalcommits.org/) for commit guidelines.

- - -
## 0.16.1 - 2026-10-03
#### Bug Fixes
- (**match**) hide comments authored by blocked channels - (ec540bd) - dcog989
- (**match**) hide name-only cards for channels blocked with a resolved id - (7f7cfa4) - dcog989
- (**popup**) let a channel name alone enable and drive the channel block - (155d155) - dcog989
- (**rules**) fall back to channel name when the lookup is name-only - (72b6fc6) - dcog989
- (**unblock**) offer remove for channels matched by display name - (9fe381b) - dcog989
#### Continuous Integration
- (**release**) build release body from cog changelog - (72f7d7b) - dcog989

- - -

## 0.16.0 - 2026-10-03
#### Features
- (**options**) add a discard changes button beside save - (bef907f) - dcog989
- (**options**) pulse the save button when changes activate it - (c28c077) - dcog989
#### Bug Fixes
- (**content**) catch late hydration, page titles and recycled-card changes - (bf475b6) - dcog989
- (**content**) pick menu owner from active trigger and last target - (54fabb8) - dcog989
- (**content**) back off repeated failed channel lookups in menu - (2c44566) - dcog989
- (**content**) remove ytb-blank-player class in blank cover clear - (d700910) - dcog989
- (**content,shared**) scope shorts context, upgrade name-only channels, recover DNR sync, keep filter comments - (380559c) - dcog989
- (**options**) keep changes dirty and report when save fails - (9ac02aa) - dcog989
- (**options**) stage reset as draft instead of committing defaults - (024061e) - dcog989
- (**options**) keep onboarding dismissed when importing a backup - (358a690) - dcog989
#### Performance Improvements
- (**content**) fast-path channel hrefs and dedupe nested card entities - (16374fc) - dcog989
- (**dnr**) use urlFilter for channel id and handle rules to spare the regex cap - (4c322e6) - dcog989
- (**match**) slice pattern input once before testing - (84eb685) - dcog989
- (**menu**) skip owner lookup when no menu containers batched - (2cf7a0d) - dcog989
- (**options**) debounce pattern warning and DNR count recomputation - (061e71d) - dcog989
- (**overlay**) resolve player box light-DOM-first before shadow walks - (a0ddc0c) - dcog989
#### Documentation
- readme more refined - (6e8fcef) - dcog989
- readme refined - (c6ada1a) - dcog989
- correct and condense readme - (2380f3a) - dcog989
- add amo links to readme - (a392fb6) - dcog989
#### Continuous Integration
- (**release**) remove disabled AMO signing step - (8cfe529) - dcog989
#### Miscellaneous Chores
- remove release script - (715fefb) - dcog989
- update screenshots - (8fbeaea) - dcog989
#### Style
- (**options**) reorder onboarding help/btn overrides after base rules - (371b08a) - dcog989

- - -

## 0.15.1 - 2026-10-02
#### Bug Fixes
- (**normalize**) normalize channel handles on state load - (e34d84e) - dcog989

- - -

## 0.15.0 - 2026-10-02
#### Features
- (**options**) add one-time first-run onboarding callout - (1fb380b) - dcog989
- (**options**) warn before closing with unsaved changes - (b9db66e) - dcog989
- (**options**) warn when invalid regex patterns are ignored - (1d7d6cf) - dcog989
- (**options**) replace channel/video help text with instructional placeholders - (dc0f4e6) - dcog989
#### Bug Fixes
- (**backfill**) resolve id-less channel entries via shared completion - (22dae36) - dcog989
- (**background**) compare full DNR rules keyed by id - (149dd44) - dcog989
- (**content**) bound channel cache and skip lookups for known handles - (0fa94e2) - dcog989
- (**dnr**) percent-encode handles in redirect patterns - (4800cc6) - dcog989
- (**menu**) prefer the expanded trigger as the menu owner - (19f02ce) - dcog989
- (**menu**) resolve channel id for cards that expose a handle - (6288039) - dcog989
- (**options**) seed savedSnapshot when loading the initial state - (d707995) - dcog989
- (**options**) keep async lookups on the live draft - (31ae164) - dcog989
- (**options**) remove entity rows by identity, not fuzzy lookup - (7c3679e) - dcog989
- (**resolve**) retry transient lookups and unescape search names - (0db30ae) - dcog989
- (**resolve**) only trust channel search hits whose name matches - (c01d98f) - dcog989
- (**rules**) stop treating channel display names as identifiers - (77711f7) - dcog989
- (**state**) route mutations through the service worker as single writer - (e135d0d) - dcog989
- (**state**) abort writes and DNR sync on a missing storage key - (988d089) - dcog989
- (**url**) accept youtu.be short links in parseYouTubeUrl - (a4bf082) - dcog989
#### Performance Improvements
- (**content**) drop duplicate root handling in processSubtree - (7e3c43c) - dcog989
- (**content**) attach menu shadow observers only on trigger presses - (065f3f5) - dcog989
- (**content**) stop card anchor scan once channel identity is known - (7430449) - dcog989
- (**content**) resolve card title with a single shadow walk - (4cbe740) - dcog989
#### Documentation
- add screenshot to readme - (0bb1afb) - dcog989
#### Refactoring
- (**content**) lazily resolve card channel name fallback - (6408f67) - dcog989
- (**dnr**) derive build and count from one rule plan - (ea97ffb) - dcog989
- (**normalize**) extract isRecord/pickString/pickBoolean helpers - (4fa6f2b) - dcog989
- (**options**) extract pure applyResolvedMeta from addChannel - (ee5214b) - dcog989
- (**popup**) route enabled toggle through rules-service setEnabled - (3faac70) - dcog989
- (**shared**) unify rule counting in summarizeRules - (ddc491e) - dcog989
- relocate activePanel to dom and consolidate popup context state - (bb5dd21) - dcog989
- simplify content plumbing, batching and i18n typing - (a49ada3) - dcog989
- remove dead branches in evaluate, match and popup - (9503787) - dcog989

- - -

## 0.14.4 - 2026-10-02
#### Bug Fixes
- (**options**) fall back to name search for bare channel tokens - (591b333) - dcog989
- (**options**) stop backfill loop on unresolvable entries - (4f0f1e5) - dcog989
- (**popup**) refresh local state after toggling enabled - (df6b8ae) - dcog989
- (**rules**) remove the strongest channel match by id, handle, then name - (f16c624) - dcog989
- (**rules**) normalize handles when compiling rules - (58835aa) - dcog989
- (**theme**) default palette follows the OS to avoid a light flash - (d99ce02) - dcog989
#### Performance Improvements
- (**content**) fast-path menu label lookup before full subtree scan - (ef4d7d4) - dcog989
- (**match**) normalize entity handles once per match - (82e227d) - dcog989
- (**options**) count DNR rules without building them on each keystroke - (fe69d9d) - dcog989
#### Refactoring
- (**blocktube**) merge pattern lists by iterating filter keys - (114512e) - dcog989
- (**content**) split menu injector into owner and inject modules - (0d0fba1) - dcog989
- (**content**) pass the store into applyAreas - (1394830) - dcog989
- <span style="background-color: #d73a49; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 0.85em;">BREAKING</span>(**firefox**) drop Chrome target and migrate to browser.* API - (5dc17fd) - dcog989
- (**options**) share a generic entity table sorter - (e0239e8) - dcog989
- (**scripts**) share the CRC32 helper between zip writers - (d10e28e) - dcog989
#### Miscellaneous Chores
- (**options**) un-export internal adoptState helper - (9337dce) - dcog989
- (**runtime**) remove unused onInstalled wrapper - (5aef06e) - dcog989
- updates - (93721fb) - dcog989

- - -

## 0.14.3 - 2026-10-02
#### Bug Fixes
- (**content**) extract card titles from the current YouTube DOM - (175d5f9) - dcog989
- (**storage**) avoid clobbering state on transient Firefox storage reads - (700e3f5) - dcog989
#### Miscellaneous Chores
- tidy readme - (7e02f0f) - dcog989
#### Style
- (**options**) order textarea rules to satisfy specificity lint - (c6315d4) - dcog989

- - -

## 0.14.2 - 2026-09-22
#### Miscellaneous Chores
- (**version**) 0.14.1 - (950c3aa) - dcog989

- - -

## 0.14.1 - 2026-09-22
#### Documentation
- add privacy policy + screenshot - (fc74cab) - dcog989

- - -

## 0.14.0 - 2026-09-22
#### Features
- (**options**) collapse empty fuzzy filter fieldsets - (b380d1e) - dcog989

- - -

## 0.13.0 - 2026-09-22
#### Features
- (**options**) resolve channel names to id and handle - (591685b) - dcog989

- - -

## 0.12.0 - 2026-09-22
#### Features
- (**options**) accept channel names in the block-channel field - (c904264) - dcog989

- - -

## 0.11.0 - 2026-09-22
#### Features
- (**options**) label unresolved channels and videos as "Not found" - (a861024) - dcog989
#### Bug Fixes
- (**options**) reject unresolved channel handles - (23ff4ea) - dcog989

- - -

## 0.10.0 - 2026-09-22
#### Features
- (**import**) import BlockTube channelName handles as channel rows - (830c507) - dcog989
- (**options**) rename comments filter and alphabetize fuzzy filters - (e20fa76) - dcog989
- (**options**) separate fuzzy filter editors into fieldsets - (477fc7e) - dcog989
- (**options**) sortable channel and video table columns - (790c8c3) - dcog989
#### Bug Fixes
- (**popup**) disable block buttons when the active tab is not YouTube - (0e93818) - dcog989

- - -

## 0.9.0 - 2026-09-22
#### Features
- (**content/menu**) click native "Don't recommend channel" on channel block - (5cd15e4) - dcog989
- (**i18n**) localize the extension across 16 locales - (3a9c559) - dcog989
#### Bug Fixes
- (**content**) let theater mode expand when live chat is hidden - (22f1bc3) - dcog989
- (**options**) backfill all imported entries in chained batches - (f8330ac) - dcog989
- (**rules**) stop addChannel mutating its argument - (bfa0a75) - dcog989
- (**ui**) vertically center button labels - (fdfe164) - dcog989
#### Refactoring
- (**background**) drop redundant onInstalled DNR sync - (162e0fc) - dcog989
- (**content/menu**) extract channel cache into its own module - (c2f272a) - dcog989
- (**options**) revoke export object URL on pagehide - (c11209f) - dcog989
- (**resolve**) extract shared oEmbed fetch helper - (fd706e0) - dcog989

- - -

## 0.8.1 - 2026-09-19
#### Bug Fixes
- (**content**) hide the Explore more topics shelf under promo sections - (f57408b) - dcog989
- (**content**) resolve channel identity for sidebar lockup menus - (20a106b) - dcog989
- (**options**) read the live draft in area and pattern editors - (8bdf0ee) - dcog989

- - -

## 0.8.0 - 2026-09-19
#### Features
- (**icons**) replace circle-ellipsis glyph with check mark - (782d12f) - dcog989
- (**options**) show per-panel and total filter counts - (424b3f7) - dcog989
- (**options**) show extension version in settings footer - (2153801) - dcog989
- (**options**) icon theme switcher in header - (aabd456) - dcog989
#### Bug Fixes
- (**areas**) describe home page block as hiding, not redirecting - (cc39459) - dcog989
- (**background**) serialize DNR sync and drop redundant startup sync - (7f26122) - dcog989
- (**build**) always regenerate icons instead of skipping existing files - (e2782a8) - dcog989
- (**content**) scope current-context lookups to the active watch video - (1fd5ac9) - dcog989
- (**content**) re-evaluate hydrated and recycled cards by identity - (58950ff) - dcog989
- (**dnr**) cap rules at the browser regex limit and surface overflow - (3cd40a0) - dcog989
- (**ext**) propagate chrome API errors instead of swallowing lastError - (7f7c1e2) - dcog989
- (**filters**) apply one trimmed active-entry rule to counting and matching - (f6dadc1) - dcog989
- (**menu**) activate injected menu items with Enter and Space - (b61fc79) - dcog989
- (**options**) revoke export blob URL after the download starts - (44733e1) - dcog989
- (**options**) make backfill persist, resumable, and non-dirtying - (0448775) - dcog989
- (**options**) detect external state changes to avoid silent overwrites - (5e09da4) - dcog989
- (**options**) auto-size comment filters textarea to content - (63a0286) - dcog989
- (**resolve**) treat bare ambiguous tokens as handles in the channel field - (b22aac6) - dcog989
- (**resolve**) decode &amp; last to avoid double-decoding entities - (ef32dd9) - dcog989
- (**shared**) use undefined instead of void in union return types - (729e775) - dcog989
- (**storage**) store normalized channel handles - (5a556eb) - dcog989
- (**unblock**) avoid double @ in handle reason detail - (3781a5d) - dcog989
#### Performance Improvements
- (**background**) skip DNR update when rules are unchanged - (71437a9) - dcog989
- (**content**) dedupe nested mutation roots and gate menu scanning - (b21eb04) - dcog989
- (**content**) stop anchor parsing early and bound the shadow walk - (1a4d7f1) - dcog989
- (**content**) coalesce cover repositioning into one animation frame - (3611c95) - dcog989
- (**content**) make setPlayerBlank idempotent per reason - (afa084d) - dcog989
- (**content**) evaluate on navigation and hydration, not every mutation batch - (817533a) - dcog989
- (**menu**) track triggers on pointerdown only and drop rescan retries - (b47d830) - dcog989
- use Sets for import merge, compile patterns once, cap match length - (379f875) - dcog989
#### Documentation
- rumdl format - (e669567) - dcog989
#### Refactoring
- (**areas**) model area definitions as a redirect/hide union - (134ae25) - dcog989
- (**areas**) derive area keys, defaults, and classes from definitions - (cbb47e3) - dcog989
- (**constants**) centralize YouTube origin literals - (c205b38) - dcog989
- (**content**) make the store the menu's single source of truth - (b7ada9f) - dcog989
- (**content**) compose overlay/filter/menu from factories - (c082d12) - dcog989
- (**content**) split entity selector data from extraction - (79b10a4) - dcog989
- (**content**) add applyParsed for URL-derived entity identity - (3146acb) - dcog989
- (**content**) unify shadow-DOM walks on walkShadowRoots - (6c43085) - dcog989
- (**matcher**) reuse matchEntity in matchDirectNavigation - (63302c6) - dcog989
- (**menu**) extract menu action persistence into menu/persist - (8ee6689) - dcog989
- (**menu**) merge item action/owner maps into one WeakMap - (b1b2ac0) - dcog989
- (**menu**) make MenuAction a discriminated union - (e14577e) - dcog989
- (**options**) split settings UI into panel modules - (9b1a832) - dcog989
- (**options**) funnel status toggling through setStatus - (37325b4) - dcog989
- (**options**) remove version footer - (32f7f15) - dcog989
- (**options**) split filters into channels, videos and comments tabs - (010c57e) - dcog989
- (**options**) move blocking toggle to header, drop general tab - (87b855a) - dcog989
- (**reason**) drive reason behavior from a per-kind registry - (e18b63b) - dcog989
- (**reason**) make MatchResult a discriminated union - (8d123dd) - dcog989
- (**reason**) carry a structured Reason instead of wire strings - (c1ab747) - dcog989
- (**rules**) trust canonical handles from normalizeState - (8e6500a) - dcog989
- (**rules**) route entry validation through isActiveEntry - (f4720ce) - dcog989
- (**rules**) centralize video/channel mutations in shared/rules - (74da3ff) - dcog989
- (**rules**) split entity rows from pattern filter lists - (4bd57b8) - dcog989
- (**settings**) remove unused blockMessage setting - (a62282b) - dcog989
- (**shared**) separate display copy from domain definitions - (387f6f8) - dcog989
- (**shared**) add transactional rules service and invert chrome deps - (c0c2c6d) - dcog989
- (**shared**) segregate chrome API wrappers out of ext.ts - (f020ca6) - dcog989
- (**shared**) separate reason copy, unblock domain and navigation - (14d9c17) - dcog989
- (**shared**) split matcher into url, patterns, match and rules modules - (15269b6) - dcog989
- (**theme**) add shared isTheme guard - (cd54d99) - dcog989
- (**ui**) add h() DOM helper and use it for element building - (3e95727) - dcog989
- disambiguate storage/defaults/normalize and area/menu modules - (f9879de) - dcog989
- consolidate content-script state and trim redundant branching - (fc2706f) - dcog989
- remove dead code and the redundant card-hiding path - (5cda80d) - dcog989
#### Miscellaneous Chores
- updates - (954caf7) - dcog989
#### Style
- (**options**) order import before export in data panel - (7e0bf81) - dcog989
- (**options**) shrink header logo, left-align brand name next to logo - (b22b087) - dcog989
- (**options**) enlarge header logo and move brand name beside toggle - (5c009ff) - dcog989
- (**options**) left-align blocking toggle with the content column - (d313fda) - dcog989
- (**options**) place unsaved indicator next to the save button - (8866ef8) - dcog989
- (**options**) align blocking toggle over the sidebar column - (8dcaccc) - dcog989

- - -

## 0.7.0 - 2026-09-18
#### Features
- (**icons**) add 32px, 64px and 96px icons - (7122eff) - dcog989
#### Bug Fixes
- (**overlay**) theme channel block overlay for dark mode and pause playback - (0c2c076) - dcog989
- (**promos**) hide memberships brand video shelf banners - (95ad9fe) - dcog989

- - -

## 0.6.1 - 2026-09-18
#### Bug Fixes
- (**build**) correct ZIP EOCD offset and add AMO source build instructions - (1158758) - dcog989

- - -

## 0.6.0 - 2026-09-18
#### Features
- (**build**) auto-generate AMO source archive - (3581010) - dcog989
- (**firefox**) declare gecko_android compatibility for AMO - (fc48030) - dcog989

- - -

## 0.5.0 - 2026-09-18
#### Features
- (**icons**) redesign logo as YouTube lozenge with circle-ellipsis - (1a9229d) - dcog989
#### Style
- (**theme**) align icon and accent reds on #e03140 - (d7cce2f) - dcog989

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