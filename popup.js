const LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'nl', name: 'Dutch' },
  { code: 'sv', name: 'Swedish' }
];

const PROVIDERS = {
  google: 'Google',
  deepl: 'DeepL',
  bing: 'Bing',
  yandex: 'Yandex',
  microsoft: 'Microsoft'
};

const DEFAULT_OPTIONS = {
  targetLanguages: ['en'],
  provider: 'google',
  openMode: 'newTab',
  previewEnabled: true,
  sourceLang: 'auto',
  themeMode: 'auto'
};

const DEFAULT_LOCAL_DATA = {
  lastTranslation: null,
  isOnline: true
};

const elements = {
  primaryLang: document.getElementById('primaryLang'),
  providerLabel: document.getElementById('providerLabel'),
  openModeSelect: document.getElementById('openModeSelect'),
  previewToggle: document.getElementById('previewToggle'),
  openOptions: document.getElementById('openOptions'),
  swapLanguages: document.getElementById('swapLanguages'),
  translateSelection: document.getElementById('translateSelection'),
  copyLastTranslation: document.getElementById('copyLastTranslation'),
  lastTranslation: document.getElementById('lastTranslation'),
  lastTranslationText: document.getElementById('lastTranslationText'),
  lastTranslationLangs: document.getElementById('lastTranslationLangs'),
  lastTranslationTime: document.getElementById('lastTranslationTime'),
  onlineStatus: document.getElementById('onlineStatus'),
  status: document.getElementById('status')
};

const getMessage = (key, substitutions, fallback) => {
  if (chrome?.i18n?.getMessage) {
    const msg = chrome.i18n.getMessage(key, substitutions);
    if (msg) return msg;
  }
  return fallback || '';
};

const applyI18n = () => {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const message = getMessage(key);
    if (message) el.textContent = message;
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    const message = getMessage(key);
    if (message) el.setAttribute('title', message);
  });

  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    const message = getMessage(key);
    if (message) el.setAttribute('aria-label', message);
  });

  const title = getMessage('popupTitle', null, document.title);
  if (title) document.title = title;
};

const getLanguageLabel = (code) => {
  const lang = LANGUAGES.find((item) => item.code === code);
  return lang ? `${lang.name} (${lang.code})` : code;
};

const getOpenModeLabel = (mode) => {
  if (mode === 'currentTab') {
    return getMessage('popupOpenModeCurrentTab', null, 'Current tab');
  }
  if (mode === 'inline') {
    return getMessage('popupOpenModeInline', null, 'On the page');
  }
  return getMessage('popupOpenModeNewTab', null, 'New tab');
};

const setStatus = (message, tone) => {
  elements.status.textContent = message;
  elements.status.classList.remove('success', 'error');
  if (tone) elements.status.classList.add(tone);
  if (setStatus.timer) clearTimeout(setStatus.timer);
  setStatus.timer = setTimeout(() => {
    elements.status.textContent = '';
    elements.status.classList.remove('success', 'error');
  }, 2500);
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return getMessage('popupJustNow', null, 'just now');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return getMessage('popupMinutesAgo', [String(minutes)], `${minutes}m ago`);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return getMessage('popupHoursAgo', [String(hours)], `${hours}h ago`);
  const days = Math.floor(hours / 24);
  return getMessage('popupDaysAgo', [String(days)], `${days}d ago`);
};

const storageGet = (area, defaults) =>
  new Promise((resolve, reject) => {
    chrome.storage[area].get(defaults, (values) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(values);
    });
  });

const storageSet = (area, values) =>
  new Promise((resolve, reject) => {
    chrome.storage[area].set(values, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });

let lastTranslationText = '';

const refreshLastTranslation = (lastTrans) => {
  if (lastTrans && lastTrans.text) {
    lastTranslationText = lastTrans.text;
    elements.lastTranslation.classList.remove('hidden');
    elements.lastTranslationText.textContent = lastTrans.text;
    const srcLabel =
      LANGUAGES.find((l) => l.code === lastTrans.sourceLang)?.name || lastTrans.sourceLang;
    const tgtLabel =
      LANGUAGES.find((l) => l.code === lastTrans.targetLang)?.name || lastTrans.targetLang;
    elements.lastTranslationLangs.textContent = `${srcLabel} → ${tgtLabel}`;
    elements.lastTranslationTime.textContent = formatTimeAgo(lastTrans.timestamp);
  } else {
    lastTranslationText = '';
    elements.lastTranslation.classList.add('hidden');
  }
};

const applyTheme = (themeMode) => {
  if (themeMode === 'dark') {
    document.documentElement.dataset.theme = 'dark';
  } else if (themeMode === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
};

const refreshSummary = async () => {
  try {
    const [options, local] = await Promise.all([
      storageGet('sync', DEFAULT_OPTIONS),
      storageGet('local', DEFAULT_LOCAL_DATA)
    ]);

    const primary =
      Array.isArray(options.targetLanguages) && options.targetLanguages.length
        ? options.targetLanguages[0]
        : DEFAULT_OPTIONS.targetLanguages[0];
    elements.primaryLang.textContent = getLanguageLabel(primary || 'en');
    elements.providerLabel.textContent = PROVIDERS[options.provider] || PROVIDERS.google;
    elements.openModeSelect.value = options.openMode || DEFAULT_OPTIONS.openMode;
    elements.previewToggle.checked = options.previewEnabled ?? DEFAULT_OPTIONS.previewEnabled;

    applyTheme(options.themeMode || DEFAULT_OPTIONS.themeMode);
    refreshLastTranslation(local.lastTranslation);

    // Connectivity state is device-specific, so it lives in storage.local.
    const offline = local.isOnline === false && options.previewEnabled;
    elements.onlineStatus.classList.toggle('hidden', !offline);
  } catch (error) {
    console.error('Failed to load popup state:', error);
    setStatus(getMessage('popupStatusError', null, 'Unable to load settings.'), 'error');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  refreshSummary();

  elements.previewToggle.addEventListener('change', async () => {
    try {
      await storageSet('sync', { previewEnabled: elements.previewToggle.checked });
      setStatus(getMessage('popupStatusSaved', null, 'Saved.'), 'success');
    } catch (error) {
      setStatus(getMessage('popupStatusError', null, 'Unable to save.'), 'error');
    }
  });

  elements.openModeSelect.addEventListener('change', async () => {
    try {
      await storageSet('sync', { openMode: elements.openModeSelect.value });
      setStatus(getMessage('popupStatusSaved', null, 'Saved.'), 'success');
    } catch (error) {
      setStatus(getMessage('popupStatusError', null, 'Unable to save.'), 'error');
    }
  });

  elements.openOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  elements.translateSelection.addEventListener('click', () => {
    elements.translateSelection.disabled = true;
    setStatus(getMessage('popupTranslating', null, 'Translating...'), null);

    chrome.runtime.sendMessage({ type: 'quickTranslate' }, (response) => {
      elements.translateSelection.disabled = false;

      if (chrome.runtime.lastError || !response) {
        setStatus(getMessage('popupTranslateFailed', null, 'Translation failed.'), 'error');
        return;
      }

      if (response.ok) {
        // The inline popup renders on the page, so close ours to reveal it.
        window.close();
        return;
      }

      if (response.reason === 'noSelection') {
        setStatus(getMessage('popupNoSelection', null, 'Select some text on the page first.'), 'error');
        return;
      }

      setStatus(getMessage('popupTranslateFailed', null, 'Translation failed.'), 'error');
    });
  });

  elements.swapLanguages.addEventListener('click', async () => {
    try {
      const options = await storageGet('sync', DEFAULT_OPTIONS);
      const sourceLang = options.sourceLang || 'auto';
      const targetLanguages = Array.isArray(options.targetLanguages) ? options.targetLanguages : [];
      const primaryTarget = targetLanguages[0];

      if (sourceLang === 'auto') {
        setStatus(getMessage('popupSwapAuto', null, 'Cannot swap from auto-detect.'), 'error');
        return;
      }

      if (!primaryTarget) {
        setStatus(getMessage('popupSwapNoTarget', null, 'No target language set.'), 'error');
        return;
      }

      // Old source becomes the primary target; the old primary target
      // becomes the source. Remaining targets are left untouched.
      const newTargets = [sourceLang, ...targetLanguages.slice(1).filter((c) => c !== sourceLang)];
      await storageSet('sync', { sourceLang: primaryTarget, targetLanguages: newTargets });
      setStatus(getMessage('popupSwapped', null, 'Languages swapped.'), 'success');
      refreshSummary();
    } catch (error) {
      console.error('Failed to swap languages:', error);
      setStatus(getMessage('popupSwapFailed', null, 'Unable to swap.'), 'error');
    }
  });

  elements.copyLastTranslation.addEventListener('click', async () => {
    if (!lastTranslationText) return;
    try {
      await navigator.clipboard.writeText(lastTranslationText);
      setStatus(getMessage('popupCopied', null, 'Copied to clipboard.'), 'success');
    } catch (error) {
      setStatus(getMessage('popupCopyFailed', null, 'Failed to copy.'), 'error');
    }
  });
});
