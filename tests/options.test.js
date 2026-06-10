'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

// We only test the pure utility functions from options.js,
// since the DOM-dependent functions need a full browser environment.
// We capture functions by loading the script in a minimal context.

let ctx;

beforeAll(() => {
  // Create a minimal DOM-like context
  const mockDocument = {
    querySelectorAll: jest.fn(() => []),
    querySelector: jest.fn(() => null),
    getElementById: jest.fn(() => null),
    title: 'Test',
    documentElement: { dataset: {} },
    addEventListener: jest.fn(),
    body: { appendChild: jest.fn(), removeChild: jest.fn() },
    createElement: jest.fn(() => ({
      setAttribute: jest.fn(),
      appendChild: jest.fn(),
      addEventListener: jest.fn(),
      classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() },
      style: {},
      textContent: '',
      value: '',
      innerHTML: ''
    }))
  };

  ctx = vm.createContext({
    chrome: global.chrome,
    fetch: jest.fn(),
    document: mockDocument,
    window: { location: { href: '' } },
    globalThis: global,
    console,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    confirm: jest.fn(() => true),
    URL: global.URL,
    Blob: global.Blob || function(){},
    navigator: { clipboard: { writeText: jest.fn(() => Promise.resolve()) } }
  });

  const src = fs.readFileSync(path.join(__dirname, '../options.js'), 'utf8');
  try {
    vm.runInContext(src, ctx);
  } catch (e) {
    // DOM setup errors are expected at load time; ignore
  }
  Object.assign(
    ctx,
    vm.runInContext(
      '({ isValidLanguageCode, normalizeLanguageCode, clampNumber, filterNotes, sanitizeNote })',
      ctx
    )
  );
});

describe('isValidLanguageCode', () => {
  test('accepts simple 2-letter codes', () => {
    expect(ctx.isValidLanguageCode('en')).toBe(true);
    expect(ctx.isValidLanguageCode('fr')).toBe(true);
    expect(ctx.isValidLanguageCode('zh')).toBe(true);
  });

  test('accepts 3-letter codes', () => {
    expect(ctx.isValidLanguageCode('zho')).toBe(true);
  });

  test('accepts codes with region subtag', () => {
    expect(ctx.isValidLanguageCode('pt-BR')).toBe(true);
    expect(ctx.isValidLanguageCode('zh-CN')).toBe(true);
    expect(ctx.isValidLanguageCode('zh-Hans')).toBe(true);
    expect(ctx.isValidLanguageCode('es-419')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(ctx.isValidLanguageCode('')).toBe(false);
  });

  test('rejects codes with uppercase first part', () => {
    expect(ctx.isValidLanguageCode('EN')).toBe(false);
  });

  test('rejects codes with invalid characters', () => {
    expect(ctx.isValidLanguageCode('en_US')).toBe(false);
    expect(ctx.isValidLanguageCode('en US')).toBe(false);
  });
});

describe('normalizeLanguageCode', () => {
  test('lowercases primary subtag', () => {
    expect(ctx.normalizeLanguageCode('EN')).toBe('en');
  });

  test('uppercases 2-char region subtag', () => {
    expect(ctx.normalizeLanguageCode('pt-br')).toBe('pt-BR');
  });

  test('title-cases 4-char script subtag', () => {
    expect(ctx.normalizeLanguageCode('zh-hans')).toBe('zh-Hans');
  });

  test('lowercases other subtags', () => {
    expect(ctx.normalizeLanguageCode('es-419')).toBe('es-419');
  });

  test('trims whitespace', () => {
    expect(ctx.normalizeLanguageCode('  en  ')).toBe('en');
  });

  test('returns empty string for empty input', () => {
    expect(ctx.normalizeLanguageCode('')).toBe('');
    expect(ctx.normalizeLanguageCode('   ')).toBe('');
  });
});

describe('clampNumber (options.js)', () => {
  test('clamps below min', () => {
    expect(ctx.clampNumber(0, 1, 12, 6)).toBe(1);
  });

  test('clamps above max', () => {
    expect(ctx.clampNumber(20, 1, 12, 6)).toBe(12);
  });

  test('returns value within range', () => {
    expect(ctx.clampNumber(8, 1, 12, 6)).toBe(8);
  });

  test('returns fallback for NaN', () => {
    expect(ctx.clampNumber('x', 1, 12, 6)).toBe(6);
  });
});

describe('filterNotes', () => {
  const sampleNotes = [
    {
      id: '1',
      sourceText: 'hello world',
      translatedText: 'hola mundo',
      tag: 'greetings',
      sourceLang: 'en',
      targetLang: 'es',
      provider: 'google',
      url: 'https://example.com'
    },
    {
      id: '2',
      sourceText: 'goodbye',
      translatedText: 'adios',
      tag: 'farewell',
      sourceLang: 'en',
      targetLang: 'es',
      provider: 'deepl',
      url: ''
    }
  ];

  test('returns all notes when query is empty', () => {
    expect(ctx.filterNotes(sampleNotes, '')).toHaveLength(2);
    expect(ctx.filterNotes(sampleNotes, '  ')).toHaveLength(2);
  });

  test('filters by sourceText', () => {
    const result = ctx.filterNotes(sampleNotes, 'hello');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('filters by translatedText', () => {
    const result = ctx.filterNotes(sampleNotes, 'adios');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  test('filters by tag', () => {
    const result = ctx.filterNotes(sampleNotes, 'greet');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('is case insensitive', () => {
    const result = ctx.filterNotes(sampleNotes, 'HELLO');
    expect(result).toHaveLength(1);
  });

  test('returns empty array when no match', () => {
    expect(ctx.filterNotes(sampleNotes, 'zzznomatch')).toHaveLength(0);
  });
});

describe('sanitizeNote (options.js)', () => {
  test('returns null for null input', () => {
    expect(ctx.sanitizeNote(null)).toBeNull();
  });

  test('returns null for empty sourceText', () => {
    expect(ctx.sanitizeNote({ sourceText: '', targetLang: 'en' })).toBeNull();
  });

  test('creates valid note from minimal input', () => {
    const note = ctx.sanitizeNote({ sourceText: 'test text', targetLang: 'es' });
    expect(note).not.toBeNull();
    expect(note.sourceText).toBe('test text');
    expect(note.targetLang).toBe('es');
    expect(note.id).toBeTruthy();
    expect(typeof note.createdAt).toBe('number');
  });

  test('trims sourceText', () => {
    const note = ctx.sanitizeNote({ sourceText: '  trimmed  ', targetLang: 'en' });
    expect(note.sourceText).toBe('trimmed');
  });

  test('sanitizes invalid url', () => {
    const note = ctx.sanitizeNote({ sourceText: 'test', url: 'javascript:alert(1)', targetLang: 'en' });
    expect(note.url).toBe('');
  });
});
