# XT1 Right-Click Translate

[![CI](https://github.com/jomardyan/xt1-Right-Click-Translate-main/actions/workflows/test.yml/badge.svg)](https://github.com/jomardyan/xt1-Right-Click-Translate-main/actions/workflows/test.yml)
[![Build ZIP](https://github.com/jomardyan/xt1-Right-Click-Translate-main/actions/workflows/release.yml/badge.svg)](https://github.com/jomardyan/xt1-Right-Click-Translate-main/actions/workflows/release.yml)
[![Version](https://img.shields.io/badge/version-1.7.0-blue.svg)](manifest.json)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/github/license/jomardyan/xt1-Right-Click-Translate-main)](LICENSE)

A Chrome extension that lets you translate selected text or entire pages via right-click context menu, powered by the [MyMemory](https://mymemory.translated.net/) translation API.

See the [Privacy Policy](PRIVACY.md) for information about data handling and third-party translation services.

## Features

- Right-click any selected text to translate it instantly
- **On-page translations** - the result appears in a small popup next to your
  selection, with copy and "open in translator" actions. No new tab is opened.
- **One-click context menu** - an optional single "Translate to ..." entry that
  sits directly in the right-click menu, so there is no submenu to open and the
  cursor never has to travel right
- Translate the full page from the context menu
- Translate the current selection straight from the toolbar popup
- Keyboard shortcut: `Alt+Shift+T` to translate selection
- Configurable target languages, provider and theme via the Options page
- Notes and bookmarks with JSON import/export
- Supports 50+ languages
- Automatic source language detection for previews, using Chrome's built-in
  [LanguageDetector](https://developer.mozilla.org/en-US/docs/Web/API/LanguageDetector) AI API
  when available, with `chrome.i18n.detectLanguage` and the bundled
  [ELD](https://github.com/nitotm/efficient-language-detector-js) library
  (Apache-2.0, see `vendor/ELD-LICENSE`) as offline fallbacks

## Installation

1. Download the latest ZIP from [Releases](https://github.com/jomardyan/xt1-Right-Click-Translate-main/releases) or the [Build ZIP workflow artifacts](https://github.com/jomardyan/xt1-Right-Click-Translate-main/actions/workflows/release.yml).
2. Unzip the file.
3. Open Chrome and go to `chrome://extensions/`.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the unzipped folder.

## Development

```bash
npm install
npm test            # run tests
npm run test:coverage  # run tests with coverage report
```

### Privacy-friendly by design

The extension declares a single host permission (`api.mymemory.translated.net`)
and registers **no** content script on `<all_urls>`. The on-page popup script is
injected on demand with `chrome.scripting`, using the `activeTab` grant that
Chrome gives when you pick a context-menu item, press the shortcut, or open the
toolbar popup.

## Build the Chrome Web Store package

Install `make`, `jq`, and `zip`, then run:

```bash
make package
```

The ready-to-upload archive is created at `dist/xt1-translate-v<version>.zip`.

## License

[MIT](LICENSE) © Hayk Jomardyan
