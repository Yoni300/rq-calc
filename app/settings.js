'use strict';
/* Settings (gear button in the top bar): look, sound, boss timer alerts and, in the app, tray / start with Windows
   and the card scanner (its block is in app/card-scanner.js).
   Loads before app.js so the theme and size apply before the first paint; the dialog uses app.js helpers at call time. */

const SET_DEFAULTS = {
  theme: 'gold', zoom: 100, motion: true,
  volume: 70, sound: 'bell',
  warnMin: 5, warnMins: null, alertUp: true, popup: true, corner: 'br', popupTime: 'normal', titleTimer: true, // warnMins: early warnings in minutes, several at once; null = the old single warnMin
  tray: false, autostart: false,
  cardScan: false, cardKey: 'F8', cardServer: 'fenix', cardCopy: true, cardTotal: false, statsOn: false, tradeOn: false, // card scanner (app/card-scanner.js); prices: cardPrice_<server>
};
const SETTINGS = (() => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('rqc.settings') || '{}') || {}; } catch { /* defaults */ }
  return Object.assign({}, SET_DEFAULTS, saved);
})();
const IS_APP = !!(window.rqcApp && window.rqcApp.appSettings); // the installed app (not the website)
// the boss timer's early warnings, minutes, ascending (settings saved before 1.0.42 have one number: warnMin, 0 = off)
const warnList = () => (Array.isArray(SETTINGS.warnMins) ? SETTINGS.warnMins : SETTINGS.warnMin ? [SETTINGS.warnMin] : []).filter(m => m > 0).sort((a, b) => a - b);

const THEMES = {
  // accent colors; the dark background stays
  gold: { swatch: '#e6b85c' },
  ice: { swatch: '#7cc4e8' },
  blood: { swatch: '#e87a6a' },
  emerald: { swatch: '#74d39a' },
  amethyst: { swatch: '#b99cf0' },
};
const SOUNDS = ['bell', 'soft', 'chime', 'horn'];
const POPUP_MS = { short: { soon: 6000, up: 12000 }, normal: { soon: 12000, up: 25000 }, long: { soon: 30000, up: 60000 } };

function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = SETTINGS.theme;
  // the app scales the whole window; CSS zoom (the website) also stretches 100vh/100vw and moves tips off the screen
  if (window.rqcApp?.setZoom) { window.rqcApp.setZoom(SETTINGS.zoom / 100); root.style.zoom = ''; }
  else root.style.zoom = SETTINGS.zoom === 100 ? '' : SETTINGS.zoom / 100;
  root.classList.toggle('no-motion', !SETTINGS.motion);
  if (IS_APP) {
    const t = typeof T !== 'undefined' ? T : {}; // app.js (texts) may not be loaded yet
    window.rqcApp.appSettings({ tray: SETTINGS.tray, autostart: SETTINGS.autostart, lblOpen: t.setTrayOpen, lblQuit: t.setTrayQuit });
  }
}
function saveSettings() {
  try { localStorage.setItem('rqc.settings', JSON.stringify(SETTINGS)); } catch { /* ignore */ }
  applySettings();
}
applySettings();

// ---------- the dialog ----------
let setWrap = null;
function closeSettings() {
  if (!setWrap) return;
  setWrap.remove(); setWrap = null;
  document.removeEventListener('keydown', setKey, true);
}
function setKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeSettings(); } }

function openSettings() {
  if (setWrap) { closeSettings(); return; }
  setWrap = h('div', { class: 'modal confirm-wrap' });
  setWrap.addEventListener('mousedown', e => { if (e.target === setWrap) closeSettings(); });
  document.addEventListener('keydown', setKey, true);
  document.body.append(setWrap);
  drawSettings();
}

function drawSettings() {
  if (!setWrap) return;
  const scroll = setWrap.querySelector('.set-body')?.scrollTop || 0;
  const set = (k, v, redraw = true) => { SETTINGS[k] = v; saveSettings(); if (redraw) drawSettings(); };
  const seg = (k, items) => h('div', { class: 'seg' }, items.map(([v, label, tip]) =>
    h('button', { class: SETTINGS[k] === v ? 'on' : '', title: tip || null, onclick: () => set(k, v) }, label)));
  const sw = (k, after) => h('label', { class: 'set-sw' },
    h('input', { type: 'checkbox', checked: !!SETTINGS[k], onchange: e => { set(k, e.target.checked); if (after) after(); } }), h('span'));
  const row = (label, hint, control) => h('div', { class: 'set-row' },
    h('div', { class: 'set-l' }, h('b', null, label), hint ? h('small', null, hint) : null), h('div', { class: 'set-c' }, control));
  const sec = (title, ...rows) => h('div', { class: 'set-sec' }, h('h4', null, title), rows);

  const vol = h('input', { type: 'range', min: 0, max: 100, step: 5, value: SETTINGS.volume, class: 'set-range' });
  const volN = h('span', { class: 'set-num' }, SETTINGS.volume + '%');
  vol.addEventListener('input', () => { SETTINGS.volume = +vol.value; volN.textContent = vol.value + '%'; saveSettings(); });
  vol.addEventListener('change', () => beep('up'));

  const body = h('div', { class: 'set-body' },
    sec(T.setLook,
      row(T.setTheme, null, h('div', { class: 'set-themes' }, Object.entries(THEMES).map(([k, th]) =>
        h('button', { class: 'set-theme' + (SETTINGS.theme === k ? ' on' : ''), title: T.themeNames[k], onclick: () => set('theme', k) },
          h('i', { style: `background:${th.swatch}` }), T.themeNames[k])))),
      row(T.setZoom, T.setZoomHint, seg('zoom', [[90, '90%'], [100, '100%'], [110, '110%'], [125, '125%']])),
      row(T.setMotion, T.setMotionHint, sw('motion')),
      row(T.language, null, h('div', { class: 'seg' }, [['uk', 'УКР'], ['ru', 'РУС'], ['en', 'ENG']].map(([k, label]) =>
        h('button', { class: k === lang ? 'on' : '', onclick: () => {
          lang = k; T = RQC_I18N[k]; store.set('lang', k); applyGameLang(); recalc(); renderAll(); applySettings(); drawSettings();
        } }, label))))),
    sec(T.setSound,
      row(T.setVolume, null, h('div', { class: 'set-inline' }, vol, volN)),
      row(T.setMelody, null, h('div', { class: 'set-inline' },
        h('div', { class: 'seg' }, SOUNDS.map(k => h('button', { class: SETTINGS.sound === k ? 'on' : '',
          onclick: () => { set('sound', k); beep('up'); } }, T.soundNames[k]))),
        h('button', { class: 'btn small', title: T.bossTestTip, onclick: () => { beep('soon'); setTimeout(() => beep('up'), 900); } }, '▶')))),
    sec(T.setTimer,
      // several warnings at once: a press turns one on, the next press turns it off; «off» clears them all
      row(T.setWarn, T.setWarnHint, h('div', { class: 'seg' }, [[0, T.setOff], [1, '1'], [3, '3'], [5, '5'], [10, '10'], [15, '15']].map(([v, label]) => {
        const cur = warnList(), on = v === 0 ? !cur.length : cur.includes(v);
        return h('button', { class: on ? 'on' : '', onclick: () => set('warnMins', v === 0 ? [] : on ? cur.filter(x => x !== v) : [...cur, v].sort((a, b) => a - b)) }, label);
      }))),
      row(T.setAlertUp, null, sw('alertUp')),
      IS_APP ? row(T.setPopup, T.setPopupHint, sw('popup')) : null,
      IS_APP && SETTINGS.popup ? row(T.setCorner, null, seg('corner', [['tl', '↖', T.cornerNames.tl], ['tr', '↗', T.cornerNames.tr], ['bl', '↙', T.cornerNames.bl], ['br', '↘', T.cornerNames.br]])) : null,
      IS_APP && SETTINGS.popup ? row(T.setPopupTime, null, seg('popupTime', [['short', T.setShort], ['normal', T.setNormal], ['long', T.setLong]])) : null,
      row(T.setTitleTimer, T.setTitleTimerHint, sw('titleTimer'))),
    IS_APP ? sec(T.setApp,
      row(T.setTray, T.setTrayHint, sw('tray')),
      row(T.setAutostart, T.setAutostartHint, sw('autostart'))) : null,
    typeof cardSettingsSection === 'function' ? cardSettingsSection({ sec, row, sw, set }) : null);

  setWrap.innerHTML = '';
  setWrap.append(h('div', { class: 'dialog set-dlg' },
    h('div', { class: 'dialog-head' }, h('h3', null, T.settings), h('button', { class: 'btn small ghost', onclick: closeSettings }, '✕')),
    body,
    h('div', { class: 'set-foot' },
      h('button', { class: 'btn ghost', onclick: async () => {
        if (!await confirmBox(T.setResetAsk, { ok: T.setReset })) return;
        Object.assign(SETTINGS, SET_DEFAULTS); saveSettings(); drawSettings();
        if (typeof cardApply === 'function') cardApply();
      } }, T.setReset),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn primary', onclick: closeSettings }, T.done))));
  body.scrollTop = scroll;
}
