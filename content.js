/**
 * Content script — inline translation popup
 * Receives messages from the background service worker and displays
 * a floating popup near the selected text with the translated result.
 */
(function () {
  'use strict';

  /** @type {{ host: HTMLElement, shadow: ShadowRoot, popup: HTMLElement } | null} */
  let popupState = null;
  /** @type {{ x: number, y: number } | null} */
  let lastSelectionPos = null;

  const POPUP_STYLES = `
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    .popup {
      position: fixed;
      background: #ffffff;
      border: 1px solid #dde1e7;
      border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
      padding: 10px 14px 12px;
      max-width: 340px;
      min-width: 180px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1a1a1a;
      z-index: 2147483647;
      word-break: break-word;
    }
    @media (prefers-color-scheme: dark) {
      .popup {
        background: #1e1e2e;
        border-color: #3a3a4a;
        color: #e0e0f0;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
      }
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      gap: 6px;
    }
    .badge {
      font-size: 11px;
      color: #666;
      background: #f0f2f5;
      padding: 2px 7px;
      border-radius: 20px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }
    @media (prefers-color-scheme: dark) {
      .badge {
        background: #2a2a3c;
        color: #aaa;
      }
    }
    .close-btn {
      flex-shrink: 0;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      color: #999;
      padding: 2px 4px;
      border-radius: 4px;
      transition: color 0.1s;
    }
    .close-btn:hover {
      color: #333;
      background: #f0f2f5;
    }
    @media (prefers-color-scheme: dark) {
      .close-btn:hover {
        color: #eee;
        background: #2a2a3c;
      }
    }
    .original {
      font-size: 12px;
      color: #888;
      margin-bottom: 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @media (prefers-color-scheme: dark) {
      .original { color: #777; }
    }
    .translation {
      font-size: 15px;
      font-weight: 500;
    }
    .translation.loading {
      color: #888;
      font-style: italic;
      font-weight: normal;
    }
    .translation.error {
      color: #c0392b;
      font-weight: normal;
      font-size: 13px;
    }
    @media (prefers-color-scheme: dark) {
      .translation.error { color: #e07070; }
    }
  `;

  /**
   * Remove the existing popup from the page, if any.
   */
  const removePopup = () => {
    if (popupState) {
      popupState.host.remove();
      popupState = null;
    }
  };

  /**
   * Capture the current text-selection bounding rect so we can position
   * the popup even after the selection is cleared by the context-menu click.
   */
  const captureSelectionPosition = () => {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          lastSelectionPos = { x: rect.left, y: rect.bottom };
          return;
        }
      }
    } catch (_) {
      // ignore
    }
    lastSelectionPos = null;
  };

  /**
   * Compute a safe fixed-position for the popup, clamped inside the viewport.
   * @param {number} anchorX
   * @param {number} anchorY
   * @returns {{ left: string, top: string }}
   */
  const computePosition = (anchorX, anchorY) => {
    const MARGIN = 10;
    const POPUP_W = 340;
    const POPUP_H = 120; // estimated height
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = anchorX;
    let top = anchorY + 10;

    if (left + POPUP_W > vw - MARGIN) {
      left = vw - POPUP_W - MARGIN;
    }
    if (left < MARGIN) {
      left = MARGIN;
    }
    if (top + POPUP_H > vh - MARGIN) {
      top = anchorY - POPUP_H - 10;
    }
    if (top < MARGIN) {
      top = MARGIN;
    }

    return { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` };
  };

  /**
   * Build the popup DOM inside a shadow root attached to the given host.
   * @param {HTMLElement} host
   * @param {ShadowRoot} shadow
   * @param {string} posLeft
   * @param {string} posTop
   * @returns {HTMLElement} the popup div
   */
  const buildPopup = (host, shadow, posLeft, posTop) => {
    const style = document.createElement('style');
    style.textContent = POPUP_STYLES;

    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.style.left = posLeft;
    popup.style.top = posTop;

    shadow.appendChild(style);
    shadow.appendChild(popup);
    document.body.appendChild(host);

    return popup;
  };

  /**
   * Add the standard header row (badge + close button) to the popup.
   * @param {HTMLElement} popup
   * @param {string} badgeText
   */
  const addHeader = (popup, badgeText) => {
    const header = document.createElement('div');
    header.className = 'header';

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = badgeText;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close translation popup');
    closeBtn.addEventListener('click', removePopup);

    header.appendChild(badge);
    header.appendChild(closeBtn);
    popup.appendChild(header);
  };

  /**
   * Show a "translating…" loading state near the selection.
   * @param {string} originalText
   * @param {string} providerLabel
   */
  const showLoading = (originalText, providerLabel) => {
    captureSelectionPosition();

    const anchorX = lastSelectionPos ? lastSelectionPos.x : window.innerWidth / 2 - 160;
    const anchorY = lastSelectionPos ? lastSelectionPos.y : window.innerHeight / 2;
    const { left, top } = computePosition(anchorX, anchorY);

    removePopup();

    const host = document.createElement('div');
    host.id = 'xt1-translate-host';
    // Reset all inherited styles so the host doesn't affect layout
    host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });
    const popup = buildPopup(host, shadow, left, top);

    addHeader(popup, providerLabel);

    if (originalText) {
      const orig = document.createElement('div');
      orig.className = 'original';
      orig.textContent =
        originalText.length > 80 ? originalText.slice(0, 80) + '\u2026' : originalText;
      popup.appendChild(orig);
    }

    const loading = document.createElement('div');
    loading.className = 'translation loading';
    loading.textContent = 'Translating\u2026';
    popup.appendChild(loading);

    popupState = { host, shadow, popup };
  };

  /**
   * Update the popup to show the final translation result.
   * @param {string} originalText
   * @param {string} translatedText
   * @param {string} targetLang
   * @param {string} providerLabel
   */
  const showResult = (originalText, translatedText, targetLang, providerLabel) => {
    // If the popup was closed before the result came in, show a fresh one.
    if (!popupState) {
      const anchorX = lastSelectionPos ? lastSelectionPos.x : window.innerWidth / 2 - 160;
      const anchorY = lastSelectionPos ? lastSelectionPos.y : window.innerHeight / 2;
      const { left, top } = computePosition(anchorX, anchorY);

      const host = document.createElement('div');
      host.id = 'xt1-translate-host';
      host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';
      const shadow = host.attachShadow({ mode: 'open' });
      const popup = buildPopup(host, shadow, left, top);
      popupState = { host, shadow, popup };
    }

    const { popup } = popupState;
    popup.innerHTML = '';

    addHeader(popup, `${providerLabel} \u2192 ${targetLang}`);

    if (originalText) {
      const orig = document.createElement('div');
      orig.className = 'original';
      orig.textContent =
        originalText.length > 80 ? originalText.slice(0, 80) + '\u2026' : originalText;
      popup.appendChild(orig);
    }

    const trans = document.createElement('div');
    trans.className = 'translation';
    trans.textContent = translatedText;
    popup.appendChild(trans);
  };

  /**
   * Show an error state in the popup.
   * @param {string} [errorMessage]
   */
  const showError = (errorMessage) => {
    if (!popupState) return;
    const { popup } = popupState;
    const loading = popup.querySelector('.loading');
    if (loading) {
      loading.className = 'translation error';
      loading.textContent = errorMessage || 'Translation unavailable.';
    }
  };

  // Dismiss popup when clicking outside of it.
  document.addEventListener(
    'mousedown',
    (e) => {
      if (popupState && !popupState.host.contains(e.target)) {
        removePopup();
      }
    },
    true
  );

  // Dismiss popup on Escape key.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popupState) {
      removePopup();
    }
  });

  // Listen for messages from the background service worker.
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== 'inlineTranslation') return;

    if (message.phase === 'loading') {
      showLoading(message.originalText || '', message.providerLabel || '');
    } else if (message.phase === 'result') {
      showResult(
        message.originalText || '',
        message.translatedText || '',
        message.targetLang || '',
        message.providerLabel || ''
      );
    } else if (message.phase === 'error') {
      showError(message.error || '');
    }
  });
})();
