'use strict';
const fs = require('fs');
const path = require('path');

// Resolve messages from the real locale file so tests fail when a key is
// missing, and so substitutions behave like chrome.i18n does.
const MESSAGES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../_locales/en/messages.json'), 'utf8')
);

const resolveMessage = (key, substitutions) => {
  const entry = MESSAGES[key];
  if (!entry) return '';
  const subs = substitutions == null
    ? []
    : Array.isArray(substitutions)
      ? substitutions
      : [substitutions];
  return String(entry.message).replace(/\$(\d)/g, (match, index) => {
    const value = subs[Number(index) - 1];
    return value === undefined ? match : String(value);
  });
};

global.__EXTENSION_MESSAGES__ = MESSAGES;
global.__resolveMessage__ = resolveMessage;

const makeEventTarget = () => {
  const listeners = [];
  return {
    addListener: (fn) => listeners.push(fn),
    _listeners: listeners,
    _fire: (...args) => listeners.forEach((fn) => fn(...args))
  };
};

global.chrome = {
  storage: {
    sync: {
      get: jest.fn((defaults, cb) => cb && cb(defaults)),
      set: jest.fn((values, cb) => cb && cb()),
      remove: jest.fn((keys, cb) => cb && cb())
    },
    local: {
      get: jest.fn((defaults, cb) => cb && cb(defaults)),
      set: jest.fn((values, cb) => cb && cb()),
      remove: jest.fn((keys, cb) => cb && cb())
    },
    onChanged: makeEventTarget()
  },
  contextMenus: {
    create: jest.fn((props, cb) => cb && cb()),
    removeAll: jest.fn((cb) => cb && cb()),
    onClicked: makeEventTarget()
  },
  runtime: {
    onInstalled: makeEventTarget(),
    onStartup: makeEventTarget(),
    onMessage: makeEventTarget(),
    lastError: null,
    openOptionsPage: jest.fn(),
    sendMessage: jest.fn((message, cb) => cb && cb({ ok: true }))
  },
  commands: {
    onCommand: makeEventTarget()
  },
  tabs: {
    create: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve()),
    query: jest.fn(() => Promise.resolve([])),
    sendMessage: jest.fn(() => Promise.resolve())
  },
  notifications: {
    create: jest.fn(),
    clear: jest.fn()
  },
  scripting: {
    executeScript: jest.fn(() => Promise.resolve([]))
  },
  i18n: {
    getMessage: jest.fn((key, subs) => resolveMessage(key, subs)),
    detectLanguage: jest.fn((text, cb) =>
      cb({ isReliable: true, languages: [{ language: 'en', percentage: 100 }] })
    )
  }
};

// Reset mocks between tests (but not event listeners)
beforeEach(() => {
  jest.clearAllMocks();
  // Re-setup basic mocks
  global.chrome.storage.sync.get.mockImplementation((defaults, cb) => cb && cb(defaults));
  global.chrome.storage.sync.set.mockImplementation((values, cb) => cb && cb());
  global.chrome.storage.local.get.mockImplementation((defaults, cb) => cb && cb(defaults));
  global.chrome.storage.local.set.mockImplementation((values, cb) => cb && cb());
  global.chrome.storage.sync.remove.mockImplementation((keys, cb) => cb && cb());
  global.chrome.storage.local.remove.mockImplementation((keys, cb) => cb && cb());
  global.chrome.contextMenus.create.mockImplementation((props, cb) => cb && cb());
  global.chrome.contextMenus.removeAll.mockImplementation((cb) => cb && cb());
  global.chrome.tabs.create.mockResolvedValue({});
  global.chrome.tabs.update.mockResolvedValue({});
  global.chrome.tabs.query.mockResolvedValue([]);
  global.chrome.scripting.executeScript.mockResolvedValue([]);
  global.chrome.runtime.lastError = null;
  global.chrome.i18n.getMessage.mockImplementation((key, subs) => resolveMessage(key, subs));
  global.chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
    cb({ isReliable: true, languages: [{ language: 'en', percentage: 100 }] })
  );
});
