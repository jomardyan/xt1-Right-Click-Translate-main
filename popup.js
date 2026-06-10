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
  themeMode: 'auto',
  lastTranslation: null,
  isOnline: true
};

const elements = {
  primaryLang: document.getElementById('primaryLang'),
  providerLabel: document.getElementById('providerLabel'),
  openModeLabel: document.getElementById('openModeLabel'),
  previewToggle: document.getElementById('previewToggle'),
  openOptions: document.getElementById('openOptions'),
  swapLanguages: document.getElementById('swapLanguages'),
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
    return getMessage('popupOpenModeInline', null, 'Inline');
  }
  return getMessage('popupOpenModeNewTab', null, 'New tab');
};

const setStatus = (message, tone) => {
  elements.status.textContent = message;
  elements.status.classList.remove('success', 'error');
  if (tone) elements.status.classList.add(tone);
  setTimeout(() => {
    elements.status.textContent = '';
    elements.status.classList.remove('success', 'error');
  }, 2500);
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const refreshLastTranslation = (options) => {
  const lastTrans = options.lastTranslation;
  if (lastTrans && lastTrans.text) {
    elements.lastTranslation.classList.remove('hidden');
    elements.lastTranslationText.textContent = lastTrans.text;
    const srcLabel = LANGUAGES.find(l => l.code === lastTrans.sourceLang)?.name || lastTrans.sourceLang;
    const tgtLabel = LANGUAGES.find(l => l.code === lastTrans.targetLang)?.name || lastTrans.targetLang;
    elements.lastTranslationLangs.textContent = `${srcLabel} → ${tgtLabel}`;
    elements.lastTranslationTime.textContent = formatTimeAgo(lastTrans.timestamp);
  } else {
    elements.lastTranslation.classList.add('hidden');
  }
};

const refreshOnlineStatus = (options) => {
  const isOnline = options.isOnline !== false;
  if (!isOnline && options.previewEnabled) {
    elements.onlineStatus.classList.remove('hidden');
  } else {
    elements.onlineStatus.classList.add('hidden');
  }
};

const refreshSummary = async () => {
  chrome.storage.sync.get(DEFAULT_OPTIONS, (options) => {
    const primary =
      Array.isArray(options.targetLanguages) && options.targetLanguages.length
        ? options.targetLanguages[0]
        : DEFAULT_OPTIONS.targetLanguages[0];
    elements.primaryLang.textContent = getLanguageLabel(primary || 'en');
    elements.providerLabel.textContent = PROVIDERS[options.provider] || PROVIDERS.google;
    elements.openModeLabel.textContent = getOpenModeLabel(options.openMode);
    elements.previewToggle.checked = options.previewEnabled ?? DEFAULT_OPTIONS.previewEnabled;

    const themeMode = options.themeMode || 'auto';
    if (themeMode === 'dark') {
      document.documentElement.dataset.theme = 'dark';
    } else if (themeMode === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      delete document.documentElement.dataset.theme;
    }

    refreshLastTranslation(options);
    refreshOnlineStatus(options);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  applyI18n();
  refreshSummary();

  elements.previewToggle.addEventListener('change', () => {
    chrome.storage.sync.set({ previewEnabled: elements.previewToggle.checked }, () => {
      if (chrome.runtime.lastError) {
        setStatus(getMessage('popupStatusError', null, 'Unable to save.'), 'error');
        return;
      }
      setStatus(getMessage('popupStatusSaved', null, 'Saved.'), 'success');
    });
  });

  elements.openOptions.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  elements.swapLanguages.addEventListener('click', () => {
    chrome.storage.sync.get(DEFAULT_OPTIONS, (options) => {
      const sourceLang = options.sourceLang || 'auto';
      const targetLanguages = options.targetLanguages || ['en'];
      const primaryTarget = targetLanguages[0];

      if (sourceLang === 'auto') {
        setStatus('Cannot swap from auto-detect', 'error');
        return;
      }

      // Swap logic: old source → new first target, old first target → new source
      // Keep other targets unchanged
      const newTargets = [sourceLang, ...targetLanguages.slice(1)];
      chrome.storage.sync.set(
        {
          sourceLang: primaryTarget,
          targetLanguages: newTargets
        },
        () => {
          if (chrome.runtime.lastError) {
            setStatus('Unable to swap', 'error');
            return;
          }
          setStatus('Languages swapped', 'success');
          refreshSummary();
        }
      );
    });
  });

  elements.copyLastTranslation.addEventListener('click', () => {
    chrome.storage.sync.get({ lastTranslation: null }, (options) => {
      const lastTrans = options.lastTranslation;
      if (lastTrans && lastTrans.text) {
        navigator.clipboard.writeText(lastTrans.text).then(
          () => setStatus('Copied to clipboard', 'success'),
          () => setStatus('Failed to copy', 'error')
        );
      }
    });
  });
});
