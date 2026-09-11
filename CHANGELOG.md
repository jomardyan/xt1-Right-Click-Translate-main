# Changelog

All notable changes to the **Right-Click-Translate** extension will be documented in this file. This project adheres to Semantic Versioning.

---

## [1.7.0] - 2026-09-11

### Added
- **One-click context menu**: a new "Right-click menu" setting adds a single
  "Translate to ..." entry directly in the right-click menu. Because Chrome only
  nests an extension's entries into a submenu when there is more than one, the
  compact layout removes the submenu entirely - one click, no cursor travel to
  the right, straight into your primary target language. *(Requested by a user
  review.)*
- **Translate selection from the toolbar**: the extension popup now has a
  "Translate selection now" button and an open-mode switcher, so a translation
  can be started without touching the context menu.
- **Richer on-page translations**: the inline popup now offers a Copy button and
  an "Open in translator" link, flags when a selection was truncated at the
  500-character API limit, and repositions itself once its real height is known.
- **Redesigned options page**: a light, card-based layout split into General,
  Languages, Notes and Insights tabs, with a sticky save bar, plain-language
  descriptions for every mode, accessible toggles, and an unsaved-changes guard.
- On-page mode is now presented as the recommended option and the options page
  opens once on a fresh install, so users who do not want a new tab find the
  setting instead of discovering the default the hard way. *(Requested by a user
  review.)*

### Fixed
- **On-page translations no longer fail silently.** The popup script used to be
  registered at page load only, so any tab opened before the extension was
  installed, updated, or reloaded produced nothing at all. The script is now
  injected on demand, and pages that cannot host it (PDF viewer, Web Store,
  browser UI) fall back to opening the provider instead of doing nothing.
- **Sync storage quota exhaustion.** Every translation wrote both the history
  and the last-translation record to `chrome.storage.sync`, two of the 120 writes
  Chrome allows per minute. Translation history and the last translation now live
  in local storage and share a single write, and existing data is migrated
  automatically on update. Settings can no longer be dropped by a quota error.
- **Context menu rebuilds.** The menu was torn down and rebuilt after every
  single translation. It is now rebuilt only when its contents actually change.
- **Silent write failures.** Storage writes in the options page, popup and
  service worker now check `chrome.runtime.lastError`, so "Settings saved
  successfully" is never shown for a write that failed.
- Note translation requests in the options page now time out after 8 seconds
  instead of hanging indefinitely.
- The options page no longer loads the ~960 KB offline language-detection
  library up front; it is fetched only if a note actually needs it.
- Importing notes that are already present now reports that clearly instead of
  claiming "Imported 0 notes".
- Swapping languages no longer produces a duplicated target language entry.
- The exported notes blob URL is revoked after the download starts, not before.

### Changed
- **Reduced install warning.** The `<all_urls>` content script was removed from
  the manifest, so the extension no longer asks to "read and change all your data
  on all websites". Page access is now requested per action through `activeTab`.
- Full localization coverage: the inline popup, toolbar popup, keyboard shortcut
  descriptions and relative timestamps are no longer hard-coded English.
- The theme, popup and options pages share one light-first palette with a
  dedicated on-accent colour so text stays readable in dark mode.
- Minimum supported Chrome version raised from 103 to 105.

---

## [1.6.0] - 2026-06-10

### Added
- **Layered Language Detection**: Introduced a robust multi-tiered language identification pipeline:
  - Leverages Chrome's built-in `LanguageDetector` API where available.
  - Automatically falls back to Compact Language Detector (CLD) or a lightweight, bundled client-side Efficient Language Detector (ELD) to ensure accurate detection without network overhead.
- Added browser requirements declaration in manifest: `minimum_chrome_version: "103"` to guarantee compatibility with native `AbortSignal.timeout` calls.

### Fixed & Optimized
- **Query Length Truncation**: Resolved failures with extremely long inline text translations by automatically truncating MyMemory translation API calls to their strict 500-character limit.
- **Synced Storage Quota Savings**: Relocated the transient `isOnline` flag from `storage.sync` to `storage.local` to completely eliminate redundant cross-device synchronization writes and stay well within API write quotas.
- **Source Auto-Detection URL Fixes**: Corrected third-party redirection links (Bing, Yandex) to properly auto-detect the source language rather than passing literal `'auto'` strings.
- **Language Swapping Edge Cases**: Added safe checks against empty target language list selections, avoiding unresolved `undefined` states in the translation language swap UI.
- Cleaned up obsolete test-coverage artifact directories from tracking.

---

## [1.5.0] - 2026-02-18

### Added
- **Elegant Inline Translation Mode**: Introducing overlay balloon translation popup rendering directly inside the web document page! Perfect for instant reading without switching views.
- **Bidirectional Language Swap**: Quick swap button to invert your translation source and target languages instantly.
- **Last Translation Recall**: Remembers and displays your immediate last translation context to easily resume reading.
- **Import/Export Utility**: Export extension configurations, custom notes, and statistics into standardized JSON files for quick backup and restores.
- **Translation Usage Stats**: Dashboard for tracking individual translation usage, including total character counts and provider distribution.
- **Accessibility & Security Upgrades**: Added standard keyboard interaction keys (escape, arrow selections) for popup navigation and wrapped inline content script rendering within a secure Shadow DOM to avoid side-effects from parent page styles.

---

## [1.4.0] - 2025-12-31

### Changed
- Refined background message-passing layers and finalized standard permission scopes in the manifest definition to ensure a secure extension sandbox.

---

## [1.3.0] - 2025-12-31

### Added
- **Multi-Provider Translation Support**: Native integration with translation providers (Google Translate, DeepL, Bing, Yandex, and Microsoft Translators).
- **Persistent Translation Notes**: Store, retrieve, copy, and organize custom note snippets and their translations inside the extension options.
- **Note Preview API**: High-efficiency inline background validation previews of stored vocabulary notes.
- **Modern Options UI**: Redesigned dashboard and popup layouts with polished typography, fluid transitions, and a clean stylesheet structure.
- **Internationalization (i18n)**: Implemented standard `_locales` directory translation namespaces for wide localized language support.
