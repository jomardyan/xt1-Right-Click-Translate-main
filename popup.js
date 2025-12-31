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
  previewEnabled: true
};

const elements = {
  primaryLang: document.getElementById('primaryLang'),
  providerLabel: document.getElementById('providerLabel'),
  openModeLabel: document.getElementById('openModeLabel'),
  previewToggle: document.getElementById('previewToggle'),
  openOptions: document.getElementById('openOptions'),
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
  return getMessage('popupOpenModeNewTab', null, 'New tab');
};

const setStatus = (message, tone) => {
  elements.status.textContent = message;
  elements.status.classList.remove('success', 'error');
  if (tone) elements.status.classList.add(tone);
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
});
