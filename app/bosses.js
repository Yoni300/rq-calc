'use strict';
/* Boss timer: respawn countdowns for world bosses and elites (data/bosses.js, made from royalquest.info).
   Personal timers stay on this device; a group (8-character code) shares them through Supabase
   (server/006-boss-timer.sql). Uses globals from app.js / builds.js at call time (h, T, store, sb, …). */

// one entry per boss and location: Дуан Безжалостный lives in four places, each with its own timer
const BOSSES = (window.RQ_BOSSES || []).flatMap(b => b.spots.map(s => ({
  key: b.name + ' | ' + s.loc, name: b.name, level: b.level, elite: b.type !== 'Босс', loc: s.loc, resp: s.resp, img: b.img,
})));
// this file loads before app.js (which may draw the boss tab right away), so it reads its settings itself
const bget = (k, def) => { try { const v = localStorage.getItem('rqc.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const BT = {
  room: bget('bossRoom', null), nick: bget('bossNick', ''), filter: bget('bossFilter', 'all'), q: '',
  local: bget('bossKills', {}),             // personal timers: key -> { t }
  remote: {}, loaded: false, error: null, busy: false,
  fav: new Set(bget('bossFav', [])),
  notify: bget('bossNotify', true),
  resp: bget('bossResp', {}),               // key -> minutes, the player's own respawn time
  warned: {},                               // key -> { t: kill time, kind: 'soon' | 'up' } already announced
  rows: new Map(),                          // key -> elements updated every second
};
const SOON = 5 * 60e3;                      // warn this long before the respawn
const STALE = 24 * 3600e3;                  // a respawn this old says nothing any more

const kills = () => (BT.room ? BT.remote : BT.local);
const respOf = b => BT.resp[b.key] || b.resp;
const locale = () => ({ uk: 'uk-UA', ru: 'ru-RU', en: 'en-GB' }[lang] || 'ru-RU');
const clock = t => new Date(t).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
function fmtResp(min) { const hh = Math.floor(min / 60), mm = min % 60; return (hh ? `${hh} ${T.hShort} ` : '') + (mm || !hh ? `${mm} ${T.mShort}` : ''); }
function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000)), hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60;
  return (hh ? hh + ':' + String(mm).padStart(2, '0') : String(mm)) + ':' + String(ss).padStart(2, '0');
}
const fmtAgo = ms => (ms < 60e3 ? T.bossNow.toLowerCase() : fmtResp(Math.floor(ms / 60e3)));

// state of one timer: none (unknown) / wait (counting down) / up (should be alive)
function bossState(b, now = Date.now()) {
  const k = kills()[b.key];
  if (!k) return { s: 'none' };
  const spawn = k.t + respOf(b) * 60e3;
  if (now < spawn) return { s: 'wait', k, spawn, left: spawn - now, part: 1 - (spawn - now) / (respOf(b) * 60e3) };
  if (now - spawn < STALE) return { s: 'up', k, spawn };
  return { s: 'none' };
}

// ---------- server ----------
async function loadRoom() {
  if (!BT.room || !sbConfigured() || BT.busy) return;
  BT.busy = true;
  try {
    const rows = await sb('rpc/boss_room', { method: 'POST', body: JSON.stringify({ p_room: BT.room }) });
    const m = {};
    for (const r of rows || []) m[r.boss] = { t: Date.parse(r.killed_at), by: r.by_name, at: Date.parse(r.updated_at) };
    BT.remote = m; BT.loaded = true; BT.error = null;
  } catch (e) { BT.error = /boss_room|PGRST202|404/.test(e.message) ? T.bossNeedSql : T.pbError + ' ' + e.message; }
  BT.busy = false;
  if (tab === 'bosses') drawBossList();
}
async function setKill(b, t) {
  if (!BT.room) {
    if (t == null) delete BT.local[b.key]; else BT.local[b.key] = { t };
    store.set('bossKills', BT.local); drawBossList();
    return;
  }
  const prev = BT.remote[b.key];
  if (t == null) delete BT.remote[b.key]; else BT.remote[b.key] = { t, by: BT.nick || null, at: Date.now() };
  drawBossList();
  try {
    await sb('rpc/boss_set_kill', { method: 'POST', body: JSON.stringify({
      p_room: BT.room, p_boss: b.key, p_killed_at: t == null ? null : new Date(t).toISOString(), p_by: BT.nick || null }) });
  } catch (e) {
    if (prev) BT.remote[b.key] = prev; else delete BT.remote[b.key];
    drawBossList();
    toast(/PGRST202|404/.test(e.message) ? T.bossNeedSql : T.bossSaveErr);
  }
}

// ---------- groups ----------
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => [...crypto.getRandomValues(new Uint8Array(8))].map(x => CODE_ABC[x % 32]).join('');
function setRoom(code) {
  BT.room = code; BT.remote = {}; BT.loaded = false; BT.error = null; BT.warned = {};
  store.set('bossRoom', code);
  renderCenter();
  loadRoom();
}
function copyCode() { navigator.clipboard?.writeText(BT.room).then(() => toast(T.bossCopied), () => {}); }
async function createRoom() {
  const code = newCode();
  // personal timers that still count go into the new group
  const carry = Object.entries(BT.local).filter(([, k]) => Date.now() - k.t < 2 * 86400e3);
  setRoom(code);
  navigator.clipboard?.writeText(code).catch(() => {});
  toast(fmtT(T.bossCreated, { c: code }));
  for (const [key, k] of carry) {
    const b = BOSSES.find(x => x.key === key);
    if (b) await setKill(b, k.t);
  }
}
async function leaveRoom() {
  if (!await confirmBox(fmtT(T.bossLeaveAsk, { c: BT.room }), { ok: T.bossLeave })) return;
  setRoom(null);
}

// small dialog in the app's style; body gets the elements, ok() returns false to keep it open
function bossDialog(title, body, ok) {
  const wrap = h('div', { class: 'modal confirm-wrap' });
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); };
  const submit = () => { if (ok() !== false) close(); };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); submit(); }
  };
  document.addEventListener('keydown', onKey, true);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  wrap.append(h('div', { class: 'dialog confirm bt-dlg' },
    h('h3', null, title), body,
    h('div', { class: 'confirm-foot' }, h('button', { class: 'btn', onclick: close }, T.cancel), h('button', { class: 'btn primary', onclick: submit }, T.bossOk))));
  document.body.append(wrap);
  return close;
}
function joinRoom() {
  const inp = h('input', { class: 'inp bt-code-inp', maxLength: 12, spellcheck: false, placeholder: 'ABCD2345' });
  const err = h('div', { class: 'warn', hidden: true }, T.bossBadCode);
  bossDialog(T.bossJoinTitle, h('div', { class: 'bt-dlg-body' }, h('div', { class: 'hint' }, T.bossJoinHint), inp, err), () => {
    const code = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z0-9]{8}$/.test(code)) { err.hidden = false; inp.focus(); return false; }
    setRoom(code);
  });
  inp.focus();
}
function editKill(b) {
  const k = kills()[b.key];
  const base = new Date(k ? k.t : Date.now());
  const time = h('input', { type: 'time', class: 'inp', value: String(base.getHours()).padStart(2, '0') + ':' + String(base.getMinutes()).padStart(2, '0') });
  let close;
  const ago = m => { close(); setKill(b, Date.now() - m * 60e3); };
  close = bossDialog(fmtT(T.bossKillTitle, { n: b.name }), h('div', { class: 'bt-dlg-body' },
    h('div', { class: 'bt-quick' }, [0, 5, 10, 15, 30, 60, 90, 120].map(m =>
      h('button', { class: 'btn small', onclick: () => ago(m) }, m ? fmtT(T.bossAgo, { m }) : T.bossNow))),
    h('label', { class: 'bt-lbl' }, T.bossTimeLbl, time)), () => {
    const [hh, mm] = time.value.split(':').map(Number);
    if (!isFinite(hh) || !isFinite(mm)) return false;
    const d = new Date(); d.setHours(hh, mm, 0, 0);
    if (d.getTime() > Date.now() + 60e3) d.setDate(d.getDate() - 1); // a time later than now was yesterday
    setKill(b, d.getTime());
  });
}
function editResp(b) {
  const inp = h('input', { type: 'number', class: 'inp', min: 1, max: 2880, value: respOf(b) });
  let close;
  const save = v => { if (v && v !== b.resp) BT.resp[b.key] = v; else delete BT.resp[b.key]; store.set('bossResp', BT.resp); drawBossList(); };
  close = bossDialog(fmtT(T.bossRespTitle, { n: b.name }), h('div', { class: 'bt-dlg-body' },
    h('div', { class: 'hint' }, fmtT(T.bossRespHint, { d: fmtResp(b.resp) })),
    h('div', { class: 'bt-resp-row' }, inp, h('span', null, T.mShort),
      h('button', { class: 'btn small', onclick: () => { close(); save(null); } }, T.bossRespReset))), () => {
    const v = Math.round(+inp.value);
    if (!(v >= 1 && v <= 2880)) return false;
    save(v);
  });
  inp.select();
}

// ---------- alerts ----------
let audio = null;
// the browser starts sound only after a click and resuming takes a moment: wait for it, then play
async function beep(kind) {
  try {
    audio = audio || new AudioContext();
    if (audio.state !== 'running') await audio.resume();
    const start = audio.currentTime + 0.05;
    (kind === 'up' ? [660, 880, 1175] : [660, 880]).forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain(), t0 = start + i * 0.17;
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + 0.17);
    });
  } catch { /* no sound */ }
}
function askNotify() {
  try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ignore */ }
  try { audio = audio || new AudioContext(); audio.resume(); } catch { /* ignore */ }
}
// The site may be open in several tabs: the first tab to announce a respawn takes it, the others stay quiet
function claimAlert(id) {
  try {
    const now = Date.now(), seen = JSON.parse(localStorage.getItem('rqc.bossAlerted') || '{}');
    if (seen[id]) return false;
    for (const k in seen) if (now - seen[k] > 86400e3) delete seen[k];
    seen[id] = now;
    localStorage.setItem('rqc.bossAlerted', JSON.stringify(seen));
  } catch { /* no storage: just announce */ }
  return true;
}
// one message per alert: the system notification, or (when it is not allowed) a message inside the page
function alertBoss(b, kind, left, test = false) {
  const title = kind === 'up' ? fmtT(T.bossUpN, { n: b.name }) : fmtT(T.bossSoonN, { n: b.name, m: Math.max(1, Math.ceil(left / 60e3)) });
  beep(kind);
  let shown = false;
  try {
    if (window.Notification && Notification.permission === 'granted') {
      // the same tag replaces an older message about the same boss instead of adding another one
      const n = new Notification(title, { body: b.loc || '', tag: test ? 'rqc-test' : `rqc-${b.key}`, renotify: true, silent: true,
        icon: b.img ? `../data/bosses/${b.img}` : undefined });
      n.onclick = () => { window.focus(); if (tab !== 'bosses') openBosses(); n.close(); };
      shown = true;
    }
  } catch { /* ignore */ }
  if (!shown) toast(title);
}
// "listen": both sounds and both messages. Example: the boss that comes next, else a favourite, else no name.
let testing = false;
async function testAlert(e) {
  if (testing) return; // a second click while it plays would mix the sounds
  testing = true;
  const btn = e && e.currentTarget; if (btn) btn.disabled = true;
  try { if (window.Notification && Notification.permission === 'default') await Notification.requestPermission(); } catch { /* ignore */ }
  const now = Date.now();
  const next = BOSSES.map(b => ({ b, st: bossState(b, now) })).filter(x => x.st.s === 'wait').sort((x, y) => x.st.spawn - y.st.spawn)[0];
  const b = next ? next.b : BOSSES.find(x => BT.fav.has(x.name)) || { name: T.bossTestName, loc: '' };
  alertBoss(b, 'soon', SOON, true);
  setTimeout(() => alertBoss(b, 'up', 0, true), 2200);
  setTimeout(() => { testing = false; if (btn) btn.disabled = false; }, 3200);
}
// with favourites, only they make noise
function checkAlerts(now) {
  if (!BT.notify) return;
  const onlyFav = BT.fav.size > 0;
  for (const b of BOSSES) {
    if (onlyFav && !BT.fav.has(b.name)) continue;
    const st = bossState(b, now);
    if (st.s === 'none') continue;
    const w = BT.warned[b.key], done = w && w.t === st.k.t ? w.kind : null; // a new kill starts over
    if (st.s === 'wait' && st.left <= SOON && !done) {
      BT.warned[b.key] = { t: st.k.t, kind: 'soon' };
      if (claimAlert(`${b.key}|${st.k.t}|soon`)) alertBoss(b, 'soon', st.left);
    } else if (st.s === 'up' && now - st.spawn < 2 * 60e3 && done !== 'up') {
      BT.warned[b.key] = { t: st.k.t, kind: 'up' };
      if (claimAlert(`${b.key}|${st.k.t}|up`)) alertBoss(b, 'up');
    }
  }
}
// opening the app must not announce respawns that happened long ago
function primeAlerts() {
  const now = Date.now();
  for (const b of BOSSES) {
    const st = bossState(b, now);
    if (st.s === 'up' && now - st.spawn >= 2 * 60e3) BT.warned[b.key] = { t: st.k.t, kind: 'up' };
  }
}

// ---------- view ----------
function openBosses() { tab = 'bosses'; store.set('tab', tab); renderCenter(); animateEnter($('center')); renderTop(); }

function renderBosses(el) {
  const seg = (items, cur, on) => h('div', { class: 'seg' }, items.map(([v, label]) => h('button', { class: v === cur ? 'on' : '', onclick: () => on(v) }, label)));
  const search = h('input', { class: 'inp', placeholder: T.search, value: BT.q, spellcheck: false });
  search.addEventListener('input', () => { BT.q = search.value; drawBossList(); });
  const nick = h('input', { class: 'inp bt-nick', placeholder: T.bossNick, title: T.bossNickTip, value: BT.nick, maxLength: 24, spellcheck: false });
  nick.addEventListener('input', () => { BT.nick = nick.value.trim(); store.set('bossNick', BT.nick); });

  el.append(h('div', { class: 'bt-room' + (BT.room ? ' on' : '') },
    BT.room
      ? [h('span', { class: 'bt-room-l' }, iconEl('group'), T.bossGroup),
        h('button', { class: 'bt-code', title: T.bossCopy, onclick: copyCode }, BT.room, h('span', { class: 'bt-copy' }, '⧉')),
        nick, h('div', { class: 'spacer' }),
        h('button', { class: 'btn small', title: T.pbRefresh, onclick: () => loadRoom() }, '⟳'),
        h('button', { class: 'btn small ghost', onclick: leaveRoom }, T.bossLeave)]
      : [h('span', { class: 'bt-room-l' }, iconEl('lock'), T.bossPersonal), h('div', { class: 'spacer' }),
        sbConfigured() ? [h('button', { class: 'btn small primary', onclick: createRoom }, T.bossCreate),
          h('button', { class: 'btn small', onclick: joinRoom }, T.bossJoin)] : null]));

  el.append(h('div', { class: 'pb-bar' },
    seg([['fav', '★ ' + T.bossFav], ['boss', T.bossBosses], ['elite', T.bossElites], ['all', T.bossAll]], BT.filter,
      v => { BT.filter = v; store.set('bossFilter', v); renderCenter(); }),
    search,
    h('button', { class: 'btn bt-bell' + (BT.notify ? ' on' : ''), title: T.bossNotify,
      onclick: () => { BT.notify = !BT.notify; store.set('bossNotify', BT.notify); if (BT.notify) askNotify(); renderCenter(); } }, BT.notify ? '🔔' : '🔕'),
    h('button', { class: 'btn', title: T.bossTestTip, onclick: testAlert }, '▶ ' + T.bossTest)));
  el.append(h('div', { class: 'bt-list', id: 'bossList' }));
  el.append(h('div', { class: 'note bt-src' }, T.bossSource));
  drawBossList();
  if (BT.room && !BT.loaded) loadRoom();
}

function drawBossList() {
  const list = document.getElementById('bossList');
  if (!list) return;
  list.innerHTML = ''; BT.rows.clear();
  if (BT.room && BT.error) list.append(h('div', { class: 'warn pb-msg' }, BT.error));
  const now = Date.now();
  const items = BOSSES.filter(b => (BT.filter === 'all' || (BT.filter === 'fav' ? BT.fav.has(b.name) : (BT.filter === 'elite') === b.elite))
    && matches(BT.q, b.name, b.loc))
    .map(b => ({ b, st: bossState(b, now) }));
  const rank = { wait: 0, up: 1, none: 2 };
  items.sort((x, y) => rank[x.st.s] - rank[y.st.s]
    || (x.st.s === 'wait' ? x.st.spawn - y.st.spawn : x.st.s === 'up' ? y.st.spawn - x.st.spawn : 0)
    || x.b.level - y.b.level || x.b.name.localeCompare(y.b.name));
  if (!items.length) { list.append(h('div', { class: 'hint pb-msg' }, BT.filter === 'fav' && !BT.fav.size ? T.bossNoFav : T.bossEmpty)); return; }
  for (const { b, st } of items) list.append(bossRow(b, st));
}

function bossRow(b, st) {
  const fav = BT.fav.has(b.name);
  const big = h('div', { class: 'bt-big' }), sub = h('div', { class: 'bt-sub' }), bar = h('i');
  const row = h('div', { class: 'bt-row ' + st.s + (b.elite ? ' elite' : '') },
    h('div', { class: 'bt-pic' }, b.img ? h('img', { src: `../data/bosses/${b.img}`, alt: '', draggable: 'false' }) : null),
    h('div', { class: 'bt-info' },
      h('div', { class: 'bt-name' },
        h('button', { class: 'bt-star' + (fav ? ' on' : ''), title: T.bossFavTip, onclick: () => {
          if (fav) BT.fav.delete(b.name); else BT.fav.add(b.name);
          store.set('bossFav', [...BT.fav]); drawBossList();
        } }, fav ? '★' : '☆'),
        h('span', null, b.name)),
      h('div', { class: 'bt-meta' }, `${T.lvl} ${b.level} · ${b.elite ? T.bossElite : T.bossBoss} · ${b.loc}`),
      h('button', { class: 'bt-resp' + (BT.resp[b.key] ? ' custom' : ''), title: fmtT(T.bossResp, { d: fmtResp(respOf(b)) }), onclick: () => editResp(b) },
        '⟳ ', fmtResp(respOf(b)))),
    h('div', { class: 'bt-state' }, big, sub),
    h('div', { class: 'bt-act' },
      h('button', { class: 'btn small primary bt-kill', title: T.bossKilledTip, onclick: () => { askNotify(); setKill(b, Date.now()); } }, '☠ ' + T.bossKilled),
      h('button', { class: 'btn small', title: T.bossEdit, onclick: () => editKill(b) }, '✎'),
      st.k ? h('button', { class: 'btn small ghost', title: T.bossClear, onclick: () => setKill(b, null) }, '✕') : null),
    h('div', { class: 'bt-prog' }, bar));
  BT.rows.set(b.key, { b, s: st.s, big, sub, bar });
  paintRow(BT.rows.get(b.key), st, Date.now());
  return row;
}

function paintRow(r, st, now) {
  const by = st.k && BT.room && st.k.by ? ' · ' + fmtT(T.bossBy, { n: st.k.by, a: fmtAgo(now - st.k.t) }) : '';
  if (st.s === 'wait') {
    r.big.textContent = fmtLeft(st.left);
    r.sub.textContent = fmtT(T.bossAt, { t: clock(st.spawn) }) + by;
    r.bar.style.width = (st.part * 100).toFixed(2) + '%';
  } else if (st.s === 'up') {
    r.big.textContent = T.bossUp;
    r.sub.textContent = fmtT(T.bossUpSince, { t: clock(st.spawn), a: fmtAgo(now - st.spawn) }) + by;
    r.bar.style.width = '100%';
  } else {
    r.big.textContent = T.bossUnknown;
    r.sub.textContent = T.bossUnknownSub;
    r.bar.style.width = '0';
  }
}

// every second: countdowns, alerts; the group is re-read every 15 s on this tab, every minute otherwise
let bossPoll = 0;
setInterval(() => {
  const now = Date.now();
  checkAlerts(now);
  if (tab === 'bosses' && BT.rows.size) {
    let moved = false;
    for (const r of BT.rows.values()) {
      const st = bossState(r.b, now);
      if (st.s !== r.s) { moved = true; break; }
      paintRow(r, st, now);
    }
    if (moved) drawBossList();
  }
  if (BT.room && ++bossPoll >= (tab === 'bosses' && !document.hidden ? 15 : 60)) { bossPoll = 0; loadRoom(); }
}, 1000);
primeAlerts();
if (BT.room) loadRoom().then(primeAlerts);
