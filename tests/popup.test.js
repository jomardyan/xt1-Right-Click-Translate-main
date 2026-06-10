'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

let ctx;

beforeAll(() => {
  const mockDocument = {
    querySelectorAll: jest.fn(() => []),
    querySelector: jest.fn(() => null),
    getElementById: jest.fn(() => null),
    title: 'Test',
    documentElement: { dataset: {} },
    addEventListener: jest.fn()
  };

  ctx = vm.createContext({
    chrome: global.chrome,
    document: mockDocument,
    navigator: { clipboard: { writeText: jest.fn(() => Promise.resolve()) } },
    globalThis: global,
    console,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout
  });

  const src = fs.readFileSync(path.join(__dirname, '../popup.js'), 'utf8');
  try {
    vm.runInContext(src, ctx);
  } catch (e) {
    // Expected: DOM errors at load time
  }
  Object.assign(
    ctx,
    vm.runInContext(
      '({ formatTimeAgo, getLanguageLabel, getOpenModeLabel, DEFAULT_OPTIONS })',
      ctx
    )
  );
});

describe('formatTimeAgo', () => {
  test('returns "just now" for timestamps within 60 seconds', () => {
    const now = Date.now();
    expect(ctx.formatTimeAgo(now - 30000)).toBe('just now');
    expect(ctx.formatTimeAgo(now - 0)).toBe('just now');
  });

  test('returns minutes ago', () => {
    const now = Date.now();
    expect(ctx.formatTimeAgo(now - 120000)).toBe('2m ago');
    expect(ctx.formatTimeAgo(now - 3540000)).toBe('59m ago');
  });

  test('returns hours ago', () => {
    const now = Date.now();
    expect(ctx.formatTimeAgo(now - 7200000)).toBe('2h ago');
  });

  test('returns days ago', () => {
    const now = Date.now();
    expect(ctx.formatTimeAgo(now - 172800000)).toBe('2d ago');
  });

  test('returns empty string for null/undefined', () => {
    expect(ctx.formatTimeAgo(null)).toBe('');
    expect(ctx.formatTimeAgo(undefined)).toBe('');
    expect(ctx.formatTimeAgo(0)).toBe('');
  });
});

describe('getLanguageLabel (popup.js)', () => {
  test('returns formatted label for known languages', () => {
    expect(ctx.getLanguageLabel('en')).toBe('English (en)');
    expect(ctx.getLanguageLabel('fr')).toBe('French (fr)');
    expect(ctx.getLanguageLabel('zh-CN')).toBe('Chinese (Simplified) (zh-CN)');
  });

  test('returns code for unknown language', () => {
    expect(ctx.getLanguageLabel('xx')).toBe('xx');
  });
});

describe('getOpenModeLabel', () => {
  test('returns label for newTab', () => {
    const label = ctx.getOpenModeLabel('newTab');
    expect(label).toBeTruthy();
  });

  test('returns label for currentTab', () => {
    const label = ctx.getOpenModeLabel('currentTab');
    expect(label).toBeTruthy();
  });

  test('returns label for inline', () => {
    const label = ctx.getOpenModeLabel('inline');
    expect(label).toBeTruthy();
  });

  test('returns new tab label for unknown mode', () => {
    const newTab = ctx.getOpenModeLabel('newTab');
    const unknown = ctx.getOpenModeLabel('unknown');
    expect(unknown).toBe(newTab);
  });
});

describe('DEFAULT_OPTIONS (popup.js)', () => {
  test('includes required fields', () => {
    expect(ctx.DEFAULT_OPTIONS).toBeDefined();
    expect(ctx.DEFAULT_OPTIONS.targetLanguages).toBeDefined();
    expect(ctx.DEFAULT_OPTIONS.provider).toBe('google');
    expect(ctx.DEFAULT_OPTIONS.openMode).toBe('newTab');
    expect(ctx.DEFAULT_OPTIONS.previewEnabled).toBe(true);
  });

  test('includes themeMode', () => {
    expect(ctx.DEFAULT_OPTIONS.themeMode).toBe('auto');
  });
});
