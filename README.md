# Right-Click Translate

Translate selected text or entire pages from any webpage via a simple context menu with support for multiple translation providers.

[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)
[![Version](https://img.shields.io/github/v/release/jomardyan/xt1-Right-Click-Translate)](https://github.com/jomardyan/xt1-Right-Click-Translate/releases)

## Why Right-Click Translate?

Right-Click Translate provides instant access to multiple translation services without leaving your current page. Configure multiple target languages, choose your preferred provider, and get quick preview translations before opening the full service.

## Key Features

- Translate selections or full pages from the context menu
- Multiple translation providers - choose from Google, DeepL, Bing, Yandex, or Microsoft Translator
- Multi-language targets - maintain a reorderable list of frequently used languages
- Quick preview - see a translation notification before opening (with adjustable length)
- Keyboard shortcut - translate selection with Alt+Shift+T (customizable)
- Smart history - frequently used languages surface in the menu, with a quick summary and clear option
- Source language control - auto-detect or lock to a specific source language
- Flexible opening - translations open in a new tab or replace the current tab
- Dark mode support - options page adapts to system theme

## Installation

### From Source

```bash
git clone https://github.com/jomardyan/xt1-Right-Click-Translate.git
cd xt1-Right-Click-Translate
```

1. Open Chrome or Edge and navigate to extensions page (`chrome://extensions/` or `edge://extensions/`)
2. Enable "Developer mode"
3. Click "Load unpacked" and select the repository folder
4. Right-click on any selected text to see the translate menu

## Quick Start

1. Select text or right-click on a page
2. Right-click to open the context menu
3. Choose "Translate selection to [language]" or "Translate page to [language]"
4. Translation opens in your configured provider (Google Translate by default)

### First-Time Setup

1. Right-click the extension icon and select "Options"
2. Add your preferred target languages
3. Reorder the list to match your menu order
4. Select your favorite translation provider
5. Configure preview length and menu size if needed

## Usage

### Basic Translation

Select text, right-click, and choose your target language. The extension sends your selection to the chosen provider.

### Page Translation

Right-click on a page (with no selection) and choose "Translate page to [language]". The extension opens the provider page-translation URL when available.

### Quick Preview

When preview is enabled, a notification shows the translation before opening the provider page. Long selections skip preview requests based on your preview length setting.

### Keyboard Shortcut

Press `Alt+Shift+T` (default) to translate the current selection using your primary target language. You can assign a shortcut for page translation in your browser extension settings.

### Multiple Target Languages

Add multiple languages in the options page. The context menu shows your list, ordered by your preferences and recent usage. Use the reorder controls to adjust the order.

### History Summary

The options page shows recent target language usage. Use "Clear history" to reset usage data.

## Configuration

Access options by right-clicking the extension icon:

- **Source language** - auto-detect or select a fixed source (default: auto)
- **Target languages** - add, remove, and reorder languages for the context menu
- **Provider** - Google, DeepL, Bing, Yandex, or Microsoft Translator
- **Open mode** - new tab or current tab (default: new tab)
- **Preview** - enable or disable quick translation notifications
- **Preview length** - set how many characters are used for previews
- **Max menu languages** - limit how many languages appear in the menu
- **History** - view recent usage and clear history
- **Theme** - auto, light, or dark mode for options page

### Supported Providers

- **Google Translate** - `translate.google.com`
- **DeepL** - `deepl.com/translator`
- **Bing Translator** - `bing.com/translator`
- **Yandex Translate** - `translate.yandex.com`
- **Microsoft Translator** - `microsoft.com/translator`

## Permissions

- `contextMenus` - add right-click menu items
- `tabs` - open translation in new or current tab
- `storage` - persist settings and language preferences
- `scripting` + `activeTab` - capture selected text for keyboard shortcut
- `notifications` - display quick preview translations
- `https://api.mymemory.translated.net/*` - fetch preview translations (optional)

## Privacy

Right-Click Translate does not collect or store personal data. Selected text is only sent to your chosen translation provider when you trigger a translation. Preview translations use the MyMemory API and can be disabled. Translation history stores only language usage metadata (no translated text). See [PRIVACY_POLICY.md](PRIVACY_POLICY.md) for full details.

## Development

### File Structure

- `background.js` - service worker handling context menus and keyboard shortcuts
- `options.html/js/css` - configuration interface
- `manifest.json` - extension configuration and permissions
- `_locales/` - internationalization strings

### Release History

- **1.3.0** - Multiple targets, provider expansion, keyboard shortcut, quick preview, history tracking, dark mode
- **1.2.0** - Provider selection (Google/DeepL), dynamic menu titles
- **1.1.0** - Options page, configurable target language, open mode
- **1.0.0** - Initial release with Google Translate to English

## Contributing

This is a proprietary project. The source code is provided for transparency and personal use only. Modifications, redistribution, and commercial use are prohibited. See [LICENSE](LICENSE) for details.

## License

Proprietary License with Usage Rights - Free to use, prohibited from modification and redistribution. See [LICENSE](LICENSE) file.

## Author

c 2025 Hayk Jomardyan. All rights reserved.
