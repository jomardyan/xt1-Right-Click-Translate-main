# Privacy Policy for Right-click Translate

**Effective date:** December 2, 2025  

This Privacy Policy describes how the browser extension **Right-click Translate** (the "Extension") provided by **jomardyan** ("we", "us", or "our") handles information when used in supported browsers, including Google Chrome and Microsoft Edge.

By installing or using the Extension, you acknowledge that you have read and understood this Privacy Policy.

## 1. Scope

This Privacy Policy applies solely to the Extension as distributed through:
- The Chrome Web Store for Google Chrome and other Chromium-based browsers.
- The Microsoft Edge Add-ons store for Microsoft Edge.

It does not apply to third-party translation services (Google Translate, DeepL, Bing Translator, Yandex Translate, Microsoft Translator, or MyMemory API) that are accessed through the Extension, each of which operates under its own privacy policy.

## 2. Data Collection and Processing

**Right-click Translate does not collect, store, transmit, or process any personal data or personally identifiable information (PII) on our servers.**

Specifically, the Extension itself does **not**:
- Collect or transmit your browsing history, URLs, or search queries to our servers
- Send your IP address or device identifiers to us
- Use cookies or similar tracking technologies for analytics
- Track your behavior across websites for marketing or profiling
- Perform any analytics or user tracking on our behalf
- Store your translated text or selections on external servers or in extension storage

The Extension operates as a client-side tool that facilitates access to third-party translation services selected by you.

## 3. Local Processing and Storage

### Extension Settings
The Extension stores the following data **locally in your browser** using chrome.storage:
- **User preferences**: Source language, target languages, translation provider choice
- **Translation history**: Recently used language pairs (source, target, provider, timestamp) for quick access; no selected text is stored
- **Options**: Tab behavior (new tab vs. current tab), preview settings, theme preference
- **Menu configuration**: Your saved target language list

### Data Storage Location
- All settings and history are stored **only in your browser's local storage** (chrome.storage.sync)
- This data can sync across your devices if you're signed into Chrome/Edge with sync enabled
- We have no servers, no databases, and no access to any information stored by the Extension
- You can clear this data at any time by removing the Extension or clearing browser data

## 4. Third-Party Translation Services

### How Translation Works
When you use the Extension to translate text:
1. You select text on a web page
2. You trigger translation via right-click menu or keyboard shortcut
3. The Extension sends **only the selected text** to your chosen translation provider
4. The translation provider processes the text and returns the translation

### Third-Party Services
The Extension provides access to the following third-party translation services:

#### Translation Provider Websites
- **Google Translate** (translate.google.com)
- **DeepL** (deepl.com/translator)
- **Bing Translator** (bing.com/translator)
- **Yandex Translate** (translate.yandex.com)
- **Microsoft Translator** (translator.microsoft.com)

When you select these providers, the Extension opens their website in a browser tab with your selected text pre-filled. The provider's privacy policy applies to that interaction.

#### Preview Translation API
- **MyMemory API** (api.mymemory.translated.net)

When preview mode is enabled (optional), the Extension sends selected text to MyMemory API for quick translation preview. This is a third-party service, and their privacy policy applies.

### Third-Party Data Sharing
The Extension **only** shares data with third parties when:
- You explicitly trigger a translation (selected text or page URL is sent to your chosen provider)
- Preview mode is enabled and you select text (sent to MyMemory API)

**Important Notes:**
- The Extension does not control third-party services' data handling practices
- Each translation provider has its own privacy policy
- You can disable preview mode in Extension settings to avoid MyMemory API requests
- The Extension itself does not log, store, or analyze the text you translate

### Third-Party Privacy Policies
Please review the privacy policies of services you use:
- [Google Translate Privacy Policy](https://policies.google.com/privacy)
- [DeepL Privacy Policy](https://www.deepl.com/privacy)
- [Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement)
- [Yandex Privacy Policy](https://yandex.com/legal/confidential/)
- [MyMemory Privacy Policy](https://mymemory.translated.net/doc/privacy.php)

## 5. Permissions Explained

Right-click Translate requests the following browser permissions to provide its core functionality. **These permissions are not used for data collection or tracking by us:**

### Context Menus Permission
- **Purpose**: Add the "Translate selection" and "Translate page" items to the right-click context menu
- **Data**: No data is collected; only enables menu functionality
- **Privacy**: Does not access page content or user activity

### Tabs Permission
- **Purpose**: Open translation provider websites in new or current tabs
- **Data**: Used to manage tab navigation; no tab data is collected
- **Privacy**: Does not access browsing history or tab contents

### Storage Permission
- **Purpose**: Save your preferences, target languages, and translation history locally
- **Data**: Settings, language preferences, usage history
- **Privacy**: All data remains in browser storage; nothing is transmitted to external servers

### Scripting + ActiveTab Permissions
- **Purpose**: Capture selected text when using the keyboard shortcut (Alt+Shift+T)
- **Data**: Only accesses selected text on the active tab when you trigger the shortcut
- **Privacy**: No page content is accessed except when you explicitly trigger translation; no data is logged

### Notifications Permission
- **Purpose**: Display quick preview translations without leaving the page
- **Data**: Shows translation result locally; no data is sent externally by the notification
- **Privacy**: Notifications are generated locally from API responses

### Host Permissions (api.mymemory.translated.net)
- **Purpose**: Fetch quick preview translations from MyMemory API (optional feature)
- **Data**: Selected text is sent to MyMemory API only when preview mode is enabled
- **Privacy**: You can disable preview mode to avoid external API calls; the Extension does not log requests

All permissions are used exclusively for the translation facilitation functionality and not for any form of data collection, tracking, or monetization by us.

## 6. What Data is Shared

The Extension shares data **only** with third-party translation services and **only** when you explicitly trigger a translation:

### Shared with Translation Providers
- **Selected text**: The text you highlight and choose to translate
- **Page URL**: Shared when you use page translation
- **Source and target languages**: Your selected language pair
- **Browser information**: Standard HTTP headers sent by your browser (user agent, etc.)

### Shared with MyMemory API (Preview Mode)
When preview mode is enabled:
- **Selected text**: Sent to MyMemory for quick translation
- **Language pair**: Source and target languages

**Important**: The Extension itself does not collect or store this data. It is sent directly from your browser to the third-party service.

## 7. Children's Privacy

The Extension does not collect or transmit personal information to our servers. However, when using third-party translation services, their privacy policies apply. Parents and guardians should review third-party policies if children will use translation services through this Extension.

## 8. User Rights and Controls

You have complete control over the Extension and your locally stored data:

### Extension Controls
- **Disable Preview**: Turn off preview mode to avoid MyMemory API requests
- **Choose Providers**: Select which translation service to use
- **Clear History**: Clear translation history from Extension settings using the Clear history button
- **Manage Languages**: Add or remove target languages from the menu
- **Keyboard Shortcuts**: Customize or disable the translation shortcut

### Data Management
- **Disable**: Turn off the Extension at any time from chrome://extensions/
- **Clear Storage**: Remove the Extension to delete all locally stored preferences
- **Browser Sync**: Control whether settings sync across devices via browser settings
- **Third-Party Data**: Contact translation providers directly to manage data they collect

To manage extensions:
- **Chrome**: chrome://extensions/
- **Edge**: edge://extensions/

## 9. International Data Transfers

The Extension itself does not transfer data internationally. However, when you use third-party translation services:
- Your selected text is sent to the translation provider's servers
- These servers may be located in different countries
- Each provider's privacy policy describes their data handling and transfers

## 10. Changes to This Privacy Policy

We may update this Privacy Policy to reflect:
- Changes in the Extension's functionality or behavior
- Updates to applicable laws, regulations, or browser extension policies
- Changes to third-party services or integrations

When changes are made:
- The "Effective date" at the top will be updated
- Material changes will be reflected in the Chrome Web Store and Microsoft Edge Add-ons listings
- Continued use of the Extension after changes constitutes acceptance of the updated policy

## 11. Compliance

This Extension is designed to comply with:
- Chrome Web Store Developer Program Policies
- Microsoft Edge Add-ons Policies
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)

Given that the Extension itself does not collect or transmit personal data to our servers, most data protection obligations do not apply to us. However, third-party services you access through the Extension may have their own compliance obligations.

## 12. Security

### Extension Security
- The Extension operates entirely client-side in your browser
- No external servers are operated or controlled by us
- Communication with translation providers uses HTTPS
- Settings and history are protected by browser security mechanisms

### Your Responsibility
- Be mindful of sensitive information you translate (passwords, personal data, confidential documents)
- Remember that translated text is sent to third-party services
- Review third-party privacy policies before translating sensitive content
- Consider using offline translation tools for highly sensitive data

## 13. Contact

If you have any questions or concerns about this Privacy Policy or the Extension, you can contact us at:

**Developer:** jomardyan  
**GitHub Repository:** [https://github.com/jomardyan/xt1-Right-Click-Translate](https://github.com/jomardyan/xt1-Right-Click-Translate)  
**Report Issues:** [https://github.com/jomardyan/xt1-Right-Click-Translate/issues](https://github.com/jomardyan/xt1-Right-Click-Translate/issues)

---

**Summary**: Right-click Translate is a privacy-respecting browser extension that facilitates access to third-party translation services. The Extension itself collects no personal data and operates no external servers. When you translate text, it is sent directly from your browser to your chosen translation provider (Google, DeepL, Bing, Yandex, Microsoft, or MyMemory), whose privacy policies apply. All Extension settings remain in your browser's local storage under your complete control.
