# Privacy Policy — YouTubeMyTube

Last updated: 2026-09-22

YouTubeMyTube is a browser extension that blocks videos, channels, comments, Shorts and page
areas on YouTube. This policy explains what the extension does with your data. The extension is
open source (GNU GPL-3.0), so every claim below can be verified against the source code.

## Summary

- The extension does **not** collect, transmit, sell or share any personal data.
- There are no accounts, analytics, telemetry, crash reporting or advertising.
- Everything you configure is stored **locally in your browser**.
- No data is sent to the developer or any third party. The only network requests the extension
  makes go directly to `youtube.com`, to look up public metadata.

## What the extension stores

The extension keeps its settings in `chrome.storage.local` (Firefox: `browser.storage.local`) on
your device:

- Your blocklist: blocked channel IDs, handles and names; blocked video IDs; keyword/regex filters
  for channel names, titles and comments; enabled page-area toggles.
- Preferences: whether blocking is enabled, and the theme choice.
- Cached, publicly available metadata for entries you add: channel names/IDs/handles and video
  titles.

This data never leaves your browser except as described under "Network requests" below. It is
removed when you uninstall the extension or clear the extension's storage. "Reset all" in the
options page also clears it.

## What the extension does not do

- It does not read, store or transmit your YouTube account, watch history, search history or
  cookies.
- It does not track which pages you visit. It only inspects the URL of the **active tab** when you
  open the extension popup, and only for YouTube pages (the extension has no access to other
  sites).
- It does not include remote code. All code is bundled in the extension package.

## Network requests

The extension only contacts YouTube (`https://www.youtube.com` and `https://www.m.youtube.com`) and
only to resolve **public** metadata for entries you add:

- Video titles, via YouTube's oEmbed endpoint.
- Channel names, IDs and handles, via the public channel page.
- Channel names you type, via YouTube's channel search results.

These requests are made directly from your browser to YouTube and are subject to
[Google's Privacy Policy](https://policies.google.com/privacy). They do not include your blocklist
or any other data you have configured. No request is made to the developer or to any analytics
service.

## Permissions and why they are needed

- `storage` — to save your blocklist and preferences locally.
- `declarativeNetRequest` — to redirect direct navigation to blocked videos, channels and page
  areas.
- Host access to `https://www.youtube.com/*` and `https://www.m.youtube.com/*` — to run the content
  script that hides blocked content, to read the active tab's URL when you open the popup, and to
  perform the metadata lookups above.

## Import and export

Importing or exporting settings happens entirely on your device using a file you choose. BlockTube
backups are parsed locally. Imported or exported files are not uploaded anywhere.

## Children's privacy

The extension does not collect personal data from anyone, including children.

## Changes to this policy

If this policy changes, the updated version will be committed to this repository with a new
"Last updated" date.

## Contact

Questions or concerns: open an issue at
<https://github.com/dcog989/YouTubeMyTube/issues>.
