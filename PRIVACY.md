# Privacy Policy for Right-click Translate

**Effective date:** September 11, 2026

Right-click Translate is a Chrome extension maintained by Hayk Jomardyan. This policy explains what information the extension handles and how it is used.

## Information the extension handles

The extension may handle the following information when you use the related features:

- **Text you choose to translate or save:** Selected text is processed to create a translation request or a saved note.
- **Web page URLs:** When you translate a page or save a note, the current page URL may be included in the translation request or saved with the note.
- **Translation preferences:** Source language, target languages, provider, open mode, preview settings, history settings, and related options.
- **Translation activity metadata:** If history is enabled, the extension stores source language, target language, translation provider, and the time of the translation. It does not store translated text in this history.
- **The latest translation:** The extension stores the latest selected text together with its language and provider settings for its quick-access interface.
- **Saved notes:** If you use Save to notes, the extension stores the selected text, optional translation, source and target languages, provider, page URL when available, tags, and creation time.
- **Connectivity state:** A simple online/offline status is stored locally to support the interface.

The extension does not collect your name, email address, account credentials, payment information, precise location, browsing history, or unrelated website activity. It does not use analytics, advertising, or tracking technologies.

## How information is used

Information is used only to provide the extension's translation and note-taking features:

- Selected text is sent to the translation service you choose when you open a translation.
- For quick previews, inline translations, and automatic note translations, selected text of up to the configured preview limit is sent to the MyMemory Translation API at `api.mymemory.translated.net`.
- For full text translations, the extension opens the selected provider's website and includes the selected text in the provider URL.
- For full page translations, the extension opens the selected provider's website and includes the page URL in the provider URL. The provider may retrieve and process the page according to its own privacy policy.
- Language detection uses Chrome's built-in language detection when available, Chrome's language detection API, or the bundled offline ELD library. The bundled fallback does not send text to an external service.
- Saved data is used only to display preferences, history, notes, and translation results within the extension.

The extension does not sell user data or transfer it to third parties for advertising, creditworthiness, lending, or purposes unrelated to the extension's single purpose.

## Storage and retention

- Preferences, the optional language-only translation history, and the latest translation are stored with Chrome Storage Sync and may be synchronized by Chrome according to your Chrome account settings.
- Translation history is limited to the 20 most recent entries and can be disabled or cleared in the Options page.
- Saved notes are stored in Chrome's local storage on the device and are limited to the 200 most recent notes. Notes can be deleted from the Options page.
- Saved note text is limited to 2,000 characters per note. Preview requests are limited by the preview setting, up to 500 characters.
- The extension does not operate a server or maintain a separate copy of your stored data. Information sent to a translation provider may be retained by that provider under its own policies.
- Uninstalling the extension removes its locally stored data. Synced data may remain in Chrome Sync until Chrome removes it or you clear it through your Chrome account and browser settings.

## Third-party services

Translation providers are selected by you and may include Google Translate, DeepL, Bing/Microsoft Translator, Yandex, and MyMemory. These services receive information needed to provide the requested translation. Their handling of information is governed by their own privacy policies and terms, not this policy.

## Permissions

The extension uses permissions only to provide its features:

- `contextMenus` creates right-click translation and note actions.
- `tabs` opens or updates translation pages and reads the active page URL for page translation.
- `storage` saves preferences, optional history, the latest translation, and local notes.
- `scripting` supports the keyboard shortcut and selected-text translation.
- `activeTab` permits the shortcut to read the current selection when invoked.
- `notifications` displays optional translation previews and note status messages.
- Access to `https://api.mymemory.translated.net/*` is used for optional translation previews and automatic note translations.
- The content script runs on web pages to display an inline translation popup when that mode is enabled. It does not collect or transmit page content by itself.

## Your choices

You can disable quick previews, translation history, and automatic note translation in the Options page. You can clear translation history and delete saved notes there as well. You can also remove the extension at any time.

## Changes to this policy

This policy may be updated when the extension's data practices change. The latest version will be published in this repository.

## Contact

For questions about this policy or the extension, please open an issue at:

<https://github.com/jomardyan/xt1-Right-Click-Translate-main/issues>
