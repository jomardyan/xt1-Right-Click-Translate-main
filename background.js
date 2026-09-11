// Bundled ELD language detector (Apache-2.0, see vendor/ELD-LICENSE).
// The build registers itself as globalThis.eld.
// This has to be a static import: dynamic import() is disallowed on
// ServiceWorkerGlobalScope, so the module cannot be loaded on demand here.
import './vendor/eld.min.js';

const MENU_NOTE_ID = 'rightClickTranslateNote';
const MENU_NOTE_SEPARATOR_ID = 'rightClickTranslateNoteSeparator';
const MENU_LANG_PREFIX = 'rightClickTranslateLang_';
const MENU_PAGE_LANG_PREFIX = 'rightClickTranslatePageLang_';
const MAX_HISTORY = 20;
const DEFAULT_MAX_MENU_LANGUAGES = 6;
const MIN_MENU_LANGUAGES = 1;
const MAX_MENU_LANGUAGES_CAP = 12;
const DEFAULT_PREVIEW_TEXT_LIMIT = 180;
const MIN_PREVIEW_TEXT_LIMIT = 60;
const MAX_PREVIEW_TEXT_LIMIT = 500;
const PREVIEW_API_URL = 'https://api.mymemory.translated.net/get';
const PREVIEW_QUERY_LIMIT = 500; // MyMemory rejects queries over 500 chars
const PREVIEW_TIMEOUT_MS = 8000;
const NOTES_STORAGE_KEY = 'savedNotes';
const NOTES_MAX_ITEMS = 200;
const NOTES_TEXT_LIMIT = 2000;
const CONTENT_SCRIPT_FILE = 'content.js';
const MENU_LAYOUTS = ['full', 'compact'];

const LANGUAGE_LABELS = {
  auto: 'Auto-detect',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  'zh-CN': 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
  pl: 'Polish',
  tr: 'Turkish',
  ar: 'Arabic',
  hi: 'Hindi',
  nl: 'Dutch',
  sv: 'Swedish'
};

const PROVIDERS = {
  google: 'Google',
  deepl: 'DeepL',
  bing: 'Bing',
  yandex: 'Yandex',
  microsoft: 'Microsoft'
};

/**
 * Synced settings. User data (history, last translation, notes) lives in
 * storage.local so it never burns through the sync write quota.
 */
const DEFAULT_OPTIONS = {
  sourceLang: 'auto',
  targetLanguages: ['en', 'es', 'pl'],
  provider: 'google',
  openMode: 'newTab',
  menuLayout: 'full',
  previewEnabled: true,
  saveHistory: true,
  maxMenuLanguages: DEFAULT_MAX_MENU_LANGUAGES,
  previewTextLimit: DEFAULT_PREVIEW_TEXT_LIMIT,
  notesAutoTranslate: true
};

/** Device-local data, kept out of storage.sync. */
const DEFAULT_LOCAL_DATA = {
  translationHistory: [],
  lastTranslation: null
};

const getMessage = (key, substitutions, fallback) => {
  if (chrome?.i18n?.getMessage) {
    const msg = chrome.i18n.getMessage(key, substitutions);
    if (msg) return msg;
  }
  return fallback || key;
};

const getMenuTitle = (langLabel, providerLabel) =>
  getMessage(
    'menuTranslateSelection',
    [langLabel, providerLabel],
    `Translate selection to ${langLabel} (${providerLabel})`
  );

const getCompactMenuTitle = (langLabel) =>
  getMessage('menuTranslateCompact', [langLabel], `Translate to ${langLabel}`);

const getPageMenuTitle = (langLabel, providerLabel) =>
  getMessage(
    'menuTranslatePage',
    [langLabel, providerLabel],
    `Translate page to ${langLabel} (${providerLabel})`
  );

const getPreviewTitle = (providerLabel, targetLabel) =>
  getMessage(
    'notificationPreviewTitle',
    [providerLabel, targetLabel],
    `Preview (${providerLabel} to ${targetLabel})`
  );

const getSaveNoteTitle = () =>
  getMessage('menuSaveNote', null, 'Save selection to notes');

const getNoteSavedTitle = () =>
  getMessage('notificationNoteSavedTitle', null, 'Saved to notes');

const getNoteSavedMessage = (hasTranslation) =>
  hasTranslation
    ? getMessage('notificationNoteSavedMessage', null, 'Saved selection and translation.')
    : getMessage('notificationNoteSavedNoTranslation', null, 'Saved selection. Translation unavailable.');

const getNoteSavedError = () =>
  getMessage('notificationNoteSavedError', null, 'Unable to save note.');

/**
 * Promisified Chrome Storage API.
 * Writes reject on chrome.runtime.lastError so quota problems surface
 * instead of silently dropping data.
 */
const getOptions = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_OPTIONS, resolve);
  });

const setOptions = (values) =>
  new Promise((resolve, reject) => {
    chrome.storage.sync.set(values, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });

const getLocalData = () =>
  new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_LOCAL_DATA, resolve);
  });

const setLocalData = (values) =>
  new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });

// Device-specific connectivity state; kept in storage.local so it
// neither syncs across devices nor consumes sync write quota.
const setOnlineState = (isOnline) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ isOnline }, resolve);
  });

const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, min), max);
};

const normalizeMenuLimit = (value) =>
  clampNumber(value, MIN_MENU_LANGUAGES, MAX_MENU_LANGUAGES_CAP, DEFAULT_MAX_MENU_LANGUAGES);

const normalizePreviewLimit = (value) =>
  clampNumber(value, MIN_PREVIEW_TEXT_LIMIT, MAX_PREVIEW_TEXT_LIMIT, DEFAULT_PREVIEW_TEXT_LIMIT);

const normalizeMenuLayout = (value) =>
  MENU_LAYOUTS.includes(value) ? value : DEFAULT_OPTIONS.menuLayout;

/**
 * Promisified Chrome Context Menu API
 */
const removeAllMenus = () =>
  new Promise((resolve) => {
    chrome.contextMenus.removeAll(() => resolve());
  });

const safeCreateMenu = (createProps) =>
  new Promise((resolve) => {
    chrome.contextMenus.create(createProps, () => {
      // Ignore duplicate errors; they'll be cleared on next rebuild.
      chrome.runtime.lastError;
      resolve();
    });
  });

/**
 * Get display label for language code
 */
const getLanguageLabel = (code) => {
  const name = LANGUAGE_LABELS[code];
  return name ? `${name} (${code})` : code;
};

/**
 * Get display label for provider
 */
const getProviderLabel = (provider) => PROVIDERS[provider] || PROVIDERS.google;

const createNoteId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const trimNoteText = (text) =>
  typeof text === 'string' ? text.trim().slice(0, NOTES_TEXT_LIMIT) : '';

const sanitizeNote = (note) => {
  if (!note || typeof note !== 'object') return null;
  const sourceText = trimNoteText(note.sourceText);
  if (!sourceText) return null;

  const translatedText = trimNoteText(note.translatedText || '');
  const sourceLang = typeof note.sourceLang === 'string' ? note.sourceLang : 'auto';
  const targetLang = typeof note.targetLang === 'string' ? note.targetLang : 'en';
  const provider = typeof note.provider === 'string' ? note.provider : DEFAULT_OPTIONS.provider;
  const tag = trimNoteText(note.tag || '');
  const url = isValidPageUrl(note.url) ? note.url : '';
  const createdAt = typeof note.createdAt === 'number' ? note.createdAt : Date.now();
  const origin = typeof note.origin === 'string' ? note.origin : 'selection';

  return {
    id: note.id || createNoteId(),
    sourceText,
    translatedText,
    sourceLang,
    targetLang,
    provider,
    tag,
    url,
    createdAt,
    origin
  };
};

const getNotes = () =>
  new Promise((resolve) => {
    chrome.storage.local.get({ [NOTES_STORAGE_KEY]: [] }, resolve);
  });

const setNotes = (notes) =>
  new Promise((resolve, reject) => {
    chrome.storage.local.set({ [NOTES_STORAGE_KEY]: notes }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });

const addNote = async (note) => {
  const { [NOTES_STORAGE_KEY]: savedNotes = [] } = await getNotes();
  const safeNote = sanitizeNote(note);
  if (!safeNote) return;
  const next = [safeNote, ...savedNotes].slice(0, NOTES_MAX_ITEMS);
  await setNotes(next);
};

/**
 * Safely encode text for URL usage
 */
const safeEncodeURIComponent = (text) => {
  if (typeof text !== 'string') return '';
  return encodeURIComponent(text.slice(0, 5000)); // Limit length to prevent abuse
};

/**
 * Sanitize user text input
 */
const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  // Remove any control characters and limit length
  return text.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 10000);
};

/**
 * Build translation URL for the selected provider
 */
const buildUrl = (provider, sourceLang, targetLang, query) => {
  const source = sourceLang || 'auto';
  const isAuto = source === 'auto';
  const safeSource = safeEncodeURIComponent(source);
  const safeTarget = safeEncodeURIComponent(targetLang);
  const safeQuery = query; // Already encoded by caller
  // Bing auto-detects with an empty "from"; Yandex auto-detects when
  // source_lang is omitted. Neither accepts the literal value "auto".
  const bingFrom = isAuto ? '' : safeSource;

  const providers = {
    deepl: () =>
      `https://www.deepl.com/translator#${safeSource}/${safeTarget}/${safeQuery}`,
    bing: () =>
      `https://www.bing.com/translator?text=${safeQuery}&from=${bingFrom}&to=${safeTarget}`,
    yandex: () =>
      isAuto
        ? `https://translate.yandex.com/?target_lang=${safeTarget}&text=${safeQuery}`
        : `https://translate.yandex.com/?source_lang=${safeSource}&target_lang=${safeTarget}&text=${safeQuery}`,
    microsoft: () =>
      `https://www.bing.com/translator?text=${safeQuery}&from=${bingFrom}&to=${safeTarget}`,
    google: () =>
      `https://translate.google.com/?sl=${safeSource}&tl=${safeTarget}&text=${safeQuery}&op=translate`
  };
  return (providers[provider] || providers.google)();
};

/**
 * Build page translation URL for the selected provider
 */
const buildPageUrl = (provider, sourceLang, targetLang, pageUrl) => {
  const source = sourceLang || 'auto';
  const isAuto = source === 'auto';
  const safeSource = safeEncodeURIComponent(source);
  const safeTarget = safeEncodeURIComponent(targetLang);
  const safePageUrl = safeEncodeURIComponent(pageUrl);
  // Bing auto-detects with an empty "from"; Yandex auto-detects when
  // the lang pair only names the target. Neither accepts "auto".
  const bingFrom = isAuto ? '' : safeSource;
  const yandexLang = isAuto ? safeTarget : `${safeSource}-${safeTarget}`;

  const providers = {
    deepl: () =>
      `https://www.deepl.com/translator#${safeSource}/${safeTarget}/${safePageUrl}`,
    bing: () =>
      `https://www.bing.com/translator?from=${bingFrom}&to=${safeTarget}&url=${safePageUrl}`,
    yandex: () =>
      `https://translate.yandex.com/translate?lang=${yandexLang}&url=${safePageUrl}`,
    microsoft: () =>
      `https://www.bing.com/translator?from=${bingFrom}&to=${safeTarget}&url=${safePageUrl}`,
    google: () =>
      `https://translate.google.com/translate?sl=${safeSource}&tl=${safeTarget}&u=${safePageUrl}`
  };
  return (providers[provider] || providers.google)();
};

const isValidPageUrl = (pageUrl) => typeof pageUrl === 'string' && /^https?:\/\//i.test(pageUrl);

/**
 * Pages the extension can never inject a content script into.
 */
const isRestrictedUrl = (url) =>
  typeof url !== 'string' ||
  /^(chrome|edge|brave|opera|vivaldi|about|devtools|view-source|chrome-extension|moz-extension|file):/i.test(
    url
  ) ||
  /^https:\/\/chromewebstore\.google\.com/i.test(url) ||
  /^https:\/\/chrome\.google\.com\/webstore/i.test(url);

const sanitizeHistory = (entries = []) =>
  entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const sourceLang = typeof entry.sourceLang === 'string' ? entry.sourceLang : 'auto';
      const targetLang = typeof entry.targetLang === 'string' ? entry.targetLang : null;
      const provider = typeof entry.provider === 'string' ? entry.provider : DEFAULT_OPTIONS.provider;
      const at = typeof entry.at === 'number' ? entry.at : Date.now();
      if (!targetLang) return null;
      return { sourceLang, targetLang, provider, at };
    })
    .filter(Boolean);

/**
 * Record a translation. History and "last translation" share a single
 * storage.local write so one translation never costs more than one write.
 */
const recordTranslation = async ({ sourceLang, targetLang, provider, text }) => {
  try {
    if (!targetLang) return;
    const { saveHistory } = await getOptions();
    const { translationHistory = [] } = await getLocalData();

    const updates = {
      lastTranslation: {
        text: text || '',
        sourceLang,
        targetLang,
        provider,
        timestamp: Date.now()
      }
    };

    if (saveHistory) {
      const entry = { sourceLang, targetLang, provider, at: Date.now() };
      updates.translationHistory = [entry, ...sanitizeHistory(translationHistory)].slice(
        0,
        MAX_HISTORY
      );
    }

    await setLocalData(updates);
  } catch (error) {
    console.error('Failed to record translation:', error);
  }
};

/**
 * Get top languages from history, merged with fallback targets
 */
const getTopLanguages = async (fallbackTargets, maxMenuLanguages, history) => {
  try {
    const translationHistory = history || (await getLocalData()).translationHistory || [];
    const limit = normalizeMenuLimit(maxMenuLanguages);
    const baseTargets = Array.isArray(fallbackTargets) && fallbackTargets.length ? fallbackTargets : ['en'];
    const counts = {};
    const safeHistory = sanitizeHistory(translationHistory);
    safeHistory.forEach(({ targetLang }) => {
      if (!targetLang) return;
      counts[targetLang] = (counts[targetLang] || 0) + 1;
    });

    const sortedHistory = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code);

    const merged = [...baseTargets];
    sortedHistory.forEach((code) => {
      if (!merged.includes(code)) merged.push(code);
    });

    return merged.slice(0, limit);
  } catch (error) {
    console.error('Failed to get top languages:', error);
    return (fallbackTargets || []).slice(0, DEFAULT_MAX_MENU_LANGUAGES);
  }
};

let menuQueue = Promise.resolve();
let lastMenuSignature = null;

/**
 * Create or update context menu items.
 * Rebuilds are skipped when nothing that affects the menu changed, so a
 * burst of translations does not tear the menu down and back up again.
 */
const createOrUpdateMenu = async (force = false) => {
  menuQueue = menuQueue
    .then(async () => {
      try {
        const { targetLanguages = [], provider, maxMenuLanguages, menuLayout } = await getOptions();
        const { translationHistory = [] } = await getLocalData();
        const layout = normalizeMenuLayout(menuLayout);
        const providerLabel = getProviderLabel(provider);
        const languages = await getTopLanguages(
          targetLanguages.length ? targetLanguages : ['en'],
          maxMenuLanguages,
          translationHistory
        );

        const signature = JSON.stringify([layout, provider, languages]);
        if (!force && signature === lastMenuSignature) return;
        lastMenuSignature = signature;

        await removeAllMenus();

        // Compact layout keeps exactly one item so Chrome shows it at the
        // top level of the context menu instead of nesting it in a submenu.
        if (layout === 'compact') {
          const primary = languages[0] || 'en';
          await safeCreateMenu({
            id: `${MENU_LANG_PREFIX}${primary}`,
            title: getCompactMenuTitle(getLanguageLabel(primary)),
            contexts: ['selection']
          });
          return;
        }

        for (const code of languages) {
          await safeCreateMenu({
            id: `${MENU_LANG_PREFIX}${code}`,
            title: getMenuTitle(getLanguageLabel(code), providerLabel),
            contexts: ['selection']
          });
        }

        await safeCreateMenu({
          id: MENU_NOTE_SEPARATOR_ID,
          type: 'separator',
          contexts: ['selection']
        });

        await safeCreateMenu({
          id: MENU_NOTE_ID,
          title: getSaveNoteTitle(),
          contexts: ['selection']
        });

        for (const code of languages) {
          await safeCreateMenu({
            id: `${MENU_PAGE_LANG_PREFIX}${code}`,
            title: getPageMenuTitle(getLanguageLabel(code), providerLabel),
            contexts: ['page']
          });
        }
      } catch (error) {
        lastMenuSignature = null;
        console.error('Failed to create or update menu:', error);
      }
    })
    .catch((error) => {
      lastMenuSignature = null;
      console.error('Menu queue failed:', error);
    });

  return menuQueue;
};

/**
 * Show a notification and clear it after a delay.
 */
const showNotification = (id, { title, message, priority = 1, timeout = 8000 }) => {
  try {
    chrome.notifications.create(id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority
    });

    setTimeout(() => {
      chrome.notifications.clear(id);
    }, timeout);
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
};

/**
 * Show preview notification
 */
const showPreviewNotification = (provider, targetLang, resultText, previewLimit) => {
  showNotification(`preview_${Date.now()}`, {
    title: getPreviewTitle(getProviderLabel(provider), getLanguageLabel(targetLang)),
    message: resultText.slice(0, previewLimit)
  });
};

const showNoteNotification = (hasTranslation) => {
  showNotification(`note_${Date.now()}`, {
    title: getNoteSavedTitle(),
    message: getNoteSavedMessage(hasTranslation),
    timeout: 5000
  });
};

const showNoteErrorNotification = () => {
  showNotification(`note_error_${Date.now()}`, {
    title: getNoteSavedTitle(),
    message: getNoteSavedError(),
    priority: 2,
    timeout: 5000
  });
};

/**
 * Language detection backends, tried in order of accuracy:
 * 1. Chrome's built-in AI LanguageDetector (Chrome 138+), used only when
 *    its model is already available so we never trigger a download
 * 2. chrome.i18n.detectLanguage (CLD)
 * 3. Bundled ELD library, which works fully offline
 */
let builtinDetectorPromise = null;

const detectWithBuiltinAI = async (text) => {
  try {
    if (typeof LanguageDetector === 'undefined') return null;
    if (!builtinDetectorPromise) {
      builtinDetectorPromise = LanguageDetector.availability()
        .then((availability) =>
          availability === 'available' ? LanguageDetector.create() : null
        )
        .catch(() => null);
    }
    const detector = await builtinDetectorPromise;
    if (!detector) return null;
    const results = await detector.detect(text);
    const top = results?.[0];
    if (!top?.detectedLanguage || top.detectedLanguage === 'und') return null;
    if (typeof top.confidence === 'number' && top.confidence < 0.4) return null;
    return top.detectedLanguage;
  } catch (error) {
    console.warn('Built-in AI language detection failed:', error);
    return null;
  }
};

const detectWithChromeI18n = (text) =>
  new Promise((resolve) => {
    try {
      if (!chrome?.i18n?.detectLanguage) {
        resolve(null);
        return;
      }
      chrome.i18n.detectLanguage(text, (result) => {
        const candidate = result?.languages?.[0]?.language;
        resolve(candidate && candidate !== 'und' ? candidate : null);
      });
    } catch (error) {
      console.warn('chrome.i18n language detection failed:', error);
      resolve(null);
    }
  });

const detectWithEld = (text) => {
  try {
    if (typeof eld === 'undefined' || !eld?.detect) return null;
    return eld.detect(text)?.language || null;
  } catch (error) {
    console.warn('ELD language detection failed:', error);
    return null;
  }
};

/**
 * Detect the language of a text snippet.
 * Resolves to a language code, or null when every backend is
 * unavailable or inconclusive.
 */
const detectTextLanguage = async (text) => {
  const detected =
    (await detectWithBuiltinAI(text)) ||
    (await detectWithChromeI18n(text)) ||
    detectWithEld(text);
  if (!detected) return null;
  // detectors report bare 'zh'; MyMemory expects a region subtag
  return detected === 'zh' ? 'zh-CN' : detected;
};

/**
 * Fetch preview from MyMemory API.
 * MyMemory rejects 'auto' as a source language, so the source is
 * resolved via language detection before building the langpair.
 */
const fetchPreview = async (sourceLang, targetLang, text) => {
  try {
    const source = sourceLang === 'auto' ? await detectTextLanguage(text) : sourceLang;
    if (!source) return null;
    if (source.toLowerCase() === String(targetLang).toLowerCase()) return text;
    const pair = `${source}|${targetLang}`;
    const query = text.slice(0, PREVIEW_QUERY_LIMIT);
    const url = `${PREVIEW_API_URL}?q=${encodeURIComponent(query)}&langpair=${pair}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS) });
    if (!res.ok) {
      await setOnlineState(false);
      return null;
    }
    await setOnlineState(true);
    const data = await res.json();
    // MyMemory returns HTTP 200 with the error text in translatedText;
    // responseStatus is the real outcome
    const status = data?.responseStatus;
    if (status !== undefined && Number(status) !== 200) {
      console.warn('MyMemory API error:', data?.responseDetails || status);
      return null;
    }
    return data?.responseData?.translatedText || null;
  } catch (error) {
    console.warn('Failed to fetch preview:', error);
    await setOnlineState(false);
    return null;
  }
};

/**
 * Make sure the inline popup script is running in the target tab.
 * The content script is injected on demand instead of on every page load,
 * so tabs opened before the extension was installed or updated still work.
 */
const ensureContentScript = async (tabId, tabUrl) => {
  if (typeof tabId !== 'number') return false;
  if (tabUrl && isRestrictedUrl(tabUrl)) return false;

  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: 'xt1Ping' });
    if (pong?.ok) return true;
  } catch (error) {
    // No receiver yet; fall through to injection.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE]
    });
    return true;
  } catch (error) {
    console.warn('Unable to inject the inline translation script:', error);
    return false;
  }
};

const sendToTab = (tabId, message) => {
  try {
    const sending = chrome.tabs.sendMessage(tabId, message);
    if (sending?.catch) sending.catch(() => {});
  } catch (error) {
    // Tab closed or navigated away; nothing to do.
  }
};

/**
 * Show a translation inline on the page.
 * Returns false when the page cannot host the popup so the caller can
 * fall back to opening a provider tab.
 */
const showInlineTranslation = async ({ tab, text, sourceLang, targetLang, provider, url }) => {
  const injected = await ensureContentScript(tab?.id, tab?.url);
  if (!injected) return false;

  const providerLabel = getProviderLabel(provider);
  sendToTab(tab.id, {
    type: 'inlineTranslation',
    phase: 'loading',
    originalText: text,
    providerLabel
  });

  try {
    const result = await fetchPreview(sourceLang, targetLang, text);
    if (result) {
      sendToTab(tab.id, {
        type: 'inlineTranslation',
        phase: 'result',
        originalText: text,
        translatedText: result,
        targetLang,
        targetLabel: getLanguageLabel(targetLang),
        providerLabel,
        providerUrl: url,
        truncated: text.length > PREVIEW_QUERY_LIMIT
      });
    } else {
      sendToTab(tab.id, {
        type: 'inlineTranslation',
        phase: 'error',
        providerLabel,
        providerUrl: url
      });
    }
  } catch (error) {
    console.warn('Inline translation failed:', error);
    sendToTab(tab.id, {
      type: 'inlineTranslation',
      phase: 'error',
      providerLabel,
      providerUrl: url
    });
  }

  return true;
};

/**
 * Handle translation request
 */
const handleTranslation = async ({ text, targetLang, tab }) => {
  try {
    const sanitizedText = sanitizeText(text);
    if (!sanitizedText) {
      console.warn('Empty or invalid text for translation');
      return;
    }

    const { provider, openMode, sourceLang, previewEnabled, previewTextLimit } = await getOptions();
    const previewLimit = normalizePreviewLimit(previewTextLimit);
    const query = encodeURIComponent(sanitizedText);
    const url = buildUrl(provider, sourceLang, targetLang, query);

    recordTranslation({ sourceLang, targetLang, provider, text: sanitizedText });

    if (openMode === 'inline') {
      const shown = await showInlineTranslation({
        tab,
        text: sanitizedText,
        sourceLang,
        targetLang,
        provider,
        url
      });
      if (shown) return;
      // Restricted page (PDF viewer, web store, browser UI): the inline
      // popup cannot be shown there, so open the provider instead.
      await chrome.tabs.create({ url });
      return;
    }

    if (previewEnabled && sanitizedText.length <= previewLimit) {
      fetchPreview(sourceLang, targetLang, sanitizedText)
        .then((result) => {
          if (result) {
            showPreviewNotification(provider, targetLang, result, previewLimit);
          }
        })
        .catch((error) => {
          console.warn('Preview error (non-blocking):', error);
        });
    }

    if (openMode === 'currentTab' && tab?.id) {
      await chrome.tabs.update(tab.id, { url });
    } else {
      await chrome.tabs.create({ url });
    }
  } catch (error) {
    console.error('Failed to handle translation:', error);
  }
};

/**
 * Handle page translation request
 */
const handlePageTranslation = async ({ targetLang, tab, pageUrl }) => {
  try {
    const { provider, openMode, sourceLang } = await getOptions();
    if (!isValidPageUrl(pageUrl)) return;

    const url = buildPageUrl(provider, sourceLang, targetLang, pageUrl);

    // A whole page cannot be rendered inside the inline popup, so inline
    // mode falls back to the current tab for page translations.
    if (openMode !== 'newTab' && tab?.id) {
      await chrome.tabs.update(tab.id, { url });
    } else {
      await chrome.tabs.create({ url });
    }

    recordTranslation({ sourceLang, targetLang, provider, text: pageUrl });
  } catch (error) {
    console.error('Failed to handle page translation:', error);
  }
};

/**
 * Handle save note request
 */
const handleSaveNote = async ({ text, targetLang, sourceLang, provider, url }) => {
  try {
    const sanitizedText = sanitizeText(text);
    const trimmed = trimNoteText(sanitizedText);
    if (!trimmed) return;

    const { notesAutoTranslate, previewTextLimit } = await getOptions();
    const previewLimit = normalizePreviewLimit(previewTextLimit);
    let translatedText = '';

    if (notesAutoTranslate && trimmed.length <= previewLimit) {
      translatedText = (await fetchPreview(sourceLang, targetLang, trimmed)) || '';
    }

    await addNote({
      id: createNoteId(),
      sourceText: trimmed,
      translatedText,
      sourceLang,
      targetLang,
      provider,
      tag: '',
      url: isValidPageUrl(url) ? url : '',
      createdAt: Date.now(),
      origin: 'selection'
    });

    showNoteNotification(Boolean(translatedText));
  } catch (error) {
    console.error('Failed to save note:', error);
    showNoteErrorNotification();
  }
};

/**
 * Handle context menu click
 */
const onMenuClick = async (info, tab) => {
  try {
    const menuId = String(info.menuItemId);
    const { targetLanguages = [], provider, sourceLang } = await getOptions();
    const primaryTarget = targetLanguages[0] || 'en';

    if (menuId === MENU_NOTE_ID) {
      if (!info.selectionText) return;
      const selected = info.selectionText.trim();
      if (!selected) return;
      const pageUrl = info.pageUrl || tab?.url;
      await handleSaveNote({
        text: selected,
        targetLang: primaryTarget,
        sourceLang,
        provider,
        url: pageUrl
      });
      return;
    }

    if (menuId.startsWith(MENU_LANG_PREFIX)) {
      if (!info.selectionText) return;
      const selected = info.selectionText.trim();
      if (!selected) return;

      const target = menuId.replace(MENU_LANG_PREFIX, '');

      await handleTranslation({ text: selected, targetLang: target, tab });
      return;
    }

    if (menuId.startsWith(MENU_PAGE_LANG_PREFIX)) {
      const target = menuId.replace(MENU_PAGE_LANG_PREFIX, '');
      const pageUrl = info.pageUrl || tab?.url;
      await handlePageTranslation({ targetLang: target, tab, pageUrl });
    }
  } catch (error) {
    console.error('Failed to handle menu click:', error);
  }
};

/**
 * Read the current selection from a tab.
 */
const readSelection = async (tab) => {
  if (!tab?.id || isRestrictedUrl(tab.url)) return '';
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || ''
    });
    return (result && result[0]?.result?.trim()) || '';
  } catch (error) {
    console.warn('Unable to read the current selection:', error);
    return '';
  }
};

/**
 * Handle keyboard shortcut command
 */
const onCommand = async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (command === 'translate-selection') {
      const selected = await readSelection(tab);
      if (!selected) return;

      const { targetLanguages = [] } = await getOptions();
      const target = targetLanguages[0] || 'en';
      await handleTranslation({ text: selected, targetLang: target, tab });
      return;
    }

    if (command === 'translate-page') {
      const pageUrl = tab.url;
      if (!isValidPageUrl(pageUrl)) return;

      const { targetLanguages = [] } = await getOptions();
      const target = targetLanguages[0] || 'en';
      await handlePageTranslation({ targetLang: target, tab, pageUrl });
    }
  } catch (error) {
    console.error('Failed to handle command:', error);
  }
};

/**
 * Messages from the popup (quick translate).
 */
const onRuntimeMessage = (message, sender, sendResponse) => {
  if (message?.type !== 'quickTranslate') return undefined;

  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        sendResponse({ ok: false, reason: 'noTab' });
        return;
      }

      const selected = message.text?.trim() || (await readSelection(tab));
      if (!selected) {
        sendResponse({ ok: false, reason: 'noSelection' });
        return;
      }

      const { targetLanguages = [] } = await getOptions();
      const target = message.targetLang || targetLanguages[0] || 'en';
      await handleTranslation({ text: selected, targetLang: target, tab });
      sendResponse({ ok: true });
    } catch (error) {
      console.error('Quick translate failed:', error);
      sendResponse({ ok: false, reason: 'error' });
    }
  })();

  return true; // keep the message channel open for the async response
};

/**
 * Move user data written by older versions out of storage.sync.
 * storage.sync allows only 120 writes per minute, and the old layout spent
 * two of them on every single translation.
 */
const migrateLegacyStorage = async () => {
  try {
    const legacy = await new Promise((resolve) => {
      chrome.storage.sync.get({ translationHistory: null, lastTranslation: null }, resolve);
    });

    const hasLegacyHistory = Array.isArray(legacy.translationHistory);
    const hasLegacyLast = Boolean(legacy.lastTranslation);
    if (!hasLegacyHistory && !hasLegacyLast) return;

    const local = await getLocalData();
    const updates = {};

    if (hasLegacyHistory && !(local.translationHistory || []).length) {
      updates.translationHistory = sanitizeHistory(legacy.translationHistory);
    }
    if (hasLegacyLast && !local.lastTranslation) {
      updates.lastTranslation = legacy.lastTranslation;
    }

    if (Object.keys(updates).length) await setLocalData(updates);

    if (chrome.storage.sync.remove) {
      await new Promise((resolve) => {
        chrome.storage.sync.remove(['translationHistory', 'lastTranslation'], () => {
          chrome.runtime.lastError;
          resolve();
        });
      });
    }
  } catch (error) {
    console.warn('Storage migration skipped:', error);
  }
};

/**
 * Ensure default options are set on install
 */
const ensureDefaultsOnInstall = async () => {
  try {
    const options = await getOptions();
    const next = { ...DEFAULT_OPTIONS };

    if (Array.isArray(options.targetLanguages) && options.targetLanguages.length) {
      next.targetLanguages = options.targetLanguages;
    } else if (options.targetLang) {
      next.targetLanguages = [options.targetLang];
    }

    next.provider = options.provider ?? DEFAULT_OPTIONS.provider;
    next.openMode = options.openMode ?? DEFAULT_OPTIONS.openMode;
    next.menuLayout = normalizeMenuLayout(options.menuLayout ?? DEFAULT_OPTIONS.menuLayout);
    next.sourceLang = options.sourceLang ?? DEFAULT_OPTIONS.sourceLang;
    next.previewEnabled = options.previewEnabled ?? DEFAULT_OPTIONS.previewEnabled;
    next.saveHistory = options.saveHistory ?? DEFAULT_OPTIONS.saveHistory;
    next.maxMenuLanguages = normalizeMenuLimit(
      options.maxMenuLanguages ?? DEFAULT_OPTIONS.maxMenuLanguages
    );
    next.previewTextLimit = normalizePreviewLimit(
      options.previewTextLimit ?? DEFAULT_OPTIONS.previewTextLimit
    );
    next.notesAutoTranslate = options.notesAutoTranslate ?? DEFAULT_OPTIONS.notesAutoTranslate;

    await setOptions(next);
  } catch (error) {
    console.error('Failed to ensure defaults on install:', error);
  }
};

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  await migrateLegacyStorage();
  await ensureDefaultsOnInstall();
  await createOrUpdateMenu(true);

  // Show the options page once on a fresh install so the open-mode and
  // context-menu choices are discoverable instead of hidden.
  if (details?.reason === 'install') {
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.warn('Unable to open the options page:', error);
    }
  }
});

/**
 * Re-initialize menu on browser startup
 */
chrome.runtime.onStartup.addListener(() => {
  createOrUpdateMenu(true);
});

/**
 * Listen for context menu clicks
 */
chrome.contextMenus.onClicked.addListener(onMenuClick);

/**
 * Listen for keyboard shortcut commands
 */
chrome.commands.onCommand.addListener(onCommand);

/**
 * Listen for popup requests
 */
chrome.runtime.onMessage.addListener(onRuntimeMessage);

/**
 * Update menu when settings or usage data change
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === 'sync' &&
    (changes.targetLanguages ||
      changes.provider ||
      changes.maxMenuLanguages ||
      changes.menuLayout)
  ) {
    createOrUpdateMenu();
    return;
  }

  if (area === 'local' && changes.translationHistory) {
    createOrUpdateMenu();
  }
});
