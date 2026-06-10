'use strict';
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
      set: jest.fn((values, cb) => cb && cb())
    },
    local: {
      get: jest.fn((defaults, cb) => cb && cb(defaults)),
      set: jest.fn((values, cb) => cb && cb())
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
    openOptionsPage: jest.fn()
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
    getMessage: jest.fn((key, subs, fallback) => fallback || key)
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
  global.chrome.contextMenus.create.mockImplementation((props, cb) => cb && cb());
  global.chrome.contextMenus.removeAll.mockImplementation((cb) => cb && cb());
  global.chrome.tabs.create.mockResolvedValue({});
  global.chrome.tabs.update.mockResolvedValue({});
  global.chrome.tabs.query.mockResolvedValue([]);
  global.chrome.scripting.executeScript.mockResolvedValue([]);
  global.chrome.runtime.lastError = null;
});
