'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = (file) => JSON.parse(read(file));

const manifest = readJson('manifest.json');
const messages = readJson('_locales/en/messages.json');

describe('manifest', () => {
  test('declares manifest v3 with a module service worker', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background.service_worker).toBe('background.js');
    expect(manifest.background.type).toBe('module');
  });

  test('every referenced file exists in the repository', () => {
    const referenced = [
      manifest.background.service_worker,
      manifest.options_page,
      manifest.action.default_popup,
      ...Object.values(manifest.icons)
    ];
    referenced.forEach((file) => {
      expect(fs.existsSync(path.join(root, file))).toBe(true);
    });
  });

  test('does not inject a content script into every page', () => {
    // content.js is injected on demand via chrome.scripting, which keeps the
    // install warning limited to the single MyMemory host permission.
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.host_permissions).toEqual(['https://api.mymemory.translated.net/*']);
  });

  test('keeps the permissions needed for on-demand injection', () => {
    expect(manifest.permissions).toEqual(expect.arrayContaining(['scripting', 'activeTab']));
  });

  test('version matches package.json', () => {
    expect(manifest.version).toBe(readJson('package.json').version);
  });

  test('every __MSG_ placeholder resolves to a message', () => {
    const placeholders = read('manifest.json').match(/__MSG_([A-Za-z0-9_]+)__/g) || [];
    expect(placeholders.length).toBeGreaterThan(0);
    placeholders.forEach((placeholder) => {
      const key = placeholder.slice('__MSG_'.length, -2);
      expect(messages[key]).toBeDefined();
    });
  });
});

describe('packaging', () => {
  test('the Makefile ships every runtime file', () => {
    const makefile = read('Makefile');
    [
      'manifest.json',
      'background.js',
      'content.js',
      'options.js',
      'options.html',
      'options.css',
      'popup.js',
      'popup.html',
      'popup.css',
      'icons/',
      '_locales/',
      'vendor/'
    ].forEach((file) => {
      expect(makefile).toContain(file);
    });
  });
});

describe('localization', () => {
  const htmlFiles = ['options.html', 'popup.html'];

  test.each(htmlFiles)('%s only references existing message keys', (file) => {
    const html = read(file);
    const attributes = ['data-i18n', 'data-i18n-placeholder', 'data-i18n-aria', 'data-i18n-title'];
    const missing = [];

    attributes.forEach((attribute) => {
      const pattern = new RegExp(`${attribute}="([^"]+)"`, 'g');
      let match;
      while ((match = pattern.exec(html)) !== null) {
        if (!messages[match[1]]) missing.push(`${attribute}="${match[1]}"`);
      }
    });

    expect(missing).toEqual([]);
  });

  test.each(['background.js', 'options.js', 'popup.js', 'content.js'])(
    '%s only asks for existing message keys',
    (file) => {
      const source = read(file);
      const missing = [];
      const pattern = /getMessage\(\s*'([A-Za-z0-9_]+)'/g;
      let match;
      while ((match = pattern.exec(source)) !== null) {
        if (!messages[match[1]]) missing.push(match[1]);
      }
      // content.js uses a short t() helper instead of getMessage()
      const shortPattern = /\bt\(\s*'([A-Za-z0-9_]+)'/g;
      while ((match = shortPattern.exec(source)) !== null) {
        if (!messages[match[1]]) missing.push(match[1]);
      }
      expect(missing).toEqual([]);
    }
  );

  test('every message entry has a non-empty message string', () => {
    Object.entries(messages).forEach(([key, entry]) => {
      expect(typeof entry.message).toBe('string');
      expect(entry.message.length).toBeGreaterThan(0);
      expect(key).toMatch(/^[A-Za-z0-9_]+$/);
    });
  });
});
