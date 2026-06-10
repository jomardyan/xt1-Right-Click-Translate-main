'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

// We load background.js inside a vm context so its "chrome" references
// resolve to our mock and the module-level event listener registrations
// don't fail. We capture the functions we want to test.
let ctx;
let bg;

beforeAll(() => {
  // vm scripts cannot contain ES module syntax; drop the vendor import
  const src = fs
    .readFileSync(path.join(__dirname, '../background.js'), 'utf8')
    .replace(/^import\s.*$/gm, '');
  ctx = vm.createContext({
    chrome: global.chrome,
    fetch: jest.fn(),
    globalThis: global,
    console,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout,
    AbortSignal: global.AbortSignal || { timeout: () => ({}) },
    encodeURIComponent: global.encodeURIComponent
  });
  try {
    vm.runInContext(src, ctx);
  } catch (e) {
    // Ignore errors from the top-level listeners
  }
  bg = vm.runInContext(
    '({ buildUrl, buildPageUrl, sanitizeText, sanitizeNote, sanitizeHistory, clampNumber, normalizeMenuLimit, normalizePreviewLimit, isValidPageUrl, getLanguageLabel, getProviderLabel, detectTextLanguage, fetchPreview })',
    ctx
  );
});

describe('buildUrl', () => {
  test('google provider builds correct URL', () => {
    const url = bg.buildUrl('google', 'en', 'es', 'hello');
    expect(url).toContain('translate.google.com');
    expect(url).toContain('sl=en');
    expect(url).toContain('tl=es');
    expect(url).toContain('text=hello');
  });

  test('deepl provider builds correct URL', () => {
    const url = bg.buildUrl('deepl', 'en', 'de', 'hello');
    expect(url).toContain('deepl.com');
    expect(url).toContain('en/de/hello');
  });

  test('bing provider builds correct URL', () => {
    const url = bg.buildUrl('bing', 'auto', 'fr', 'bonjour');
    expect(url).toContain('bing.com/translator');
    expect(url).toContain('to=fr');
  });

  test('yandex provider builds correct URL', () => {
    const url = bg.buildUrl('yandex', 'ru', 'en', 'privet');
    expect(url).toContain('translate.yandex.com');
    expect(url).toContain('source_lang=ru');
    expect(url).toContain('target_lang=en');
  });

  test('microsoft provider builds correct URL (uses bing)', () => {
    const url = bg.buildUrl('microsoft', 'auto', 'ja', 'hello');
    expect(url).toContain('bing.com/translator');
    expect(url).toContain('to=ja');
  });

  test('unknown provider falls back to google', () => {
    const url = bg.buildUrl('unknown_provider', 'en', 'ko', 'test');
    expect(url).toContain('translate.google.com');
  });

  test('auto source lang is preserved', () => {
    const url = bg.buildUrl('google', 'auto', 'en', 'test');
    expect(url).toContain('sl=auto');
  });
});

describe('buildPageUrl', () => {
  test('google page url is correct', () => {
    const url = bg.buildPageUrl('google', 'en', 'es', 'https://example.com');
    expect(url).toContain('translate.google.com/translate');
    expect(url).toContain('sl=en');
    expect(url).toContain('tl=es');
  });

  test('bing page url is correct', () => {
    const url = bg.buildPageUrl('bing', 'auto', 'fr', 'https://example.com');
    expect(url).toContain('bing.com/translator');
    expect(url).toContain('to=fr');
  });
});

describe('sanitizeText', () => {
  test('removes control characters', () => {
    const result = bg.sanitizeText('hello\x00world\x1F');
    expect(result).toBe('helloworld');
  });

  test('returns empty string for non-string', () => {
    expect(bg.sanitizeText(null)).toBe('');
    expect(bg.sanitizeText(undefined)).toBe('');
    expect(bg.sanitizeText(42)).toBe('');
  });

  test('preserves normal text', () => {
    expect(bg.sanitizeText('Hello, World!')).toBe('Hello, World!');
  });

  test('limits length to 10000 chars', () => {
    const long = 'a'.repeat(15000);
    expect(bg.sanitizeText(long).length).toBe(10000);
  });
});

describe('sanitizeNote', () => {
  test('returns null for non-object', () => {
    expect(bg.sanitizeNote(null)).toBeNull();
    expect(bg.sanitizeNote('string')).toBeNull();
    expect(bg.sanitizeNote(42)).toBeNull();
  });

  test('returns null when sourceText is empty', () => {
    expect(bg.sanitizeNote({ sourceText: '', targetLang: 'en' })).toBeNull();
    expect(bg.sanitizeNote({ sourceText: '   ', targetLang: 'en' })).toBeNull();
  });

  test('returns valid note with all required fields', () => {
    const note = bg.sanitizeNote({
      id: 'test-id',
      sourceText: 'hello',
      translatedText: 'hola',
      sourceLang: 'en',
      targetLang: 'es',
      provider: 'google',
      tag: 'work',
      url: 'https://example.com',
      createdAt: 1700000000000,
      origin: 'selection'
    });
    expect(note).not.toBeNull();
    expect(note.sourceText).toBe('hello');
    expect(note.translatedText).toBe('hola');
    expect(note.sourceLang).toBe('en');
    expect(note.targetLang).toBe('es');
    expect(note.url).toBe('https://example.com');
  });

  test('generates id if missing', () => {
    const note = bg.sanitizeNote({ sourceText: 'test', targetLang: 'en' });
    expect(note.id).toBeTruthy();
  });

  test('rejects invalid url', () => {
    const note = bg.sanitizeNote({ sourceText: 'test', url: 'javascript:void(0)', targetLang: 'en' });
    expect(note.url).toBe('');
  });

  test('trims and limits sourceText', () => {
    const note = bg.sanitizeNote({ sourceText: '  hello  ', targetLang: 'en' });
    expect(note.sourceText).toBe('hello');
  });
});

describe('sanitizeHistory', () => {
  test('filters out invalid entries', () => {
    const result = bg.sanitizeHistory([null, undefined, 'string', 42]);
    expect(result).toHaveLength(0);
  });

  test('filters out entries with missing targetLang', () => {
    const result = bg.sanitizeHistory([{ sourceLang: 'en', provider: 'google', at: 1000 }]);
    expect(result).toHaveLength(0);
  });

  test('returns valid entries', () => {
    const entries = [
      { sourceLang: 'en', targetLang: 'es', provider: 'google', at: 1000 },
      { sourceLang: 'auto', targetLang: 'fr', provider: 'deepl', at: 2000 }
    ];
    const result = bg.sanitizeHistory(entries);
    expect(result).toHaveLength(2);
    expect(result[0].targetLang).toBe('es');
    expect(result[1].targetLang).toBe('fr');
  });

  test('handles empty array', () => {
    expect(bg.sanitizeHistory([])).toEqual([]);
  });
});

describe('clampNumber', () => {
  test('clamps below min', () => {
    expect(bg.clampNumber(0, 1, 10, 5)).toBe(1);
  });

  test('clamps above max', () => {
    expect(bg.clampNumber(15, 1, 10, 5)).toBe(10);
  });

  test('returns value within range', () => {
    expect(bg.clampNumber(5, 1, 10, 3)).toBe(5);
  });

  test('returns fallback for non-finite', () => {
    expect(bg.clampNumber('abc', 1, 10, 5)).toBe(5);
    expect(bg.clampNumber(NaN, 1, 10, 5)).toBe(5);
    expect(bg.clampNumber(Infinity, 1, 10, 5)).toBe(5);
  });
});

describe('normalizeMenuLimit', () => {
  test('returns 1 for 0 (min is 1)', () => {
    expect(bg.normalizeMenuLimit(0)).toBe(1);
  });

  test('returns 12 for 15 (max is 12)', () => {
    expect(bg.normalizeMenuLimit(15)).toBe(12);
  });

  test('returns 6 for default', () => {
    expect(bg.normalizeMenuLimit(6)).toBe(6);
  });

  test('returns default fallback for invalid', () => {
    expect(bg.normalizeMenuLimit('bad')).toBe(6);
  });
});

describe('normalizePreviewLimit', () => {
  test('clamps below 60 to 60', () => {
    expect(bg.normalizePreviewLimit(30)).toBe(60);
  });

  test('clamps above 500 to 500', () => {
    expect(bg.normalizePreviewLimit(600)).toBe(500);
  });

  test('returns 180 for default', () => {
    expect(bg.normalizePreviewLimit(180)).toBe(180);
  });
});

describe('isValidPageUrl', () => {
  test('accepts http URL', () => {
    expect(bg.isValidPageUrl('http://example.com')).toBe(true);
  });

  test('accepts https URL', () => {
    expect(bg.isValidPageUrl('https://example.com/page?q=1')).toBe(true);
  });

  test('rejects ftp URL', () => {
    expect(bg.isValidPageUrl('ftp://example.com')).toBe(false);
  });

  test('rejects chrome:// URL', () => {
    expect(bg.isValidPageUrl('chrome://settings')).toBe(false);
  });

  test('rejects empty string', () => {
    expect(bg.isValidPageUrl('')).toBe(false);
  });

  test('rejects non-string', () => {
    expect(bg.isValidPageUrl(null)).toBe(false);
    expect(bg.isValidPageUrl(undefined)).toBe(false);
  });
});

describe('getLanguageLabel', () => {
  test('returns name and code for known language', () => {
    expect(bg.getLanguageLabel('en')).toBe('English (en)');
    expect(bg.getLanguageLabel('es')).toBe('Spanish (es)');
  });

  test('returns code for unknown language', () => {
    expect(bg.getLanguageLabel('xx')).toBe('xx');
    expect(bg.getLanguageLabel('pt-BR')).toBe('pt-BR');
  });
});

describe('getProviderLabel', () => {
  test('returns label for known provider', () => {
    expect(bg.getProviderLabel('google')).toBe('Google');
    expect(bg.getProviderLabel('deepl')).toBe('DeepL');
    expect(bg.getProviderLabel('bing')).toBe('Bing');
  });

  test('returns google label for unknown provider', () => {
    expect(bg.getProviderLabel('unknown')).toBe('Google');
  });
});

describe('detectTextLanguage', () => {
  test('resolves the top detected language', async () => {
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: true, languages: [{ language: 'it', percentage: 95 }] })
    );
    await expect(bg.detectTextLanguage('ciao')).resolves.toBe('it');
  });

  test('maps bare zh to zh-CN', async () => {
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: true, languages: [{ language: 'zh', percentage: 95 }] })
    );
    await expect(bg.detectTextLanguage('你好')).resolves.toBe('zh-CN');
  });

  test('resolves null when detection is inconclusive', async () => {
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: false, languages: [{ language: 'und', percentage: 0 }] })
    );
    await expect(bg.detectTextLanguage('???')).resolves.toBeNull();
  });

  test('resolves null when no languages are returned', async () => {
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: false, languages: [] })
    );
    await expect(bg.detectTextLanguage('')).resolves.toBeNull();
  });
});

describe('fetchPreview', () => {
  const mockFetchResponse = (body, ok = true) => {
    ctx.fetch.mockResolvedValue({
      ok,
      json: () => Promise.resolve(body)
    });
  };

  beforeEach(() => {
    ctx.fetch.mockReset();
  });

  test('never sends auto as source language; uses detected language instead', async () => {
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: true, languages: [{ language: 'it', percentage: 95 }] })
    );
    mockFetchResponse({
      responseStatus: 200,
      responseData: { translatedText: 'hello' }
    });

    const result = await bg.fetchPreview('auto', 'en', 'ciao');
    expect(result).toBe('hello');
    const calledUrl = ctx.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('langpair=it|en');
    expect(calledUrl).not.toContain('auto');
  });

  test('skips the request when auto detection fails', async () => {
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: false, languages: [] })
    );

    const result = await bg.fetchPreview('auto', 'en', '???');
    expect(result).toBeNull();
    expect(ctx.fetch).not.toHaveBeenCalled();
  });

  test('returns the original text when source equals target', async () => {
    const result = await bg.fetchPreview('en', 'en', 'hello there');
    expect(result).toBe('hello there');
    expect(ctx.fetch).not.toHaveBeenCalled();
  });

  test('returns null instead of surfacing MyMemory error text', async () => {
    mockFetchResponse({
      responseStatus: '403',
      responseDetails: "'AUTO' IS AN INVALID SOURCE LANGUAGE",
      responseData: { translatedText: "'AUTO' IS AN INVALID SOURCE LANGUAGE ..." }
    });

    const result = await bg.fetchPreview('fr', 'en', 'bonjour');
    expect(result).toBeNull();
  });

  test('returns translation for an explicit source language', async () => {
    mockFetchResponse({
      responseStatus: 200,
      responseData: { translatedText: 'hello' }
    });

    const result = await bg.fetchPreview('fr', 'en', 'bonjour');
    expect(result).toBe('hello');
    expect(ctx.fetch.mock.calls[0][0]).toContain('langpair=fr|en');
  });

  test('returns null on non-ok HTTP response', async () => {
    mockFetchResponse({}, false);
    const result = await bg.fetchPreview('fr', 'en', 'bonjour');
    expect(result).toBeNull();
  });
});

describe('language detection chain', () => {
  const resetBuiltinDetectorCache = () => {
    vm.runInContext('builtinDetectorPromise = null', ctx);
  };

  afterEach(() => {
    delete ctx.LanguageDetector;
    delete ctx.eld;
    resetBuiltinDetectorCache();
  });

  test('prefers the built-in AI LanguageDetector when available', async () => {
    ctx.LanguageDetector = {
      availability: () => Promise.resolve('available'),
      create: () =>
        Promise.resolve({
          detect: () => Promise.resolve([{ detectedLanguage: 'pl', confidence: 0.92 }])
        })
    };
    resetBuiltinDetectorCache();

    await expect(bg.detectTextLanguage('czesc swiecie')).resolves.toBe('pl');
    expect(chrome.i18n.detectLanguage).not.toHaveBeenCalled();
  });

  test('skips the built-in AI detector when its model is not downloaded', async () => {
    ctx.LanguageDetector = {
      availability: () => Promise.resolve('downloadable'),
      create: jest.fn()
    };
    resetBuiltinDetectorCache();
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: true, languages: [{ language: 'fr', percentage: 90 }] })
    );

    await expect(bg.detectTextLanguage('bonjour')).resolves.toBe('fr');
    expect(ctx.LanguageDetector.create).not.toHaveBeenCalled();
  });

  test('ignores low-confidence built-in AI results', async () => {
    ctx.LanguageDetector = {
      availability: () => Promise.resolve('available'),
      create: () =>
        Promise.resolve({
          detect: () => Promise.resolve([{ detectedLanguage: 'pl', confidence: 0.1 }])
        })
    };
    resetBuiltinDetectorCache();
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: true, languages: [{ language: 'de', percentage: 80 }] })
    );

    await expect(bg.detectTextLanguage('hm')).resolves.toBe('de');
  });

  test('falls back to bundled ELD when other detectors fail', async () => {
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: false, languages: [] })
    );
    ctx.eld = { detect: () => ({ language: 'tr' }) };

    await expect(bg.detectTextLanguage('merhaba dunya')).resolves.toBe('tr');
  });

  test('normalizes zh from ELD to zh-CN', async () => {
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: false, languages: [] })
    );
    ctx.eld = { detect: () => ({ language: 'zh' }) };

    await expect(bg.detectTextLanguage('ni hao')).resolves.toBe('zh-CN');
  });

  test('resolves null when every backend fails', async () => {
    chrome.i18n.detectLanguage.mockImplementation((text, cb) =>
      cb({ isReliable: false, languages: [] })
    );
    ctx.eld = { detect: () => ({ language: '' }) };

    await expect(bg.detectTextLanguage('???')).resolves.toBeNull();
  });
});
