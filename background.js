const MENU_ID = 'rightClickTranslate';
const MENU_PAGE_ID = 'rightClickTranslatePage';
const MENU_LANG_PREFIX = 'rightClickTranslateLang_';
const MENU_PAGE_LANG_PREFIX = 'rightClickTranslatePageLang_';
const SUBMENU_ID = `${MENU_ID}_submenu`;
const SUBMENU_PAGE_ID = `${MENU_PAGE_ID}_submenu`;
const MAX_HISTORY = 20;
const DEFAULT_MAX_MENU_LANGUAGES = 6;
const MIN_MENU_LANGUAGES = 1;
const MAX_MENU_LANGUAGES_CAP = 12;
const DEFAULT_PREVIEW_TEXT_LIMIT = 180;
const MIN_PREVIEW_TEXT_LIMIT = 60;
const MAX_PREVIEW_TEXT_LIMIT = 500;
const PREVIEW_API_URL = 'https://api.mymemory.translated.net/get';

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
  translationHistory: []
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

const getSubmenuTitle = () => getMessage('menuTranslateSubmenuTitle', null, 'Translate to...');

const getPageSubmenuTitle = () =>
  getMessage('menuTranslatePageSubmenuTitle', null, 'Translate page to...');

const getPreviewTitle = (providerLabel, targetLabel) =>
  getMessage(
    'notificationPreviewTitle',
    [providerLabel, targetLabel],
    `Preview (${providerLabel} to ${targetLabel})`
  );

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

/**
 * Build translation URL for the selected provider
 */
const buildUrl = (provider, sourceLang, targetLang, query) => {
  const source = sourceLang || 'auto';
  const providers = {
    deepl: () =>
      `https://www.deepl.com/translator#${encodeURIComponent(source)}/${encodeURIComponent(
        targetLang
      )}/${query}`,
    bing: () =>
      `https://www.bing.com/translator?text=${query}&from=${encodeURIComponent(
        source
      )}&to=${encodeURIComponent(targetLang)}`,
    yandex: () =>
      `https://translate.yandex.com/?source_lang=${encodeURIComponent(
        source
      )}&target_lang=${encodeURIComponent(targetLang)}&text=${query}`,
    microsoft: () =>
      `https://www.bing.com/translator?text=${query}&from=${encodeURIComponent(
        source
      )}&to=${encodeURIComponent(targetLang)}`,
    google: () =>
      `https://translate.google.com/?sl=${encodeURIComponent(
        source
      )}&tl=${encodeURIComponent(targetLang)}&text=${query}&op=translate`
  };
  return (providers[provider] || providers.google)();
};

/**
 * Build page translation URL for the selected provider
 */
const buildPageUrl = (provider, sourceLang, targetLang, pageUrl) => {
  const source = sourceLang || 'auto';
  const providers = {
    deepl: () =>
      `https://www.deepl.com/translator#${encodeURIComponent(source)}/${encodeURIComponent(
        targetLang
      )}/${encodeURIComponent(pageUrl)}`,
    bing: () =>
      `https://www.bing.com/translator?from=${encodeURIComponent(
        source
      )}&to=${encodeURIComponent(targetLang)}&url=${encodeURIComponent(pageUrl)}`,
    yandex: () =>
      `https://translate.yandex.com/translate?lang=${encodeURIComponent(
        source
      )}-${encodeURIComponent(targetLang)}&url=${encodeURIComponent(pageUrl)}`,
    microsoft: () =>
      `https://www.bing.com/translator?from=${encodeURIComponent(
        source
      )}&to=${encodeURIComponent(targetLang)}&url=${encodeURIComponent(pageUrl)}`,
    google: () =>
      `https://translate.google.com/translate?sl=${encodeURIComponent(
        source
      )}&tl=${encodeURIComponent(targetLang)}&u=${encodeURIComponent(pageUrl)}`
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
        const primaryTarget = targetLanguages[0] || 'en';
        const providerLabel = getProviderLabel(provider);
        const menuTitle = getMenuTitle(getLanguageLabel(primaryTarget), providerLabel);
        const pageTitle = getPageMenuTitle(getLanguageLabel(primaryTarget), providerLabel);
        const languages = await getTopLanguages(
          targetLanguages.length ? targetLanguages : ['en'],
          maxMenuLanguages
        );

        await removeAllMenus();

        await safeCreateMenu({
          id: MENU_ID,
          title: menuTitle,
          contexts: ['selection']
        });

        await safeCreateMenu({
          id: SUBMENU_ID,
          title: getSubmenuTitle(),
          parentId: MENU_ID,
          contexts: ['selection']
        });

        await Promise.all(
          languages.map((code) =>
            safeCreateMenu({
              id: `${MENU_LANG_PREFIX}${code}`,
              parentId: SUBMENU_ID,
              title: getLanguageLabel(code),
              contexts: ['selection']
            })
          )
        );

        await safeCreateMenu({
          id: MENU_PAGE_ID,
          title: pageTitle,
          contexts: ['page']
        });

        await safeCreateMenu({
          id: SUBMENU_PAGE_ID,
          title: getPageSubmenuTitle(),
          parentId: MENU_PAGE_ID,
          contexts: ['page']
        });

        await Promise.all(
          languages.map((code) =>
            safeCreateMenu({
              id: `${MENU_PAGE_LANG_PREFIX}${code}`,
              parentId: SUBMENU_PAGE_ID,
              title: getLanguageLabel(code),
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

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: getPreviewTitle(providerLabel, targetLabel),
      message
    });
  } catch (error) {
    console.error('Failed to show preview notification:', error);
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
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.responseData?.translatedText || null;
  } catch (error) {
    console.warn('Failed to fetch preview:', error);
    return null;
  }
};

/**
 * Handle translation request
 */
const handleTranslation = async ({ text, targetLang, tab }) => {
  try {
    const { provider, openMode, sourceLang, previewEnabled, previewTextLimit } = await getOptions();
    const previewLimit = normalizePreviewLimit(previewTextLimit);
    const query = encodeURIComponent(text);
    const url = buildUrl(provider, sourceLang, targetLang, query);

    if (previewEnabled && text.length <= previewLimit) {
      fetchPreview(sourceLang, targetLang, text)
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
 * Handle context menu click
 */
const onMenuClick = async (info, tab) => {
  try {
    const menuId = String(info.menuItemId);
    const { targetLanguages = [] } = await getOptions();
    const primaryTarget = targetLanguages[0] || 'en';

    if (menuId === MENU_ID || menuId.startsWith(MENU_LANG_PREFIX)) {
      if (!info.selectionText) return;
      const selected = info.selectionText.trim();
      if (!selected) return;

      const target = menuId.startsWith(MENU_LANG_PREFIX)
        ? menuId.replace(MENU_LANG_PREFIX, '')
        : primaryTarget;

      handleTranslation({ text: selected, targetLang: target, tab });
      return;
    }

    if (menuId === MENU_PAGE_ID || menuId.startsWith(MENU_PAGE_LANG_PREFIX)) {
      const target = menuId.startsWith(MENU_PAGE_LANG_PREFIX)
        ? menuId.replace(MENU_PAGE_LANG_PREFIX, '')
        : primaryTarget;
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

      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection()?.toString() || ''
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
