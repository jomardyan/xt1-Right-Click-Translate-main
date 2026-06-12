# Changelog

All notable changes to the **Right-Click-Translate** extension will be documented in this file. This project adheres to Semantic Versioning.

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
