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

const PROVIDERS = {
  google: 'Google',
  deepl: 'DeepL',
  bing: 'Bing',
  yandex: 'Yandex',
  microsoft: 'Microsoft'
};

const MENU_LANG_MIN = 1;
const MENU_LANG_MAX = 12;
const PREVIEW_TEXT_MIN = 60;
const PREVIEW_TEXT_MAX = 500;
const PREVIEW_API_URL = 'https://api.mymemory.translated.net/get';
const NOTES_STORAGE_KEY = 'savedNotes';
const NOTES_MAX_ITEMS = 200;
const NOTES_TEXT_LIMIT = 2000;

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
  notesAutoTranslate: true,
  translationHistory: []
};

/**
 * DOM element cache
 */
const elements = {};

const STATUS_CLASSES = ['status-success', 'status-error', 'status-info'];
let isDirty = false;

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

const getProviderLabel = (provider) => PROVIDERS[provider] || PROVIDERS.google;

const getLanguageLabel = (code) => {
  if (!code) return '';
  const lang = LANGUAGES.find((item) => item.code === code);
  return lang ? `${lang.name} (${lang.code})` : code;
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

function getRadioValue(name, fallback) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : fallback;
}

function setRadioValue(name, value) {
  const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (radio) radio.checked = true;
}

function updateRange(input, output, normalizer) {
  const normalized = normalizer(input.value);
  input.value = String(normalized);
  if (output) output.textContent = String(normalized);
}

function applyStatusTone(tone) {
  elements.status.classList.remove(...STATUS_CLASSES);
  elements.status.classList.add('status', `status-${tone}`);
}

function markDirty() {
  if (isDirty) return;
  isDirty = true;
  elements.unsavedHint.classList.add('is-visible');
}

function clearDirty() {
  isDirty = false;
  elements.unsavedHint.classList.remove('is-visible');
}

function updatePreviewControls() {
  const enabled = elements.previewEnabled.checked;
  elements.previewTextLimit.disabled = !enabled;
  elements.previewField.classList.toggle('is-disabled', !enabled);
}

function updateHistoryControls() {
  const enabled = elements.saveHistory.checked;
  elements.clearHistory.disabled = !enabled;
  elements.historySection.classList.toggle('is-disabled', !enabled);
}

/**
 * Get current form values as options object
 */
function getFormValues() {
  return {
    sourceLang: elements.sourceLang.value,
    targetLanguages: elements.targetLanguages.slice(),
    provider: elements.provider.value,
    openMode: getRadioValue('openMode', DEFAULT_OPTIONS.openMode),
    previewEnabled: elements.previewEnabled.checked,
    saveHistory: elements.saveHistory.checked,
    themeMode: getRadioValue('themeMode', DEFAULT_OPTIONS.themeMode),
    maxMenuLanguages: normalizeMenuLimit(elements.maxMenuLanguages.value),
    previewTextLimit: normalizePreviewLimit(elements.previewTextLimit.value),
    notesAutoTranslate: elements.notesAutoTranslate.checked
  };
}

/**
 * Show temporary status message
 */
function setStatus(message, tone = 'info') {
  elements.status.textContent = message;
  elements.status.setAttribute('aria-live', 'polite');
  elements.status.setAttribute('role', 'status');
  applyStatusTone(tone);
  if (elements.statusTimeout) clearTimeout(elements.statusTimeout);
  elements.statusTimeout = setTimeout(() => {
    elements.status.textContent = '';
    elements.status.classList.remove(...STATUS_CLASSES, 'status');
  }, 2200);
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

function getLanguageParts(code) {
  const lang = LANGUAGES.find((item) => item.code === code);
  if (!lang) {
    return { name: code, codeLabel: '' };
  }
  return { name: lang.name, codeLabel: code };
}

function createLanguageStack(code, className) {
  const { name, codeLabel } = getLanguageParts(code);
  const wrapper = document.createElement('span');
  wrapper.className = className || 'language-stack';

  const nameEl = document.createElement('span');
  nameEl.className = 'language-name';
  nameEl.textContent = name;
  wrapper.appendChild(nameEl);

  if (codeLabel) {
    const codeEl = document.createElement('span');
    codeEl.className = 'language-code';
    codeEl.textContent = codeLabel;
    wrapper.appendChild(codeEl);
  }

  return wrapper;
}

function moveTargetLanguage(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= elements.targetLanguages.length) return;
  const updated = elements.targetLanguages.slice();
  const [moved] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, moved);
  elements.targetLanguages = updated;
  renderTargets();
  markDirty();
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
    renderNoteTargets();
    return;
  }

  elements.targetLanguages.forEach((code, index) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.setAttribute('data-lang-code', code);

    const info = document.createElement('span');
    info.className = 'chip-info';

    const label = createLanguageStack(code, 'chip-label');
    info.appendChild(label);

    if (index === 0) {
      const badge = document.createElement('span');
      badge.className = 'chip-badge';
      badge.textContent = getMessage('badgePrimary', null, 'Primary');
      info.appendChild(badge);
      chip.classList.add('chip-primary');
    }

    const actions = document.createElement('span');
    actions.className = 'chip-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'chip-action chip-move';
    upBtn.textContent = 'up';
    upBtn.disabled = index === 0;
    upBtn.setAttribute(
      'aria-label',
      getMessage('ariaMoveLanguageUp', [code], `Move ${code} up`)
    );
    upBtn.addEventListener('click', () => moveTargetLanguage(index, index - 1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'chip-action chip-move';
    downBtn.textContent = 'dn';
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
      markDirty();
    });

    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    actions.appendChild(removeBtn);

    chip.appendChild(info);
    chip.appendChild(actions);
    container.appendChild(chip);
  });

  renderNoteTargets();
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
    setStatus(getMessage('statusAlreadyAdded', null, 'Already added'), 'info');
    return;
  }
  elements.targetLanguages.push(code);
  renderTargets();
  setStatus(getMessage('statusAdded', null, 'Added'), 'success');
  markDirty();
}

/**
 * Add custom language code
 */
function addCustomLanguage() {
  const raw = elements.customLangCode.value;
  const code = normalizeLanguageCode(raw);

  if (!code) {
    setStatus(getMessage('statusEnterLanguageCode', null, 'Please enter a language code'), 'error');
    return;
  }

  if (!isValidLanguageCode(code)) {
    setStatus(
      getMessage('statusInvalidLanguageCode', null, 'Invalid format. Use: en, pt-BR, es-419, zh-Hans'),
      'error'
    );
    return;
  }

  if (elements.targetLanguages.includes(code)) {
    setStatus(getMessage('statusAlreadyAdded', null, 'Already added'), 'info');
    return;
  }

  elements.targetLanguages.push(code);
  elements.customLangCode.value = '';
  elements.customLangCode.focus();
  renderTargets();
  setStatus(getMessage('statusCustomLanguageAdded', null, 'Custom language added'), 'success');
  markDirty();
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

  const maxCount = Math.max(...rows.map(([, count]) => count));

  rows.forEach(([code, count]) => {
    const row = document.createElement('div');
    row.className = 'history-row';

    const header = document.createElement('div');
    header.className = 'history-row-header';

    const label = createLanguageStack(code, 'history-label');

    const value = document.createElement('span');
    value.className = 'history-count';
    value.textContent = String(count);

    header.appendChild(label);
    header.appendChild(value);

    const bar = document.createElement('div');
    bar.className = 'history-bar';

    const fill = document.createElement('span');
    fill.className = 'history-bar-fill';
    fill.style.width = `${Math.max(6, Math.round((count / maxCount) * 100))}%`;
    bar.appendChild(fill);

    row.appendChild(header);
    row.appendChild(bar);
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
    const confirmMessage = getMessage(
      'confirmClearHistory',
      null,
      'Clear translation history? This cannot be undone.'
    );
    if (!confirm(confirmMessage)) return;

    await new Promise((resolve) => {
      chrome.storage.sync.set({ translationHistory: [] }, resolve);
    });
    elements.cachedHistory = [];
    renderHistorySummary(elements.cachedHistory, elements.saveHistory.checked);
    setStatus(getMessage('statusHistoryCleared', null, 'History cleared'), 'success');
  } catch (error) {
    console.error('Failed to clear history:', error);
    setStatus(getMessage('statusHistoryClearError', null, 'Error clearing history'), 'error');
  }
}
function isValidPageUrl(pageUrl) {
  return typeof pageUrl === 'string' && /^https?:\/\//i.test(pageUrl);
}

function createNoteId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function trimNoteText(text) {
  return typeof text === 'string' ? text.trim().slice(0, NOTES_TEXT_LIMIT) : '';
}

function sanitizeNote(note) {
  if (!note || typeof note !== 'object') return null;
  const sourceText = trimNoteText(note.sourceText);
  if (!sourceText) return null;

  const translatedText = trimNoteText(note.translatedText || '');
  const sourceLang = typeof note.sourceLang === 'string' ? note.sourceLang : DEFAULT_OPTIONS.sourceLang;
  const targetLang =
    typeof note.targetLang === 'string' ? note.targetLang : DEFAULT_OPTIONS.targetLanguages[0];
  const provider = typeof note.provider === 'string' ? note.provider : DEFAULT_OPTIONS.provider;
  const tag = trimNoteText(note.tag || '');
  const url = isValidPageUrl(note.url) ? note.url : '';
  const createdAt = typeof note.createdAt === 'number' ? note.createdAt : Date.now();
  const origin = typeof note.origin === 'string' ? note.origin : 'manual';

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
}

function getNotes() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [NOTES_STORAGE_KEY]: [] }, resolve);
  });
}

function setNotes(notes) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [NOTES_STORAGE_KEY]: notes }, resolve);
  });
}

async function saveNote(note) {
  const { [NOTES_STORAGE_KEY]: savedNotes = [] } = await getNotes();
  const safeNote = sanitizeNote(note);
  if (!safeNote) return null;
  const next = [safeNote, ...savedNotes].slice(0, NOTES_MAX_ITEMS);
  await setNotes(next);
  return next;
}

function formatNoteDate(timestamp) {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    return '';
  }
}

function filterNotes(notes, query) {
  const term = query.trim().toLowerCase();
  if (!term) return notes;
  return notes.filter((note) => {
    const haystack = [
      note.sourceText,
      note.translatedText,
      note.tag,
      note.sourceLang,
      note.targetLang,
      note.provider,
      note.url
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

function createNoteBlock(labelText, valueText, isMissing = false) {
  const block = document.createElement('div');
  block.className = 'note-block';

  const label = document.createElement('span');
  label.className = 'note-label';
  label.textContent = labelText;
  block.appendChild(label);

  const text = document.createElement('p');
  text.className = 'note-text';
  if (isMissing) text.classList.add('missing');
  text.textContent = valueText;
  block.appendChild(text);

  return block;
}

function renderNotes(notes) {
  const container = elements.notesList;
  container.innerHTML = '';
  const query = elements.notesSearch.value || '';
  const filtered = filterNotes(notes, query);

  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-message notes-empty';
    const messageKey = query.trim() ? 'notesEmptyFiltered' : 'notesEmpty';
    empty.textContent = getMessage(messageKey, null, 'No notes yet.');
    container.appendChild(empty);
    return;
  }

  filtered.forEach((note) => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.dataset.noteId = note.id;

    const meta = document.createElement('div');
    meta.className = 'note-meta';

    const langPair = document.createElement('span');
    const sourceLabel = getLanguageLabel(note.sourceLang || DEFAULT_OPTIONS.sourceLang);
    const targetLabel = getLanguageLabel(
      note.targetLang || DEFAULT_OPTIONS.targetLanguages[0] || 'en'
    );
    langPair.textContent = `${sourceLabel} -> ${targetLabel}`;
    meta.appendChild(langPair);

    const provider = document.createElement('span');
    provider.textContent = getProviderLabel(note.provider);
    meta.appendChild(provider);

    if (note.createdAt) {
      const date = document.createElement('span');
      date.textContent = formatNoteDate(note.createdAt);
      meta.appendChild(date);
    }

    if (note.tag) {
      const tag = document.createElement('span');
      tag.className = 'note-tag';
      tag.textContent = note.tag;
      meta.appendChild(tag);
    }

    card.appendChild(meta);

    const body = document.createElement('div');
    body.className = 'note-body';
    body.appendChild(
      createNoteBlock(
        getMessage('noteOriginalLabel', null, 'Original'),
        note.sourceText || ''
      )
    );

    const missingTranslation = !note.translatedText;
    const translationText =
      note.translatedText || getMessage('noteTranslationMissing', null, 'Translation not saved.');
    body.appendChild(
      createNoteBlock(
        getMessage('noteTranslationLabel', null, 'Translation'),
        translationText,
        missingTranslation
      )
    );

    card.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'note-actions-row';

    const copySource = document.createElement('button');
    copySource.type = 'button';
    copySource.className = 'ghost-button small';
    copySource.textContent = getMessage('buttonCopySource', null, 'Copy original');
    copySource.addEventListener('click', () => copyNoteText(note.sourceText));
    actions.appendChild(copySource);

    const copyTranslation = document.createElement('button');
    copyTranslation.type = 'button';
    copyTranslation.className = 'ghost-button small';
    copyTranslation.textContent = getMessage('buttonCopyTranslation', null, 'Copy translation');
    copyTranslation.disabled = !note.translatedText;
    copyTranslation.addEventListener('click', () => copyNoteText(note.translatedText));
    actions.appendChild(copyTranslation);

    if (note.url) {
      const link = document.createElement('a');
      link.href = note.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'ghost-button small note-link';
      link.textContent = getMessage('buttonOpenNoteSource', null, 'Open source');
      actions.appendChild(link);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'ghost-button small note-delete';
    deleteBtn.textContent = getMessage('buttonDeleteNote', null, 'Delete');
    deleteBtn.addEventListener('click', () => deleteNote(note.id));
    actions.appendChild(deleteBtn);

    card.appendChild(actions);
    container.appendChild(card);
  });
}

async function refreshNotes() {
  try {
    const stored = await getNotes();
    const list = Array.isArray(stored[NOTES_STORAGE_KEY]) ? stored[NOTES_STORAGE_KEY] : [];
    elements.cachedNotes = list.map(sanitizeNote).filter(Boolean);
    renderNotes(elements.cachedNotes);
  } catch (error) {
    console.error('Failed to refresh notes:', error);
  }
}

async function clearNotes() {
  try {
    const confirmMessage = getMessage(
      'confirmClearNotes',
      null,
      'Clear all notes? This cannot be undone.'
    );
    if (!confirm(confirmMessage)) return;

    await setNotes([]);
    elements.cachedNotes = [];
    renderNotes(elements.cachedNotes);
    setStatus(getMessage('statusNotesCleared', null, 'Notes cleared'), 'success');
  } catch (error) {
    console.error('Failed to clear notes:', error);
    setStatus(getMessage('statusNotesClearError', null, 'Error clearing notes'), 'error');
  }
}

async function deleteNote(noteId) {
  try {
    const confirmMessage = getMessage(
      'confirmDeleteNote',
      null,
      'Delete this note? This cannot be undone.'
    );
    if (!confirm(confirmMessage)) return;

    const stored = await getNotes();
    const list = Array.isArray(stored[NOTES_STORAGE_KEY]) ? stored[NOTES_STORAGE_KEY] : [];
    const next = list.filter((note) => note && note.id !== noteId);
    await setNotes(next);
    elements.cachedNotes = next.map(sanitizeNote).filter(Boolean);
    renderNotes(elements.cachedNotes);
    setStatus(getMessage('statusNoteDeleted', null, 'Note deleted'), 'success');
  } catch (error) {
    console.error('Failed to delete note:', error);
    setStatus(getMessage('statusNoteDeleteError', null, 'Error deleting note'), 'error');
  }
}

function renderNoteTargets() {
  const select = elements.noteTargetLang;
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '';
  const added = new Set();

  LANGUAGES.filter((lang) => lang.code !== 'auto').forEach((lang) => {
    const opt = document.createElement('option');
    opt.value = lang.code;
    opt.textContent = getLanguageLabel(lang.code);
    select.appendChild(opt);
    added.add(lang.code);
  });

  elements.targetLanguages.forEach((code) => {
    if (!code || code === 'auto' || added.has(code)) return;
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = getLanguageLabel(code);
    select.appendChild(opt);
    added.add(code);
  });

  const fallback = elements.targetLanguages[0] || DEFAULT_OPTIONS.targetLanguages[0] || 'en';
  select.value = currentValue && added.has(currentValue) ? currentValue : fallback;
}

function clearNoteForm() {
  elements.noteSource.value = '';
  elements.noteTranslation.value = '';
  elements.noteTag.value = '';
  renderNoteTargets();
  elements.noteSource.focus();
}

async function fetchNoteTranslation(sourceLang, targetLang, text) {
  try {
    const source = sourceLang === 'auto' ? 'auto' : sourceLang;
    const pair = `${source}|${targetLang}`;
    const url = `${PREVIEW_API_URL}?q=${encodeURIComponent(text)}&langpair=${pair}`;
    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();
    return data?.responseData?.translatedText || '';
  } catch (error) {
    console.warn('Failed to fetch note translation:', error);
    return '';
  }
}

async function saveManualNote() {
  const sourceText = trimNoteText(elements.noteSource.value);
  if (!sourceText) {
    setStatus(getMessage('statusNoteMissingSource', null, 'Add some text before saving'), 'error');
    elements.noteSource.focus();
    return;
  }

  const targetLang =
    elements.noteTargetLang.value || elements.targetLanguages[0] || DEFAULT_OPTIONS.targetLanguages[0];
  const sourceLang = elements.sourceLang.value || DEFAULT_OPTIONS.sourceLang;
  const provider = elements.provider.value || DEFAULT_OPTIONS.provider;
  const tag = trimNoteText(elements.noteTag.value);
  const previewLimit = normalizePreviewLimit(elements.previewTextLimit.value);

  let translatedText = trimNoteText(elements.noteTranslation.value);
  if (!translatedText && elements.notesAutoTranslate.checked && sourceText.length <= previewLimit) {
    translatedText = trimNoteText(
      (await fetchNoteTranslation(sourceLang, targetLang, sourceText)) || ''
    );
  }

  try {
    await saveNote({
      id: createNoteId(),
      sourceText,
      translatedText,
      sourceLang,
      targetLang,
      provider,
      tag,
      url: '',
      createdAt: Date.now(),
      origin: 'manual'
    });

    await refreshNotes();
    clearNoteForm();
    if (translatedText) {
      setStatus(getMessage('statusNoteSaved', null, 'Note saved'), 'success');
    } else {
      setStatus(
        getMessage('statusNoteSavedNoTranslation', null, 'Note saved without translation'),
        'info'
      );
    }
  } catch (error) {
    console.error('Failed to save note:', error);
    setStatus(getMessage('statusNoteSaveError', null, 'Error saving note'), 'error');
  }
}

async function copyToClipboard(text) {
  if (!text) return false;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'absolute';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  const success = document.execCommand('copy');
  document.body.removeChild(area);
  return success;
}

async function copyNoteText(text) {
  if (!text) {
    setStatus(getMessage('statusNoteNoTranslation', null, 'Nothing to copy'), 'info');
    return;
  }

  try {
    const success = await copyToClipboard(text);
    if (!success) throw new Error('Copy failed');
    setStatus(getMessage('statusNoteCopied', null, 'Copied'), 'success');
  } catch (error) {
    console.error('Failed to copy note:', error);
    setStatus(getMessage('statusNoteCopyError', null, 'Error copying'), 'error');
  }
}
function applyOptionsToForm(options) {
  elements.sourceLang.value = options.sourceLang || DEFAULT_OPTIONS.sourceLang;
  elements.provider.value = options.provider || DEFAULT_OPTIONS.provider;
  setRadioValue('openMode', options.openMode || DEFAULT_OPTIONS.openMode);
  elements.previewEnabled.checked = options.previewEnabled ?? DEFAULT_OPTIONS.previewEnabled;
  elements.saveHistory.checked = options.saveHistory ?? DEFAULT_OPTIONS.saveHistory;
  elements.notesAutoTranslate.checked = options.notesAutoTranslate ?? DEFAULT_OPTIONS.notesAutoTranslate;
  setRadioValue('themeMode', options.themeMode || DEFAULT_OPTIONS.themeMode);

  elements.maxMenuLanguages.value = normalizeMenuLimit(options.maxMenuLanguages);
  updateRange(elements.maxMenuLanguages, elements.maxMenuLanguagesValue, normalizeMenuLimit);

  elements.previewTextLimit.value = normalizePreviewLimit(options.previewTextLimit);
  updateRange(elements.previewTextLimit, elements.previewTextLimitValue, normalizePreviewLimit);

  elements.targetLanguages =
    Array.isArray(options.targetLanguages) && options.targetLanguages.length
      ? options.targetLanguages
      : options.targetLang
        ? [options.targetLang]
        : DEFAULT_OPTIONS.targetLanguages.slice();

  elements.cachedHistory = options.translationHistory || [];

  renderTargets();
  applyTheme(getRadioValue('themeMode', DEFAULT_OPTIONS.themeMode));
  renderHistorySummary(elements.cachedHistory, elements.saveHistory.checked);
  updatePreviewControls();
  updateHistoryControls();
}

async function resetDefaults() {
  try {
    const confirmMessage = getMessage(
      'confirmResetDefaults',
      null,
      'Reset settings to defaults? History stays the same.'
    );
    if (!confirm(confirmMessage)) return;

    const reset = {
      ...DEFAULT_OPTIONS,
      translationHistory: elements.cachedHistory
    };

    await new Promise((resolve) => {
      chrome.storage.sync.set(reset, resolve);
    });

    applyOptionsToForm(reset);
    clearDirty();
    setStatus(getMessage('statusDefaultsRestored', null, 'Defaults restored'), 'success');
  } catch (error) {
    console.error('Failed to reset defaults:', error);
    setStatus(getMessage('statusSaveError', null, 'Error saving settings'), 'error');
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

    applyOptionsToForm(options);
    clearDirty();
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
    setStatus(getMessage('statusMissingTarget', null, 'Add at least one target language'), 'error');
    return;
  }

  try {
    const options = getFormValues();
    await new Promise((resolve) => {
      chrome.storage.sync.set(options, resolve);
    });
    setStatus(getMessage('statusSaved', null, 'Settings saved successfully'), 'success');
    clearDirty();
  } catch (error) {
    console.error('Failed to save options:', error);
    setStatus(getMessage('statusSaveError', null, 'Error saving settings'), 'error');
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

/**
 * Export notes as JSON file
 */
async function exportNotes() {
  try {
    const { [NOTES_STORAGE_KEY]: notes = [] } = await getNotes();
    if (notes.length === 0) {
      setStatus('No notes to export', 'info');
      return;
    }

    const dataStr = JSON.stringify(notes, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `translate-notes-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus('Notes exported', 'success');
  } catch (error) {
    console.error('Failed to export notes:', error);
    setStatus('Export failed', 'error');
  }
}

/**
 * Import notes from JSON file
 */
async function importNotes() {
  const fileInput = document.getElementById('importFileInput');
  fileInput.click();
}

async function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (!Array.isArray(imported)) {
      setStatus('Invalid file format', 'error');
      return;
    }

    const { [NOTES_STORAGE_KEY]: existingNotes = [] } = await getNotes();
    const sanitized = imported.map(sanitizeNote).filter(Boolean);
    
    if (sanitized.length === 0) {
      setStatus('No valid notes found', 'error');
      return;
    }

    // Merge with existing, avoiding duplicates by ID
    const existingIds = new Set(existingNotes.map(n => n.id));
    const newNotes = sanitized.filter(n => !existingIds.has(n.id));
    const merged = [...newNotes, ...existingNotes].slice(0, NOTES_MAX_ITEMS);

    await setNotes(merged);
    await refreshNotes();
    setStatus(`Imported ${newNotes.length} notes`, 'success');
  } catch (error) {
    console.error('Failed to import notes:', error);
    setStatus('Import failed - invalid JSON', 'error');
  } finally {
    event.target.value = '';
  }
}

/**
 * Calculate and display statistics
 */
async function refreshStatistics() {
  try {
    const options = await new Promise((resolve) => {
      chrome.storage.sync.get({ translationHistory: [] }, resolve);
    });
    const { [NOTES_STORAGE_KEY]: notes = [] } = await getNotes();
    const history = options.translationHistory || [];

    // Total translations
    document.getElementById('totalTranslations').textContent = history.length;

    // Total notes
    document.getElementById('totalNotes').textContent = notes.length;

    // Top provider
    if (history.length > 0) {
      const providerCounts = history.reduce((acc, entry) => {
        acc[entry.provider] = (acc[entry.provider] || 0) + 1;
        return acc;
      }, {});
      const topProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];
      document.getElementById('topProvider').textContent = PROVIDERS[topProvider[0]] || topProvider[0];
    } else {
      document.getElementById('topProvider').textContent = '-';
    }

    // Top language
    if (history.length > 0) {
      const langCounts = history.reduce((acc, entry) => {
        acc[entry.targetLang] = (acc[entry.targetLang] || 0) + 1;
        return acc;
      }, {});
      const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0];
      const langObj = LANGUAGES.find(l => l.code === topLang[0]);
      document.getElementById('topLanguage').textContent = langObj ? langObj.name : topLang[0];
    } else {
      document.getElementById('topLanguage').textContent = '-';
    }
  } catch (error) {
    console.error('Failed to refresh statistics:', error);
  }
}

/**
 * Cache DOM elements
 */
function initElements() {
  elements.sourceLang = document.getElementById('sourceLang');
  elements.provider = document.getElementById('provider');
  elements.previewEnabled = document.getElementById('previewEnabled');
  elements.saveHistory = document.getElementById('saveHistory');
  elements.maxMenuLanguages = document.getElementById('maxMenuLanguages');
  elements.maxMenuLanguagesValue = document.getElementById('maxMenuLanguagesValue');
  elements.previewTextLimit = document.getElementById('previewTextLimit');
  elements.previewTextLimitValue = document.getElementById('previewTextLimitValue');
  elements.previewField = document.getElementById('previewField');
  elements.targetSelect = document.getElementById('targetSelect');
  elements.targetsList = document.getElementById('targetsList');
  elements.customLangCode = document.getElementById('customLangCode');
  elements.status = document.getElementById('status');
  elements.unsavedHint = document.getElementById('unsavedHint');
  elements.resetDefaults = document.getElementById('resetDefaults');
  elements.historySummary = document.getElementById('historySummary');
  elements.historySection = document.getElementById('historySection');
  elements.clearHistory = document.getElementById('clearHistory');
  elements.notesAutoTranslate = document.getElementById('notesAutoTranslate');
  elements.noteSource = document.getElementById('noteSource');
  elements.noteTranslation = document.getElementById('noteTranslation');
  elements.noteTargetLang = document.getElementById('noteTargetLang');
  elements.noteTag = document.getElementById('noteTag');
  elements.saveNote = document.getElementById('saveNote');
  elements.clearNoteForm = document.getElementById('clearNoteForm');
  elements.notesList = document.getElementById('notesList');
  elements.notesSearch = document.getElementById('notesSearch');
  elements.clearNotes = document.getElementById('clearNotes');
  elements.exportNotes = document.getElementById('exportNotes');
  elements.importNotes = document.getElementById('importNotes');
  elements.importFileInput = document.getElementById('importFileInput');
  elements.openModeInputs = document.querySelectorAll('input[name="openMode"]');
  elements.themeModeInputs = document.querySelectorAll('input[name="themeMode"]');
  elements.targetLanguages = [];
  elements.cachedHistory = [];
  elements.cachedNotes = [];
}

/**
 * Initialize options page
 */
document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  applyI18n();
  renderSelect(elements.sourceLang, true);
  renderSelect(elements.targetSelect, false);
  await restoreOptions();
  await refreshNotes();
  await refreshStatistics();

  document.getElementById('options-form').addEventListener('submit', saveOptions);
  document.getElementById('addTarget').addEventListener('click', addTargetLanguage);
  document.getElementById('addCustomLang').addEventListener('click', addCustomLanguage);
  elements.customLangCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomLanguage();
    }
  });
  elements.customLangCode.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addCustomLanguage();
    }
  });

  elements.sourceLang.addEventListener('change', markDirty);
  elements.provider.addEventListener('change', markDirty);

  elements.openModeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      markDirty();
    });
  });

  elements.themeModeInputs.forEach((input) => {
    input.addEventListener('change', () => {
      applyTheme(input.value);
      markDirty();
    });
  });

  elements.previewEnabled.addEventListener('change', () => {
    updatePreviewControls();
    markDirty();
  });

  elements.saveHistory.addEventListener('change', () => {
    updateHistoryControls();
    renderHistorySummary(elements.cachedHistory, elements.saveHistory.checked);
    markDirty();
  });

  elements.notesAutoTranslate.addEventListener('change', markDirty);

  elements.maxMenuLanguages.addEventListener('input', () => {
    updateRange(elements.maxMenuLanguages, elements.maxMenuLanguagesValue, normalizeMenuLimit);
    markDirty();
  });

  elements.previewTextLimit.addEventListener('input', () => {
    updateRange(elements.previewTextLimit, elements.previewTextLimitValue, normalizePreviewLimit);
    markDirty();
  });

  elements.maxMenuLanguages.addEventListener('change', () =>
    updateRange(elements.maxMenuLanguages, elements.maxMenuLanguagesValue, normalizeMenuLimit)
  );
  elements.previewTextLimit.addEventListener('change', () =>
    updateRange(elements.previewTextLimit, elements.previewTextLimitValue, normalizePreviewLimit)
  );

  elements.resetDefaults.addEventListener('click', resetDefaults);
  elements.clearHistory.addEventListener('click', clearHistory);
  elements.saveNote.addEventListener('click', saveManualNote);
  elements.clearNoteForm.addEventListener('click', clearNoteForm);
  
  // Debounce search input for better performance
  let searchTimeout;
  elements.notesSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderNotes(elements.cachedNotes), 300);
  });
  
  elements.clearNotes.addEventListener('click', clearNotes);
  elements.exportNotes.addEventListener('click', exportNotes);
  elements.importNotes.addEventListener('click', importNotes);
  elements.importFileInput.addEventListener('change', handleImportFile);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.translationHistory || changes.saveHistory)) {
      refreshHistorySummary();
      refreshStatistics();
    }
    if (area === 'local' && changes[NOTES_STORAGE_KEY]) {
      refreshNotes();
      refreshStatistics();
    }
  });
});
