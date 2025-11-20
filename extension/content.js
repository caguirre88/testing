(() => {
  'use strict';

  const CONFIG = {
    delayBetweenInvitesMs: 1600,
    popupWaitTimeoutMs: 6500,
    autoScroll: true,
    scrollPauseMs: 900,
    maxScrollAttemptsWithoutNew: 12,
    maxToSend: 100
  };

  const log = (...a) => console.log('%c[LI Auto-Connect]', 'color:#0b69ff;font-weight:600', ...a);
  const warn = (...a) => console.warn('%c[LI Auto-Connect]', 'color:#ff7a00;font-weight:600', ...a);
  const err = (...a) => console.error('%c[LI Auto-Connect]', 'color:#ff2d55;font-weight:700', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nowISO = () => new Date().toISOString();
  const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const isVisible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  function nameFromAria(aria) {
    if (!aria) return '';
    const patterns = [
      /invite\s+(.+?)\s+to\s+connect/i,
      /connect with\s+(.+?)$/i,
      /connect\s+(.+?)$/i
    ];
    for (const re of patterns) {
      const m = re.exec(aria);
      if (m && m[1]) return normalize(m[1]);
    }
    return '';
  }

  function findProfileInfo(btn) {
    const aria = btn.getAttribute('aria-label') || '';
    let name = nameFromAria(aria);
    let profileUrl = '';

    const container =
      btn.closest(
        'li, .entity-result, .reusable-search__result-container, .artdeco-card, .search-result__wrapper, .scaffold-finite-scroll__content'
      ) || document;
    const anchors = Array.from(container.querySelectorAll('a[href*="/in/"]'));
    if (anchors.length) {
      const a = anchors[0];
      profileUrl = a.href;
      if (!name) name = normalize(a.textContent);
    }
    return { name, profileUrl, aria };
  }

  function getConnectButtons() {
    const all = Array.from(document.querySelectorAll('button'));
    return all.filter((btn) => {
      if (!isVisible(btn) || btn.disabled) return false;

      const t = normalize(btn.textContent).toLowerCase();
      if (!t.includes('connect')) return false;

      if (
        t.includes('pending') ||
        t.includes('requested') ||
        t.includes('invite sent') ||
        t.includes('following') ||
        t.includes('follow')
      ) {
        return false;
      }

      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (aria && !(aria.includes('connect') || aria.includes('invite'))) return false;

      return true;
    });
  }

  async function clickSendWithoutNote(timeoutMs = CONFIG.popupWaitTimeoutMs) {
    const deadline = Date.now() + timeoutMs;

    const tryFindAndClick = () => {
      const scopes = document.querySelectorAll('[role="dialog"], .artdeco-modal, .ember-view[role="dialog"]');
      const roots = scopes.length ? Array.from(scopes) : [document];

      for (const root of roots) {
        const btns = Array.from(root.querySelectorAll('button')).filter(isVisible);

        let target = btns.find((b) => /send without a note/i.test(normalize(b.textContent)));
        if (target) {
          target.click();
          return true;
        }

        const modalText = normalize(root.textContent).toLowerCase();
        if (modalText.includes('add a note') || modalText.includes('invite') || modalText.includes('connect')) {
          target = btns.find((b) => /^(send|send now)$/i.test(normalize(b.textContent)));
          if (target) {
            target.click();
            return true;
          }
        }

        target = btns.find((b) => /send/i.test(b.getAttribute('aria-label') || ''));
        if (target) {
          target.click();
          return true;
        }
      }
      return false;
    };

    if (tryFindAndClick()) return true;

    return await new Promise((resolve) => {
      let resolved = false;
      const observer = new MutationObserver(() => {
        if (resolved) return;
        if (tryFindAndClick()) {
          resolved = true;
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      const poll = setInterval(() => {
        if (resolved) return;
        if (Date.now() > deadline) {
          resolved = true;
          observer.disconnect();
          clearInterval(poll);
          resolve(false);
        } else if (tryFindAndClick()) {
          resolved = true;
          observer.disconnect();
          clearInterval(poll);
          resolve(true);
        }
      }, 200);
    });
  }

  async function autoScrollOnce() {
    const before = window.scrollY;
    window.scrollBy(0, Math.max(window.innerHeight * 0.9, 500));
    await sleep(CONFIG.scrollPauseMs);
    return window.scrollY !== before;
  }

  function csvEscape(value) {
    const s = (value ?? '').toString().replace(/"/g, '""');
    return `"${s}"`;
  }

  function downloadCSV(rows, filename) {
    const header = ['timestamp', 'name', 'profileUrl', 'ariaLabel', 'buttonId', 'pageUrl', 'result'];
    const lines = [header.map(csvEscape).join(',')];
    for (const r of rows) {
      const arr = [r.timestamp, r.name, r.profileUrl, r.ariaLabel, r.buttonId, r.pageUrl, r.result];
      lines.push(arr.map(csvEscape).join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function runAutoConnect() {
    if (window.__LI_AUTO_CONNECT_RUNNING__) {
      return { status: 'already_running', message: 'Auto-connect is already running on this page.' };
    }

    window.__LI_AUTO_CONNECT_RUNNING__ = true;
    window.__LI_AUTO_CONNECT_STOP__ = false;

    const pageUrl = location.href;
    const logEntries = [];
    window.__LI_AUTO_CONNECT_LOG__ = logEntries;

    log(`Starting… Limit = ${CONFIG.maxToSend}. To stop: window.__LI_AUTO_CONNECT_STOP__ = true`);

    try {
      const seen = new WeakSet();
      let sent = 0;
      let noNewButtonsScrolls = 0;

      while (!window.__LI_AUTO_CONNECT_STOP__) {
        let buttons = getConnectButtons().filter((b) => !seen.has(b));

        if (!buttons.length) {
          if (!CONFIG.autoScroll) break;

          const moved = await autoScrollOnce();
          await sleep(150);

          const afterButtons = getConnectButtons().filter((b) => !seen.has(b));
          if (!moved || afterButtons.length === 0) {
            noNewButtonsScrolls++;
            if (noNewButtonsScrolls >= CONFIG.maxScrollAttemptsWithoutNew) {
              log('No new connectable buttons after multiple scrolls. Stopping.');
              break;
            }
          } else {
            noNewButtonsScrolls = 0;
          }
          continue;
        }

        const btn = buttons[0];
        seen.add(btn);

        const btnId = btn.id || '';
        const { name, profileUrl, aria } = findProfileInfo(btn);

        btn.scrollIntoView({ behavior: 'auto', block: 'center' });
        await sleep(220);
        log(`Clicking: ${normalize(aria || btn.textContent)}${name ? ` (→ ${name})` : ''}`);
        btn.click();

        await sleep(250);
        let wasSent = await clickSendWithoutNote(CONFIG.popupWaitTimeoutMs);

        if (!wasSent) {
          await sleep(650);
          const stateText = normalize((btn && btn.textContent) || '');
          if (!btn || !btn.isConnected || /pending|invite sent|requested/i.test(stateText.toLowerCase())) {
            wasSent = true;
          }
        }

        logEntries.push({
          timestamp: nowISO(),
          name,
          profileUrl,
          ariaLabel: aria || '',
          buttonId: btnId,
          pageUrl,
          result: wasSent ? 'sent' : 'skipped_no_send_button'
        });

        if (wasSent) {
          sent++;
          log(`✅ Invitation logged${name ? ` to ${name}` : ''}. Total sent: ${sent}`);
        } else {
          warn('No send confirmation detected; logged as skipped.');
        }

        if (sent >= CONFIG.maxToSend) {
          log(`Reached maxToSend (${CONFIG.maxToSend}). Stopping.`);
          break;
        }

        if (window.__LI_AUTO_CONNECT_STOP__) break;
        await sleep(CONFIG.delayBetweenInvitesMs);
      }

      const successful = logEntries.filter((r) => r.result === 'sent');
      const dt = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const filename = `linkedin_autoconnect_log_${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}_${pad(
        dt.getHours()
      )}-${pad(dt.getMinutes())}-${pad(dt.getSeconds())}.csv`;
      downloadCSV(successful, filename);

      const summary = `Finished. Invitations sent: ${sent}. CSV downloaded as ${filename}. (Logged: ${logEntries.length})`;
      log(summary);

      return { status: 'completed', sent, filename, totalLogged: logEntries.length, summary };
    } catch (error) {
      err('Error while running auto-connect', error);
      return { status: 'error', message: error?.message || 'Unknown error' };
    } finally {
      window.__LI_AUTO_CONNECT_RUNNING__ = false;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'RUN_AUTO_CONNECT') {
      if (window.__LI_AUTO_CONNECT_RUNNING__) {
        sendResponse({ ok: true, result: { status: 'already_running' } });
        return false;
      }

      sendResponse({ ok: true, result: { status: 'started' } });

      runAutoConnect()
        .then((result) => {
          chrome.runtime.sendMessage({ type: 'AUTO_CONNECT_RESULT', result });
        })
        .catch((error) => {
          chrome.runtime.sendMessage({ type: 'AUTO_CONNECT_RESULT', error: error.message });
        });
      return false;
    }
    return false;
  });
})();
