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
const NOTES_STORAGE_KEY = 'savedNotes';
const NOTES_MAX_ITEMS = 200;
const NOTES_TEXT_LIMIT = 2000;

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

const DEFAULT_OPTIONS = {
  sourceLang: 'auto',
  targetLanguages: ['en', 'es', 'pl'],
  provider: 'google',
  openMode: 'newTab',
  previewEnabled: true,
  saveHistory: true,
  maxMenuLanguages: DEFAULT_MAX_MENU_LANGUAGES,
  previewTextLimit: DEFAULT_PREVIEW_TEXT_LIMIT,
  notesAutoTranslate: true,
  translationHistory: [],
  lastTranslation: null,
  isOnline: true
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
 * Promisified Chrome Storage API
 */
const getOptions = () =>
  new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_OPTIONS, resolve);
  });

const setOptions = (values) =>
  new Promise((resolve) => {
    chrome.storage.sync.set(values, resolve);
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
  new Promise((resolve) => {
    chrome.storage.local.set({ [NOTES_STORAGE_KEY]: notes }, resolve);
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
  const safeSource = safeEncodeURIComponent(source);
  const safeTarget = safeEncodeURIComponent(targetLang);
  const safeQuery = query; // Already encoded by caller
  
  const providers = {
    deepl: () =>
      `https://www.deepl.com/translator#${safeSource}/${safeTarget}/${safeQuery}`,
    bing: () =>
      `https://www.bing.com/translator?text=${safeQuery}&from=${safeSource}&to=${safeTarget}`,
    yandex: () =>
      `https://translate.yandex.com/?source_lang=${safeSource}&target_lang=${safeTarget}&text=${safeQuery}`,
    microsoft: () =>
      `https://www.bing.com/translator?text=${safeQuery}&from=${safeSource}&to=${safeTarget}`,
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
  const safeSource = safeEncodeURIComponent(source);
  const safeTarget = safeEncodeURIComponent(targetLang);
  const safePageUrl = safeEncodeURIComponent(pageUrl);
  
  const providers = {
    deepl: () =>
      `https://www.deepl.com/translator#${safeSource}/${safeTarget}/${safePageUrl}`,
    bing: () =>
      `https://www.bing.com/translator?from=${safeSource}&to=${safeTarget}&url=${safePageUrl}`,
    yandex: () =>
      `https://translate.yandex.com/translate?lang=${safeSource}-${safeTarget}&url=${safePageUrl}`,
    microsoft: () =>
      `https://www.bing.com/translator?from=${safeSource}&to=${safeTarget}&url=${safePageUrl}`,
    google: () =>
      `https://translate.google.com/translate?sl=${safeSource}&tl=${safeTarget}&u=${safePageUrl}`
  };
  return (providers[provider] || providers.google)();
};

const isValidPageUrl = (pageUrl) => typeof pageUrl === 'string' && /^https?:\/\//i.test(pageUrl);

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
 * Record translation in history
 */
const recordHistory = async ({ sourceLang, targetLang, provider }) => {
  try {
    if (!targetLang) return;
    const { translationHistory = [], saveHistory } = await getOptions();
    if (!saveHistory) return;

    const entry = {
      sourceLang,
      targetLang,
      provider,
      at: Date.now()
    };
    const safeHistory = sanitizeHistory(translationHistory);
    const next = [entry, ...safeHistory].slice(0, MAX_HISTORY);
    await setOptions({ translationHistory: next });
  } catch (error) {
    console.error('Failed to record translation history:', error);
  }
};

/**
 * Get top languages from history, merged with fallback targets
 */
const getTopLanguages = async (fallbackTargets, maxMenuLanguages) => {
  try {
    const { translationHistory = [] } = await getOptions();
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

/**
 * Create or update context menu items
 */
const createOrUpdateMenu = async () => {
  menuQueue = menuQueue
    .then(async () => {
      try {
        const { targetLanguages = [], provider, maxMenuLanguages } = await getOptions();
        const providerLabel = getProviderLabel(provider);
        const languages = await getTopLanguages(
          targetLanguages.length ? targetLanguages : ['en'],
          maxMenuLanguages
        );

        await removeAllMenus();

        await Promise.all(
          languages.map((code) =>
            safeCreateMenu({
              id: `${MENU_LANG_PREFIX}${code}`,
              title: getMenuTitle(getLanguageLabel(code), providerLabel),
              contexts: ['selection']
            })
          )
        );

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

        await Promise.all(
          languages.map((code) =>
            safeCreateMenu({
              id: `${MENU_PAGE_LANG_PREFIX}${code}`,
              title: getPageMenuTitle(getLanguageLabel(code), providerLabel),
              contexts: ['page']
            })
          )
        );
      } catch (error) {
        console.error('Failed to create or update menu:', error);
      }
    });
};

/**
 * Show preview notification
 */
const showPreviewNotification = (provider, targetLang, resultText, previewLimit) => {
  try {
    const providerLabel = getProviderLabel(provider);
    const targetLabel = getLanguageLabel(targetLang);
    const message = resultText.slice(0, previewLimit);

    const notificationId = `preview_${Date.now()}`;
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: getPreviewTitle(providerLabel, targetLabel),
      message,
      priority: 1
    });
    
    // Auto-clear notification after 8 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 8000);
  } catch (error) {
    console.error('Failed to show preview notification:', error);
  }
};

const showNoteNotification = (hasTranslation) => {
  try {
    const notificationId = `note_${Date.now()}`;
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: getNoteSavedTitle(),
      message: getNoteSavedMessage(hasTranslation),
      priority: 1
    });
    
    // Auto-clear notification after 5 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 5000);
  } catch (error) {
    console.error('Failed to show note notification:', error);
  }
};

const showNoteErrorNotification = () => {
  try {
    const notificationId = `note_error_${Date.now()}`;
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: getNoteSavedTitle(),
      message: getNoteSavedError(),
      priority: 2
    });
    
    // Auto-clear notification after 5 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 5000);
  } catch (error) {
    console.error('Failed to show note error notification:', error);
  }
};

/**
 * Fetch preview from MyMemory API
 */
const fetchPreview = async (sourceLang, targetLang, text) => {
  try {
    const source = sourceLang === 'auto' ? 'auto' : sourceLang;
    const pair = `${source}|${targetLang}`;
    const url = `${PREVIEW_API_URL}?q=${encodeURIComponent(text)}&langpair=${pair}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      await setOptions({ isOnline: false });
      return null;
    }
    await setOptions({ isOnline: true });
    const data = await res.json();
    return data?.responseData?.translatedText || null;
  } catch (error) {
    console.warn('Failed to fetch preview:', error);
    await setOptions({ isOnline: false });
    return null;
  }
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

    // Store last translation for popup quick access
    await setOptions({
      lastTranslation: {
        text: sanitizedText,
        sourceLang,
        targetLang,
        provider,
        timestamp: Date.now()
      }
    });

    if (openMode === 'inline') {
      if (tab?.id) {
        const providerLabel = getProviderLabel(provider);
        chrome.tabs.sendMessage(tab.id, {
          type: 'inlineTranslation',
          phase: 'loading',
          originalText: sanitizedText,
          providerLabel
        }).catch(() => {});

        fetchPreview(sourceLang, targetLang, sanitizedText)
          .then((result) => {
            if (result) {
              chrome.tabs.sendMessage(tab.id, {
                type: 'inlineTranslation',
                phase: 'result',
                originalText: sanitizedText,
                translatedText: result,
                targetLang,
                providerLabel
              }).catch(() => {});
            } else {
              chrome.tabs.sendMessage(tab.id, {
                type: 'inlineTranslation',
                phase: 'error',
                error: 'Translation unavailable.'
              }).catch(() => {});
            }
          })
          .catch(() => {
            chrome.tabs.sendMessage(tab.id, {
              type: 'inlineTranslation',
              phase: 'error',
              error: 'Translation failed.'
            }).catch(() => {});
          });
      }
      recordHistory({ sourceLang, targetLang, provider });
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

    recordHistory({ sourceLang, targetLang, provider });
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

    if (openMode === 'currentTab' && tab?.id) {
      await chrome.tabs.update(tab.id, { url });
    } else {
      await chrome.tabs.create({ url });
    }

    recordHistory({ sourceLang, targetLang, provider });
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

      handleTranslation({ text: selected, targetLang: target, tab });
      return;
    }

    if (menuId.startsWith(MENU_PAGE_LANG_PREFIX)) {
      const target = menuId.replace(MENU_PAGE_LANG_PREFIX, '');
      const pageUrl = info.pageUrl || tab?.url;
      handlePageTranslation({ targetLang: target, tab, pageUrl });
    }
  } catch (error) {
    console.error('Failed to handle menu click:', error);
  }
};

/**
 * Handle keyboard shortcut command
 */
const onCommand = async (command) => {
  try {
    if (command === 'translate-selection') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      
      // Check if tab URL is scriptable
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || 
          tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://'))) {
        console.warn('Cannot run script on browser internal page');
        return;
      }

      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() || ''
      }).catch((error) => {
        console.error('Script execution failed:', error);
        return null;
      });

      const selected = (result && result[0]?.result?.trim()) || '';
      if (!selected) return;

      const { targetLanguages = [] } = await getOptions();
      const target = targetLanguages[0] || 'en';
      handleTranslation({ text: selected, targetLang: target, tab });
      return;
    }

    if (command === 'translate-page') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      const pageUrl = tab.url;
      if (!isValidPageUrl(pageUrl)) return;

      const { targetLanguages = [] } = await getOptions();
      const target = targetLanguages[0] || 'en';
      handlePageTranslation({ targetLang: target, tab, pageUrl });
    }
  } catch (error) {
    console.error('Failed to handle command:', error);
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
    next.translationHistory = sanitizeHistory(
      options.translationHistory ?? DEFAULT_OPTIONS.translationHistory
    );

    await setOptions(next);
  } catch (error) {
    console.error('Failed to ensure defaults on install:', error);
  }
};

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaultsOnInstall();
  createOrUpdateMenu();
});

/**
 * Re-initialize menu on browser startup
 */
chrome.runtime.onStartup.addListener(() => {
  createOrUpdateMenu();
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
 * Update menu when settings change
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === 'sync' &&
    (changes.targetLanguages ||
      changes.openMode ||
      changes.provider ||
      changes.translationHistory ||
      changes.maxMenuLanguages)
  ) {
    createOrUpdateMenu();
  }
});
