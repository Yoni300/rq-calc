// Web version (GitHub Pages, see .github/workflows/pages.yml; tools/release.mjs starts it). Stands in for the desktop app's update bridge
// (preload.js): checks build.json every 5 minutes and when the tab comes back, and a new build reloads the page
// through the same banner and countdown the app uses. The page's own build id comes from this script's ?v=.
(() => {
  window.RQC_WEB = true;

  // Visitors (GoatCounter, https://<GC>.goatcounter.com): no cookies, nothing personal; only on the website, never in the app.
  // A page view when the site opens; events: which tool is opened (tool-<id>) and «Скачать программу» (download-app).
  const GC = 'rqtools'; // the GoatCounter code (https://rqtools.goatcounter.com); empty = nothing is counted
  const send = params => {
    if (!GC || !/^https:/.test(location.protocol)) return;
    const q = new URLSearchParams({ t: document.title, s: [screen.width, screen.height, window.devicePixelRatio || 1].join(','), rnd: Math.random().toString(36).slice(2), ...params });
    new Image().src = 'https://' + GC + '.goatcounter.com/count?' + q;
  };
  window.rqcTrack = name => send({ p: name, e: 'true' });
  send({ p: '/', r: document.referrer });
  const me = document.currentScript && new URL(document.currentScript.src).searchParams.get('v');
  let state = { status: 'idle' }, last = 0;
  const listeners = [];
  const set = s => { state = s; listeners.forEach(cb => cb(s)); };

  async function check() {
    if (!me || state.status === 'ready') return;
    last = Date.now();
    try {
      const r = await fetch('build.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const b = await r.json();
      if (b.build && b.build !== me) set({ status: 'ready', version: b.version });
    } catch { /* offline: try next time */ }
  }

  window.rqcApp = {
    onUpdate: cb => listeners.push(cb),
    updateState: () => Promise.resolve(state),
    installUpdate: () => location.reload(),
    version: () => Promise.resolve(window.RQC_VERSION && window.RQC_VERSION.version),
  };

  setTimeout(check, 5000); // the browser may have opened a cached old page
  setInterval(check, 5 * 60 * 1000);
  const again = () => { if (document.visibilityState === 'visible' && Date.now() - last > 60 * 1000) check(); };
  document.addEventListener('visibilitychange', again);
  window.addEventListener('focus', again);

  // update texts talk about the page, not the program
  const texts = {
    uk: { updIn: 'Сторінка оновиться через {s} с. Ваш білд збережено.', updWaiting: 'Оновлення зачекає, поки ви закінчите редагувати.', updLater: 'Оновиться, коли перезавантажите сторінку.', updDone: 'Сайт оновлено до v{v}' },
    ru: { updIn: 'Страница обновится через {s} с. Ваш билд сохранён.', updWaiting: 'Обновление подождёт, пока вы закончите редактировать.', updLater: 'Обновится, когда перезагрузите страницу.', updDone: 'Сайт обновлён до v{v}' },
    en: { updIn: 'The page reloads in {s} s. Your build is saved.', updWaiting: 'The reload waits until you finish editing.', updLater: 'It updates when you reload the page.', updDone: 'Updated to v{v}' },
  };
  for (const [k, t] of Object.entries(texts)) if (window.RQC_I18N && RQC_I18N[k]) Object.assign(RQC_I18N[k], t);

  // a link to a tool (rqcalc.com/#timer, #base, #calendar, #calc — the buttons on the search pages): open it, then clean the address
  const TOOL_LINKS = ['calc', 'timer', 'base', 'calendar', 'steam'];
  const openToolLink = () => {
    const id = location.hash.slice(1);
    if (!TOOL_LINKS.includes(id) || typeof switchTool !== 'function') return;
    history.replaceState(null, '', location.pathname + location.search);
    switchTool(id);
  };
  document.addEventListener('DOMContentLoaded', openToolLink);
  window.addEventListener('hashchange', openToolLink);
})();
