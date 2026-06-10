# XT1 Right-Click Translate

[![CI](https://github.com/jomardyan/xt1-Right-Click-Translate-main/actions/workflows/test.yml/badge.svg)](https://github.com/jomardyan/xt1-Right-Click-Translate-main/actions/workflows/test.yml)
[![Build ZIP](https://github.com/jomardyan/xt1-Right-Click-Translate-main/actions/workflows/release.yml/badge.svg)](https://github.com/jomardyan/xt1-Right-Click-Translate-main/actions/workflows/release.yml)
[![Version](https://img.shields.io/badge/version-1.6.0-blue.svg)](manifest.json)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/github/license/jomardyan/xt1-Right-Click-Translate-main)](LICENSE)

A Chrome extension that lets you translate selected text or entire pages via right-click context menu, powered by the [MyMemory](https://mymemory.translated.net/) translation API.

## Features

- Right-click any selected text to translate it instantly
- Translate the full page from the context menu
- Keyboard shortcut: `Alt+Shift+T` to translate selection
- Configurable target language via the Options page
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

## License

[MIT](LICENSE) © Hayk Jomardyan
