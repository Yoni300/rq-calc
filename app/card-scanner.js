'use strict';
/* Card scanner (installed app only): the player points at a card in the game and presses the hotkey (F8);
   main.js + card-scan.js read the card from the screen, this page turns it into an alert in the screen corner:
   «Карта Воко — 190 знаков ≈ 10 450 000». The price of one «Знак» is the player's own, per game server (settings).
   Loads after settings.js; uses app.js helpers at call time (T, lang, fmtNum, h). */
/* global SETTINGS, IS_APP, T, fmtNum, h, saveSettings, drawSettings */

const CARD_SERVERS = [['fenix', 'Fenix'], ['helios', 'Helios']]; // the game's servers
let cardKeyStatus = { ok: true };
let cardKeyListen = false;

const cardPrice = () => +SETTINGS['cardPrice_' + SETTINGS.cardServer] || 0;
function pluralWord(n, w) { // w = [1, 2–4, 5+] (English: [1, many, many])
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? w[2] : b === 1 ? w[0] : b >= 2 && b <= 4 ? w[1] : w[2];
}
const signsWord = n => pluralWord(n, T.cardSignWords);
const cardServerName = () => (CARD_SERVERS.find(s => s[0] === SETTINGS.cardServer) || CARD_SERVERS[0])[1];
// the sum goes to the clipboard as plain digits, ready to paste as the price in the trade window
function cardCopySum(signs) {
  const price = cardPrice(), ok = !!(price && SETTINGS.cardCopy && window.rqcApp.copyText);
  if (ok) window.rqcApp.copyText(String(Math.round(signs * price)));
  return ok;
}

// settings.js → main.js: turn the hotkey on / off
function cardApply() {
  if (!IS_APP || !window.rqcApp.cardSettings) return;
  window.rqcApp.cardSettings({ enabled: !!SETTINGS.cardScan, hotkey: SETTINGS.cardKey || 'F8' });
}

function cardIcon(name) {
  const it = (window.RQ_MARKET_ITEMS || []).find(i => i.cat === 'card' && i.name === name);
  return it ? `../data/market-img/${it.id}.png` : '';
}

// «Считать все карты вместе»: every scanned card adds to one total, shown in a message that stays in the corner until
// it is reset. A held key repeats the scan, so the same card under the same mouse position within 1.5 s counts once;
// pressing again later counts it again (a stack of the same cards).
const CARD_REPEAT_MS = 1500;
let cardTally = [], cardLast = null, cardTotalShown = false;
const cardTotalOn = () => !!(SETTINGS.cardScan && SETTINGS.cardTotal);
const tallySigns = () => cardTally.reduce((n, c) => n + c.signs, 0);
function cardTallyAdd(r) {
  const now = Date.now(), l = cardLast;
  const repeat = l && l.name === r.name && now - l.at < CARD_REPEAT_MS && Math.abs(l.x - r.x) <= 3 && Math.abs(l.y - r.y) <= 3;
  cardLast = { name: r.name, x: r.x, y: r.y, at: now };
  if (repeat) return false;
  cardTally.push({ name: r.name, signs: r.signs });
  return true;
}
function cardShowTotal(copied = false) {
  if (!IS_APP) return;
  if (!cardTotalOn() || !cardTally.length) {
    if (cardTotalShown) window.rqcApp.bossAlert({ key: 'card-total', remove: true, corner: SETTINGS.corner });
    cardTotalShown = false;
    return;
  }
  const n = cardTally.length, signs = tallySigns(), price = cardPrice();
  cardTotalShown = true;
  window.rqcApp.bossAlert({ key: 'card-total', kind: 'total nopic', sticky: true, noOpen: true, corner: SETTINGS.corner,
    title: `${T.cardTotal}: ${n} ${pluralWord(n, T.cardWords)}`,
    big: `${fmtNum(signs, 0)} ${signsWord(signs)}` + (price ? ` ≈ ${fmtNum(signs * price, 0)}` : ''),
    sub: price ? `${cardServerName()} · ${fmtNum(price, 0)} ${T.cardPerSign}` + (copied ? ` · ${T.cardCopied}` : '') : T.cardNoPrice,
    actions: [{ id: 'card-total-undo', label: T.cardUndo }, { id: 'card-total-reset', label: T.cardReset }] });
}

// a scan result → the alert in the screen corner
function cardShowResult(r) {
  const base = { key: 'card', noOpen: true, corner: SETTINGS.corner };
  if (!r || !r.ok) {
    const noOcr = r && r.reason === 'no-ru-ocr', failed = r && r.reason !== 'none';
    window.rqcApp.bossAlert({ ...base, kind: 'miss', ms: noOcr ? 30000 : 6000,
      title: noOcr ? T.cardNoOcr : failed ? T.cardFailed2 : T.cardNone,
      sub: noOcr ? T.cardNoOcrHint : failed ? String(r.reason || '') : r && r.read ? T.cardRead.replace('{text}', r.read) : T.cardNoneHint,
      action: noOcr && window.rqcApp.onCardOcr ? { id: 'install-ru-ocr', label: T.cardOcrInstall } : null });
    return;
  }
  const price = cardPrice(), total = cardTotalOn(), counted = total && cardTallyAdd(r);
  // counting several cards: the clipboard gets the whole sum, and the total message says so
  const copied = cardCopySum(total ? tallySigns() : r.signs);
  window.rqcApp.bossAlert({ ...base, kind: 'sign', ms: 12000, img: cardIcon(r.name), title: r.name,
    big: `${r.signs} ${signsWord(r.signs)}` + (price ? ` ≈ ${fmtNum(r.signs * price, 0)}` : ''),
    sub: total && !counted ? T.cardRepeat
      : price ? `${cardServerName()} · ${fmtNum(price, 0)} ${T.cardPerSign}` + (copied && !total ? ` · ${T.cardCopied}` : '') : T.cardNoPrice });
  if (total) cardShowTotal(copied);
}
if (IS_APP && window.rqcApp.onCardResult) {
  window.rqcApp.onCardStatus(st => { cardKeyStatus = st; if (typeof drawSettings === 'function') drawSettings(); });
  window.rqcApp.onCardResult(cardShowResult);
  // the buttons of the total message
  if (window.rqcApp.onCardAction) window.rqcApp.onCardAction(id => {
    if (id === 'card-total-undo') cardTally.pop();
    else if (id === 'card-total-reset') cardTally = [];
    cardLast = null;
    cardShowTotal(cardTally.length ? cardCopySum(tallySigns()) : false);
  });
  // «Установить» was pressed: Windows installs the Russian text recognition (main.js)
  if (window.rqcApp.onCardOcr) window.rqcApp.onCardOcr(st => {
    const a = { key: 'card', noOpen: true, corner: SETTINGS.corner };
    if (st.state === 'start') window.rqcApp.bossAlert({ ...a, kind: 'miss', ms: 600000, title: T.cardOcrInstalling, sub: T.cardOcrInstallingHint });
    else if (st.state === 'ok') window.rqcApp.bossAlert({ ...a, kind: 'up nopic', ms: 15000, title: T.cardOcrDone, sub: T.cardOcrDoneHint.replace('{key}', SETTINGS.cardKey || 'F8') });
    else window.rqcApp.bossAlert({ ...a, kind: 'miss', ms: 40000, title: st.state === 'cancel' ? T.cardOcrCancel : T.cardOcrFail, sub: T.cardOcrManual,
      action: st.state === 'cancel' ? { id: 'install-ru-ocr', label: T.cardOcrInstall } : null });
  });
}

// the «Сканер карт» block of the settings dialog (settings.js passes its little builders)
function cardSettingsSection({ sec, row, sw, set }) {
  if (!IS_APP || !window.rqcApp.cardSettings) return null;
  const rows = [row(T.setCardScan, T.setCardScanHint, sw('cardScan', () => { cardApply(); cardShowTotal(); }))];
  if (SETTINGS.cardScan) {
    const keyBtn = h('button', { class: 'btn small set-key' + (cardKeyListen ? ' listen' : ''), onclick: () => { cardKeyListen = !cardKeyListen; drawSettings(); } },
      cardKeyListen ? T.cardKeyPress : (SETTINGS.cardKey || 'F8'));
    rows.push(row(T.setCardKey, cardKeyStatus.ok ? T.setCardKeyHint : null, h('div', null, keyBtn,
      cardKeyStatus.ok ? null : h('div', { class: 'set-warn' }, T.cardKeyBusy))));
    rows.push(row(T.setCardServer, null, h('div', { class: 'seg' }, CARD_SERVERS.map(([k, label]) =>
      h('button', { class: SETTINGS.cardServer === k ? 'on' : '', onclick: () => { set('cardServer', k); cardShowTotal(); } }, label)))));
    const inp = h('input', { class: 'inp set-price', type: 'number', min: 0, step: 1000, value: cardPrice() || '', placeholder: '55000' });
    inp.addEventListener('change', () => { set('cardPrice_' + SETTINGS.cardServer, Math.max(0, Math.round(+inp.value || 0)), false); cardShowTotal(); });
    rows.push(row(T.setCardPrice, T.setCardPriceHint, inp));
    if (window.rqcApp.copyText) rows.push(row(T.setCardCopy, T.setCardCopyHint, sw('cardCopy')));
    rows.push(row(T.setCardTotal, T.setCardTotalHint, sw('cardTotal', () => cardShowTotal())));
  }
  return sec(T.setCards, ...rows);
}

// while «press a key» is on: the next key (with Ctrl / Alt / Shift) becomes the hotkey; Esc cancels
document.addEventListener('keydown', e => {
  if (!cardKeyListen) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.key === 'Escape') { cardKeyListen = false; drawSettings(); return; }
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
  const named = { ' ': 'Space', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Pause: 'Pause' };
  let key = /^F\d{1,2}$/.test(e.key) ? e.key : named[e.key] || (/^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5) : /^Numpad\d$/.test(e.code) ? 'num' + e.code.slice(6) : null);
  if (!key) return;
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean);
  // a bare letter or digit would stop working for typing everywhere: those need a modifier
  if (!mods.length && !/^(F\d{1,2}|Insert|Delete|Home|End|PageUp|PageDown|Pause|num\d)$/.test(key)) return;
  cardKeyListen = false;
  SETTINGS.cardKey = [...mods, key].join('+');
  saveSettings(); cardApply(); drawSettings();
}, true);

// the app starts with the scanner as it was left
cardApply();
