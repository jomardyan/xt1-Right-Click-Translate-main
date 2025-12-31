/**
 * Language codes and display names
 */
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

const MENU_LANG_MIN = 1;
const MENU_LANG_MAX = 12;
const PREVIEW_TEXT_MIN = 60;
const PREVIEW_TEXT_MAX = 500;

/**
 * Default extension settings
 */
const DEFAULT_OPTIONS = {
  sourceLang: 'auto',
  targetLanguages: ['en', 'es', 'pl'],
  provider: 'google',
  openMode: 'newTab',
  previewEnabled: true,
  saveHistory: true,
  themeMode: 'auto',
  maxMenuLanguages: 6,
  previewTextLimit: 180,
  translationHistory: []
};

/**
 * DOM element cache
 */
const elements = {};

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

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const message = getMessage(key);
    if (message) el.setAttribute('placeholder', message);
  });

  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    const message = getMessage(key);
    if (message) el.setAttribute('aria-label', message);
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    const message = getMessage(key);
    if (message) el.setAttribute('title', message);
  });

  const title = getMessage('optionsTitle', null, document.title);
  if (title) document.title = title;
};

const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, min), max);
};

const normalizeMenuLimit = (value) =>
  clampNumber(value, MENU_LANG_MIN, MENU_LANG_MAX, DEFAULT_OPTIONS.maxMenuLanguages);

const normalizePreviewLimit = (value) =>
  clampNumber(value, PREVIEW_TEXT_MIN, PREVIEW_TEXT_MAX, DEFAULT_OPTIONS.previewTextLimit);

/**
 * Get current form values as options object
 */
function getFormValues() {
  return {
    sourceLang: elements.sourceLang.value,
    targetLanguages: elements.targetLanguages.slice(),
    provider: elements.provider.value,
    openMode: elements.openMode.value,
    previewEnabled: elements.previewEnabled.checked,
    saveHistory: elements.saveHistory.checked,
    themeMode: elements.themeMode.value,
    maxMenuLanguages: normalizeMenuLimit(elements.maxMenuLanguages.value),
    previewTextLimit: normalizePreviewLimit(elements.previewTextLimit.value)
  };
}

/**
 * Show temporary status message
 */
function setStatus(message) {
  elements.status.textContent = message;
  elements.status.setAttribute('aria-live', 'polite');
  if (elements.statusTimeout) clearTimeout(elements.statusTimeout);
  elements.statusTimeout = setTimeout(() => {
    elements.status.textContent = '';
  }, 2000);
}

/**
 * Render language options in a select element
 */
function renderSelect(selectEl, includeAuto = false) {
  selectEl.innerHTML = '';
  LANGUAGES
    .filter((lang) => includeAuto || lang.code !== 'auto')
    .forEach((lang) => {
      const opt = document.createElement('option');
      opt.value = lang.code;
      opt.textContent = `${lang.name} (${lang.code})`;
      selectEl.appendChild(opt);
    });
}

function formatLanguageLabel(code) {
  const lang = LANGUAGES.find((item) => item.code === code);
  return lang ? `${lang.name} (${code})` : code;
}

function moveTargetLanguage(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= elements.targetLanguages.length) return;
  const updated = elements.targetLanguages.slice();
  const [moved] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, moved);
  elements.targetLanguages = updated;
  renderTargets();
}

/**
 * Render target language chips
 */
function renderTargets() {
  const container = elements.targetsList;
  container.innerHTML = '';

  if (elements.targetLanguages.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = 'empty-message';
    emptyMsg.textContent = getMessage('targetsEmpty', null, 'No target languages added yet');
    container.appendChild(emptyMsg);
    return;
  }

  elements.targetLanguages.forEach((code, index) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.setAttribute('data-lang-code', code);

    const label = document.createElement('span');
    label.textContent = formatLanguageLabel(code);

    const actions = document.createElement('span');
    actions.className = 'chip-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'chip-action chip-move';
    upBtn.textContent = '^';
    upBtn.disabled = index === 0;
    upBtn.setAttribute(
      'aria-label',
      getMessage('ariaMoveLanguageUp', [code], `Move ${code} up`)
    );
    upBtn.addEventListener('click', () => moveTargetLanguage(index, index - 1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'chip-action chip-move';
    downBtn.textContent = 'v';
    downBtn.disabled = index === elements.targetLanguages.length - 1;
    downBtn.setAttribute(
      'aria-label',
      getMessage('ariaMoveLanguageDown', [code], `Move ${code} down`)
    );
    downBtn.addEventListener('click', () => moveTargetLanguage(index, index + 1));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chip-action chip-remove';
    removeBtn.textContent = 'x';
    removeBtn.setAttribute(
      'aria-label',
      getMessage('ariaRemoveLanguage', [code], `Remove ${code}`)
    );
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      elements.targetLanguages = elements.targetLanguages.filter((c) => c !== code);
      renderTargets();
    });

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(removeBtn);

    chip.appendChild(label);
    chip.appendChild(actions);
    container.appendChild(chip);
  });
}

/**
 * Validate language code format
 */
function isValidLanguageCode(code) {
  return /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(code);
}

function normalizeLanguageCode(input) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const parts = trimmed.split('-').filter(Boolean);
  if (parts.length === 0) return '';

  const normalized = [parts[0].toLowerCase()];
  parts.slice(1).forEach((part) => {
    if (/^[0-9]{3}$/.test(part)) {
      normalized.push(part);
    } else if (part.length === 2) {
      normalized.push(part.toUpperCase());
    } else if (part.length === 4) {
      normalized.push(part[0].toUpperCase() + part.slice(1).toLowerCase());
    } else {
      normalized.push(part.toLowerCase());
    }
  });

  return normalized.join('-');
}

/**
 * Add language from predefined list
 */
function addTargetLanguage() {
  const code = elements.targetSelect.value;
  if (!code) return;
  if (elements.targetLanguages.includes(code)) {
    setStatus(getMessage('statusAlreadyAdded', null, 'Already added'));
    return;
  }
  elements.targetLanguages.push(code);
  renderTargets();
  setStatus(getMessage('statusAdded', null, 'Added'));
}

/**
 * Add custom language code
 */
function addCustomLanguage() {
  const raw = elements.customLangCode.value;
  const code = normalizeLanguageCode(raw);

  if (!code) {
    setStatus(getMessage('statusEnterLanguageCode', null, 'Please enter a language code'));
    return;
  }

  if (!isValidLanguageCode(code)) {
    setStatus(
      getMessage('statusInvalidLanguageCode', null, 'Invalid format. Use: en, pt-BR, es-419, zh-Hans')
    );
    return;
  }

  if (elements.targetLanguages.includes(code)) {
    setStatus(getMessage('statusAlreadyAdded', null, 'Already added'));
    return;
  }

  elements.targetLanguages.push(code);
  elements.customLangCode.value = '';
  elements.customLangCode.focus();
  renderTargets();
  setStatus(getMessage('statusCustomLanguageAdded', null, 'Custom language added'));
}

function renderHistorySummary(history, saveHistoryEnabled) {
  const container = elements.historySummary;
  container.innerHTML = '';

  if (!saveHistoryEnabled) {
    const message = document.createElement('p');
    message.className = 'empty-message';
    message.textContent = getMessage('historyDisabled', null, 'History is disabled.');
    container.appendChild(message);
    return;
  }

  if (!Array.isArray(history) || history.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = getMessage('historyEmpty', null, 'No history yet.');
    container.appendChild(empty);
    return;
  }

  const counts = history.reduce((acc, entry) => {
    if (!entry || !entry.targetLang) return acc;
    acc[entry.targetLang] = (acc[entry.targetLang] || 0) + 1;
    return acc;
  }, {});

  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = getMessage('historyEmpty', null, 'No history yet.');
    container.appendChild(empty);
    return;
  }

  rows.forEach(([code, count]) => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const label = document.createElement('span');
    label.textContent = formatLanguageLabel(code);

    const value = document.createElement('span');
    value.className = 'history-count';
    value.textContent = String(count);

    row.appendChild(label);
    row.appendChild(value);
    container.appendChild(row);
  });
}

async function refreshHistorySummary() {
  try {
    const options = await new Promise((resolve) => {
      chrome.storage.sync.get({ translationHistory: [], saveHistory: true }, resolve);
    });
    elements.cachedHistory = options.translationHistory || [];
    renderHistorySummary(elements.cachedHistory, options.saveHistory);
  } catch (error) {
    console.error('Failed to refresh history summary:', error);
  }
}

async function clearHistory() {
  try {
    await new Promise((resolve) => {
      chrome.storage.sync.set({ translationHistory: [] }, resolve);
    });
    elements.cachedHistory = [];
    renderHistorySummary(elements.cachedHistory, elements.saveHistory.checked);
    setStatus(getMessage('statusHistoryCleared', null, 'History cleared'));
  } catch (error) {
    console.error('Failed to clear history:', error);
    setStatus(getMessage('statusHistoryClearError', null, 'Error clearing history'));
  }
}

/**
 * Load options from Chrome storage
 */
async function restoreOptions() {
  try {
    const options = await new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULT_OPTIONS, resolve);
    });

    elements.sourceLang.value = options.sourceLang || DEFAULT_OPTIONS.sourceLang;
    elements.provider.value = options.provider || DEFAULT_OPTIONS.provider;
    elements.openMode.value = options.openMode || DEFAULT_OPTIONS.openMode;
    elements.previewEnabled.checked = options.previewEnabled ?? DEFAULT_OPTIONS.previewEnabled;
    elements.saveHistory.checked = options.saveHistory ?? DEFAULT_OPTIONS.saveHistory;
    elements.themeMode.value = options.themeMode || DEFAULT_OPTIONS.themeMode;
    elements.maxMenuLanguages.value = normalizeMenuLimit(options.maxMenuLanguages);
    elements.previewTextLimit.value = normalizePreviewLimit(options.previewTextLimit);

    elements.targetLanguages =
      Array.isArray(options.targetLanguages) && options.targetLanguages.length
        ? options.targetLanguages
        : options.targetLang
          ? [options.targetLang]
          : DEFAULT_OPTIONS.targetLanguages.slice();

    elements.cachedHistory = options.translationHistory || [];

    renderTargets();
    applyTheme(elements.themeMode.value);
    renderHistorySummary(elements.cachedHistory, elements.saveHistory.checked);
  } catch (error) {
    console.error('Failed to restore options:', error);
  }
}

/**
 * Save options to Chrome storage
 */
async function saveOptions(event) {
  event.preventDefault();

  if (elements.targetLanguages.length === 0) {
    setStatus(getMessage('statusMissingTarget', null, 'Add at least one target language'));
    return;
  }

  try {
    const options = getFormValues();
    await new Promise((resolve) => {
      chrome.storage.sync.set(options, resolve);
    });
    setStatus(getMessage('statusSaved', null, 'Settings saved successfully'));
  } catch (error) {
    console.error('Failed to save options:', error);
    setStatus(getMessage('statusSaveError', null, 'Error saving settings'));
  }
}

/**
 * Apply theme to document
 */
function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.dataset.theme = 'dark';
  } else if (mode === 'light') {
    root.dataset.theme = 'light';
  } else {
    delete root.dataset.theme;
  }
}

function normalizeNumberInput(input, normalizer) {
  const normalized = normalizer(input.value);
  input.value = String(normalized);
}

/**
 * Cache DOM elements
 */
function initElements() {
  elements.sourceLang = document.getElementById('sourceLang');
  elements.provider = document.getElementById('provider');
  elements.openMode = document.getElementById('openMode');
  elements.previewEnabled = document.getElementById('previewEnabled');
  elements.saveHistory = document.getElementById('saveHistory');
  elements.themeMode = document.getElementById('themeMode');
  elements.maxMenuLanguages = document.getElementById('maxMenuLanguages');
  elements.previewTextLimit = document.getElementById('previewTextLimit');
  elements.targetSelect = document.getElementById('targetSelect');
  elements.targetsList = document.getElementById('targetsList');
  elements.customLangCode = document.getElementById('customLangCode');
  elements.status = document.getElementById('status');
  elements.historySummary = document.getElementById('historySummary');
  elements.clearHistory = document.getElementById('clearHistory');
  elements.targetLanguages = [];
  elements.cachedHistory = [];
}

/**
 * Initialize options page
 */
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  applyI18n();
  renderSelect(elements.sourceLang, true);
  renderSelect(elements.targetSelect, false);
  restoreOptions();

  document.getElementById('options-form').addEventListener('submit', saveOptions);
  document.getElementById('addTarget').addEventListener('click', addTargetLanguage);
  document.getElementById('addCustomLang').addEventListener('click', addCustomLanguage);
  elements.customLangCode.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addCustomLanguage();
    }
  });
  elements.themeMode.addEventListener('change', (e) => applyTheme(e.target.value));
  elements.saveHistory.addEventListener('change', () => {
    renderHistorySummary(elements.cachedHistory, elements.saveHistory.checked);
  });
  elements.maxMenuLanguages.addEventListener('blur', () =>
    normalizeNumberInput(elements.maxMenuLanguages, normalizeMenuLimit)
  );
  elements.previewTextLimit.addEventListener('blur', () =>
    normalizeNumberInput(elements.previewTextLimit, normalizePreviewLimit)
  );
  elements.clearHistory.addEventListener('click', clearHistory);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.translationHistory || changes.saveHistory)) {
      refreshHistorySummary();
    }
  });
});
