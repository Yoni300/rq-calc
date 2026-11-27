'use strict';
/* «Главная»: the page the app opens on. A tile for every tool, each showing what is going on there right now: the build,
   the nearest boss respawns, the game status, the calendar, the news… A click opens the tool. Tiles can be dragged into
   one's own order (kept in the storage). Uses globals from app.js and the tool files at call time. */

const HOME_T = {
  uk: {
    title: 'Головна', sub: 'Усе головне на одному екрані',
    greet: ['Доброї ночі!', 'Доброго ранку!', 'Доброго дня!', 'Доброго вечора!'],
    srvOk: 'сервер працює', srvMaint: 'на сервері техроботи', srvDrop: 'онлайн різко впав', nextBoss: 'найближчий бос: {n} через {t}', eventNow: 'зараз: {n}',
    search: 'Знайти монстра, предмет, НПС, рецепт…', showAll: 'Показати все ({n})', nothing: 'Нічого не знайдено',
    cur: 'Поточний білд', saved: 'Збережені білди', openCalc: 'Відкрити калькулятор',
    noTimers: 'Таймерів ще немає. Відкрийте таймер і натисніть «Вбили», коли побачите боса.', allBosses: 'Усі боси', personal: 'Особисті таймери',
    unread: '{n} нових', guides: 'Гайдів: {n}', newest: 'Найновіший',
    webOnly: 'Тільки в програмі для Windows', lastSess: 'Остання сесія', noSess: 'Збережених сесій ще немає', overlayOn: 'Панель над грою увімкнена',
    lastOpened: 'Нещодавно відкривали',
    drag: 'Плитки можна перетягувати, щоб змінити порядок.', reset: 'Повернути порядок',
  },
  ru: {
    title: 'Главная', sub: 'Всё главное на одном экране',
    greet: ['Доброй ночи!', 'Доброе утро!', 'Добрый день!', 'Добрый вечер!'],
    srvOk: 'сервер работает', srvMaint: 'на сервере техработы', srvDrop: 'онлайн резко упал', nextBoss: 'ближайший босс: {n} через {t}', eventNow: 'сейчас: {n}',
    search: 'Найти монстра, предмет, НПС, рецепт…', showAll: 'Показать всё ({n})', nothing: 'Ничего не найдено',
    cur: 'Текущий билд', saved: 'Сохранённые билды', openCalc: 'Открыть калькулятор',
    noTimers: 'Таймеров пока нет. Откройте таймер и нажмите «Убили», когда увидите босса.', allBosses: 'Все боссы', personal: 'Личные таймеры',
    unread: '{n} новых', guides: 'Гайдов: {n}', newest: 'Самый новый',
    webOnly: 'Только в программе для Windows', lastSess: 'Последняя сессия', noSess: 'Сохранённых сессий пока нет', overlayOn: 'Панель поверх игры включена',
    lastOpened: 'Недавно открывали',
    drag: 'Плитки можно перетаскивать, чтобы поменять порядок.', reset: 'Вернуть порядок',
  },
  en: {
    title: 'Home', sub: 'Everything that matters on one screen',
    greet: ['Good evening!', 'Good morning!', 'Good afternoon!', 'Good evening!'],
    srvOk: 'the server is up', srvMaint: 'the server is under maintenance', srvDrop: 'players suddenly dropped', nextBoss: 'next boss: {n} in {t}', eventNow: 'now: {n}',
    search: 'Find a monster, item, NPC, recipe…', showAll: 'Show all ({n})', nothing: 'Nothing found',
    cur: 'Current build', saved: 'Saved builds', openCalc: 'Open the calculator',
    noTimers: 'No timers yet. Open the timer and press «Killed» when you see a boss.', allBosses: 'All bosses', personal: 'Personal timers',
    unread: '{n} new', guides: '{n} guides', newest: 'Newest',
    webOnly: 'Windows app only', lastSess: 'Last session', noSess: 'No saved sessions yet', overlayOn: 'The panel over the game is on',
    lastOpened: 'Recently opened',
    drag: 'Drag the tiles to change their order.', reset: 'Reset the order',
  },
};
const HTX = () => HOME_T[lang] || HOME_T.ru;

// tiles in their default order; w2 = two columns wide, h2 = two rows tall
const HOME_TILES = [
  { id: 'calc', size: 'w2 h2', icon: 'calc', name: () => T.toolCalc, sub: () => T.toolCalcSub, open: () => switchTool('calc') },
  { id: 'timer', size: 'w2 h2', icon: 'skull', name: () => T.toolTimer, sub: () => (BT.room ? `${T.bossGroup} ${BT.room}` : HTX().personal), open: () => switchTool('timer') },
  { id: 'status', size: '', icon: 'globe', name: () => SVT().title, sub: () => '', open: () => openServerMenu() },
  { id: 'cal', size: '', icon: 'calendar', name: () => CTX().title, sub: () => CTX().sub, open: () => switchTool('calendar') },
  { id: 'news', size: 'w2', icon: 'news', name: () => STX().title, sub: () => STX().sub, open: () => switchTool('steam') },
  { id: 'base', size: 'w2', icon: 'book', name: () => BTX().title, sub: () => BTX().sub, open: () => switchTool('base') },
  { id: 'guides', size: '', icon: 'guide', name: () => GTX().title, sub: () => GTX().sub, open: () => switchTool('guides') },
  { id: 'stats', size: '', icon: 'chart', name: () => STT().title, sub: () => STT().sub, open: () => switchTool('stats') },
  { id: 'trade', size: '', icon: 'trade', name: () => TRT().title, sub: () => TRT().sub, open: () => switchTool('trade') },
  { id: 'font', size: '', icon: 'font', name: () => FTX().title, sub: () => FTX().sub, open: () => switchTool('font'), has: () => typeof FTX === 'function' },
].filter(t => !t.has || t.has());
const HM = { boss: [], bossSig: '', q: '', drag: null };

function homeOrder() {
  const saved = (store.get('homeOrder', null) || []).filter(id => HOME_TILES.some(t => t.id === id));
  return [...saved, ...HOME_TILES.map(t => t.id).filter(id => !saved.includes(id))].map(id => HOME_TILES.find(t => t.id === id));
}
const hmStop = fn => e => { e.stopPropagation(); fn(e); };

function renderHome(el) {
  const t = HTX();
  const hour = new Date().getHours();
  const greet = t.greet[hour < 5 || hour >= 23 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3];
  el.append(h('div', { class: 'hm' },
    h('div', { class: 'hm-head' },
      h('div', { class: 'hm-hello' }, h('h1', null, greet), h('p', { id: 'hmSum' })),
      homeSearch()),
    h('div', { class: 'hm-grid', id: 'hmGrid' }),
    h('div', { class: 'hm-foot' }, h('span', { class: 'hm-drag' }, t.drag),
      store.get('homeOrder', null) ? h('button', { class: 'hm-link', onclick: () => { store.set('homeOrder', null); renderCenter(); } }, t.reset) : null)));
  drawHomeTiles();
  homeSummary();
  // what is not loaded yet comes in a moment
  if (!SN.items && !SN.loading) loadSteamNews().then(() => homeRefresh());
  if (IS_APP && window.rqcApp.stats) { window.rqcApp.stats({ action: 'state' }); setTimeout(() => homeRefresh(), 700); }
  if (BT.room && !BT.loaded) loadRoom().then(() => homeRefresh());
}

// ---------- the search over the whole base ----------
function homeSearch() {
  const t = HTX();
  const box = h('div', { class: 'hm-search' });
  const res = h('div', { class: 'hm-res', hidden: true });
  const inp = h('input', { class: 'inp', id: 'hmQ', placeholder: t.search, value: HM.q, spellcheck: false, autocomplete: 'off' });
  const all = () => { BS.q = inp.value; BS.pane = 'list'; switchTool('base'); };
  const draw = () => {
    HM.q = inp.value;
    const q = inp.value.trim();
    res.innerHTML = '';
    if (q.length < 2) { res.hidden = true; return; }
    const list = BCATS.flatMap(c => entriesOf(c)).filter(e => matches(q, e.name));
    res.hidden = false;
    if (!list.length) { res.append(h('div', { class: 'bs-empty' }, t.nothing)); return; }
    for (const e of list.slice(0, 8)) res.append(baseRow(e, true, () => { BS.q = q; openBase(e.kind, e.key, { push: false }); }));
    if (list.length > 8) res.append(h('button', { class: 'hm-all', onclick: all }, fmtT(t.showAll, { n: list.length })));
  };
  inp.addEventListener('input', draw);
  inp.addEventListener('focus', draw);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && inp.value.trim()) all();
    if (e.key === 'Escape') { inp.value = ''; draw(); inp.blur(); }
  });
  box.append(iconEl('search'), inp, matchMedia('(pointer: fine)').matches ? h('kbd', null, 'Ctrl K') : null, res);
  return box;
}
document.addEventListener('click', e => {
  const r = document.querySelector('.hm-res');
  if (r && !r.hidden && !e.target.closest('.hm-search')) r.hidden = true;
});
document.addEventListener('keydown', e => {
  if (tab !== 'home' || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return;
  e.preventDefault();
  $('hmQ')?.focus();
});

// ---------- the line under the greeting ----------
function homeSummary() {
  const el = $('hmSum');
  if (!el) return;
  const t = HTX(), parts = [];
  const s = serverState();
  if (s.k !== 'unknown') parts.push({ ok: t.srvOk, maint: t.srvMaint, drop: t.srvDrop }[s.k]);
  const nb = homeBosses(Date.now()).find(x => x.st.s === 'wait');
  if (nb) parts.push(fmtT(t.nextBoss, { n: gameName(nb.b.name), t: calSpan(nb.st.left / 1000) }));
  const ev = SN.cal ? calGroups().now.find(e => e.kind !== 'maint') : null;
  if (ev) parts.push(fmtT(t.eventNow, { n: calName(ev) }));
  const text = parts.join(' · ');
  el.textContent = text ? text[0].toUpperCase() + text.slice(1) : HTX().sub;
}

// ---------- tiles ----------
function drawHomeTiles() {
  const grid = $('hmGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const tile of homeOrder()) grid.append(homeTile(tile));
}
function homeTile(tile) {
  const fine = matchMedia('(pointer: fine)').matches;
  const el = h('div', { class: `hm-tile t-${tile.id} ${tile.size}`, onclick: hmStop(() => tile.open()), draggable: fine ? 'true' : null },
    h('div', { class: 'hm-th' },
      h('span', { class: 'tool-ic' }, iconEl(tile.icon)),
      h('div', { class: 'hm-tt' }, h('b', null, tile.name()), tile.sub() ? h('small', null, tile.sub()) : null),
      homeBadge(tile.id) || h('span', { class: 'hm-go' }, '›')),
    h('div', { class: 'hm-body' }, HOME_BODY[tile.id]()));
  el.dataset.id = tile.id;
  if (fine) {
    el.addEventListener('dragstart', e => { HM.drag = tile.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tile.id); });
    el.addEventListener('dragend', () => { HM.drag = null; document.querySelectorAll('.hm-tile').forEach(x => x.classList.remove('dragging', 'drop')); });
    el.addEventListener('dragover', e => { if (!HM.drag || HM.drag === tile.id) return; e.preventDefault(); el.classList.add('drop'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      const from = HM.drag;
      if (!from || from === tile.id) return;
      const ids = homeOrder().map(x => x.id).filter(id => id !== from);
      ids.splice(ids.indexOf(tile.id), 0, from);
      store.set('homeOrder', ids);
      renderCenter();
    });
  }
  return el;
}
function homeBadge(id) {
  if (id !== 'news') return null;
  const seen = snSeen(), n = (SN.items || []).filter(it => it.at > seen).length;
  return n ? h('span', { class: 'hm-badge' }, fmtT(HTX().unread, { n: n > 9 ? '9+' : n })) : null;
}
// redraw the tiles whose data came in or moved on (the boss tile repaints itself every second)
function homeRefresh(ids = ['status', 'cal', 'news', 'stats', 'timer']) {
  if (tab !== 'home') return;
  for (const id of ids) {
    const old = document.querySelector('.hm-tile.t-' + id);
    if (old && !old.classList.contains('dragging')) old.replaceWith(homeTile(HOME_TILES.find(t => t.id === id)));
  }
  homeSummary();
}

const HOME_BODY = {
  calc() {
    const t = HTX(), cls = ctx.classes.get(ch.classId), r = lastResult || recalc();
    const stat = id => { const s = ctx.stats.get(id); return s && r.stats.has(id) ? h('div', { class: 'hm-stat' }, h('small', null, s.name), h('b', null, fmtStat(s, r.stats.get(id)))) : null; };
    const builds = store.get('builds', []).filter(b => b.name !== buildName).slice(0, 3);
    return [
      h('div', { class: 'hm-cap' }, t.cur),
      h('div', { class: 'hm-build' }, img(cls.imageId, 'hm-ava'),
        h('div', { class: 'hm-bt' }, h('b', null, buildName || `${cls.name} ${ch.level}`), h('small', null, `${cls.name} · ${T.level} ${ch.level}`))),
      h('div', { class: 'hm-stats' }, stat(75), stat(ctx.ids.HP), stat(ctx.ids.ATTACK)),
      builds.length ? [h('div', { class: 'hm-cap' }, t.saved), h('div', { class: 'hm-list' }, builds.map(b => {
        const c = ctx.classes.get(b.ch.classId);
        return h('button', { class: 'hm-li', onclick: hmStop(() => { loadBuild(b); switchTool('calc'); }) },
          img(c?.imageId, 'hm-li-ic'), h('span', null, b.name), h('small', null, `${c?.name || ''} · ${b.ch.level}`));
      }))] : null,
      h('div', { class: 'hm-cta' },
        h('button', { class: 'btn primary', onclick: hmStop(() => switchTool('calc')) }, t.openCalc)),
    ];
  },

  timer() {
    const t = HTX(), now = Date.now(), list = homeBosses(now);
    HM.boss = [];
    HM.bossSig = homeBossSig(list);
    if (!list.length) return [h('div', { class: 'hm-empty' }, t.noTimers), h('div', { class: 'hm-cta' }, h('button', { class: 'btn primary', onclick: hmStop(() => switchTool('timer')) }, t.allBosses))];
    const rows = list.slice(0, 5).map(({ b, st }) => {
      const big = h('span', { class: 'hm-bt-t' }), bar = h('i'), when = h('small');
      const row = h('div', { class: 'hm-boss' },
        h('div', { class: 'bt-pic' }, b.img ? h('img', { src: `../data/bosses/${b.img}`, alt: '', draggable: 'false' }) : null),
        h('div', { class: 'hm-bi' }, h('b', null, b.name), when, h('div', { class: 'hm-bar' }, bar)),
        big,
        h('button', { class: 'btn small hm-kill', title: T.bossKilledTip, onclick: hmStop(() => { askNotify(); setKill(b, Date.now()).then(() => homeRefresh(['timer'])); homeRefresh(['timer']); }) }, '☠'));
      const r = { b, s: st.s, cd: st.cd, row, big, bar, when };
      HM.boss.push(r);
      homePaintBoss(r, st, now);
      return row;
    });
    return [h('div', { class: 'hm-list' }, rows),
      h('div', { class: 'hm-cta' }, h('button', { class: 'btn', onclick: hmStop(() => switchTool('timer')) }, t.allBosses + (list.length > 5 ? ` (${list.length})` : '')))];
  },

  status() {
    const t = SVT(), s = serverState(), l = srvLast();
    return [
      h('div', { class: 'srv-state st-' + s.k }, h('span', { class: 'srv-dot' }), t[s.k]),
      l && l.online != null && s.k !== 'unknown' ? h('div', { class: 'hm-big' }, h('b', null, fmtNum(l.online)), h('small', null, t.online)) : null,
      s.k === 'unknown' && s.stale ? h('div', { class: 'hm-empty' }, t.stale) : null,
      serverChart(),
    ];
  },

  cal() {
    const t = CTX();
    if (!SN.cal) return h('div', { class: 'hm-empty' }, SN.err ? STX().fail : '…');
    const g = calGroups(), now = nowSec();
    const items = [...g.now.map(e => [e, 'now']), ...g.soon.map(e => [e, 'soon'])].slice(0, 3);
    if (!items.length) return h('div', { class: 'hm-empty' }, t.empty);
    return h('div', { class: 'hm-list' }, items.map(([e, where]) => {
      const end = calEnd(e);
      const count = where === 'soon' ? calFmt(t.in, calSpan(e.start - now)) : end != null ? calFmt(t.left, calSpan(end - now)) : t.running;
      return h('div', { class: `hm-ev ${where} k-${e.kind}` }, h('span', { class: 'hm-ev-ic' }, CAL_ICON[e.kind] || '📌'),
        h('div', null, h('b', null, calName(e)), h('small', null, (where === 'now' ? t.now : t.kinds[e.kind] || '') + ' · ' + count)));
    }));
  },

  news() {
    const items = SN.items || [];
    if (!items.length) return h('div', { class: 'hm-empty' }, SN.err ? STX().fail : SN.items ? STX().empty : '…');
    const seen = snSeen(), [first, ...rest] = items;
    const open = it => hmStop(() => { SN.sel = it.id; switchTool('steam'); });
    const x = snText(first);
    return [
      h('div', { class: 'hm-news', onclick: open(first) },
        first.img ? h('img', { class: 'hm-thumb', src: first.img, loading: 'lazy', draggable: 'false', alt: '', onerror: e => e.target.remove() }) : null,
        h('div', null, h('b', null, x.t), h('small', null, snDate(first.at), first.at > seen ? h('span', { class: 'sn-new' }, STX().fresh) : null))),
      h('div', { class: 'hm-list' }, rest.slice(0, 2).map(it => h('button', { class: 'hm-li', onclick: open(it) }, h('span', null, snText(it).t), h('small', null, snDate(it.at))))),
    ];
  },

  base() {
    const t = BTX(), cats = ['monster', 'loc', 'npc', 'quest', 'recipe', 'res', 'item', 'good', 'card'];
    const recent = [BS.sel, ...[...BS.back].reverse()].filter(Boolean).filter((x, i, a) => a.findIndex(y => y.kind === x.kind && y.key === x.key) === i).slice(0, 3);
    return [
      h('div', { class: 'hm-chips' }, cats.map(c => h('button', { class: 'bs-cat', onclick: hmStop(() => { BS.cat = c; BS.q = ''; BS.pane = 'list'; store.set('baseCat', c); switchTool('base'); }) }, t.cats[c]))),
      recent.length ? h('div', { class: 'hm-recent' }, h('small', null, HTX().lastOpened + ': '),
        recent.map((x, i) => [i ? ' · ' : '', h('button', { class: 'hm-link', onclick: hmStop(() => openBase(x.kind, x.key, { push: false })) }, x.key)])) : null,
    ];
  },

  guides() {
    const t = HTX(), G = window.RQ_GUIDES || { items: [] };
    if (!G.items.length) return null;
    const g = [...G.items].sort((a, b) => (b.upd || b.at || 0) - (a.upd || a.at || 0))[0], x = gdText(g);
    return [h('small', { class: 'hm-dim' }, fmtT(t.guides, { n: G.items.length }) + ' · ' + t.newest),
      h('div', { class: 'hm-guide', translate: 'no' }, x.t), h('small', { class: 'gd-stars' }, '★'.repeat(g.stars) + '☆'.repeat(5 - g.stars))];
  },

  stats() {
    const t = HTX(), st = STT();
    if (!IS_APP) return h('span', { class: 'hm-tag' }, t.webOnly);
    const s = (statsState.sessions || [])[0];
    return [
      statsState.on ? h('div', { class: 'srv-state st-ok' }, h('span', { class: 'srv-dot' }), t.overlayOn) : null,
      s ? [h('small', { class: 'hm-dim' }, t.lastSess), h('div', { class: 'hm-guide' }, s.name),
        h('small', { class: 'hm-dim' }, `${st.avgDps} ${statsNum(s.avgDps)} · ${st.gold} ${statsNum(s.gold)}`)]
        : h('div', { class: 'hm-empty' }, t.noSess),
    ];
  },

  trade() {
    return IS_APP ? null : h('span', { class: 'hm-tag' }, HTX().webOnly);
  },

  font() { return null; },
};

// ---------- boss countdowns ----------
// the timers that are running, the nearest respawn first
function homeBosses(now) {
  const list = BOSSES.map(b => ({ b, st: bossState(b, now) })).filter(x => x.st.s !== 'none');
  return list.sort((x, y) => (x.st.s === 'wait' ? 0 : 1) - (y.st.s === 'wait' ? 0 : 1) || (x.st.s === 'wait' ? x.st.spawn - y.st.spawn : y.st.spawn - x.st.spawn));
}
const homeBossSig = list => list.slice(0, 5).map(x => x.b.key + x.st.s + x.st.cd).join('|');
function homePaintBoss(r, st, now) {
  r.row.classList.toggle('soon', st.s === 'wait' && st.left < 5 * 60e3);
  r.row.classList.toggle('up', st.s === 'up');
  if (st.s === 'wait') {
    r.big.textContent = fmtLeft(st.left);
    r.when.textContent = `${b2meta(r.b)} · ${fmtT(T.bossAt, { t: clock(st.spawn) })}`;
    r.bar.style.width = (st.part * 100).toFixed(1) + '%';
  } else {
    r.big.textContent = T.bossUp;
    r.when.textContent = fmtT(T.bossUpSince, { t: clock(st.spawn), a: fmtAgo(now - st.spawn) });
    r.bar.style.width = '100%';
  }
}
const b2meta = b => (b.npc ? T.bossNpc : `${T.lvl} ${b.level}`) + (b.loc ? ' · ' + b.loc : '');
setInterval(() => {
  if (tab !== 'home' || document.hidden) return;
  const now = Date.now();
  if (homeBossSig(homeBosses(now)) !== HM.bossSig) { homeRefresh(['timer']); return; }
  for (const r of HM.boss) homePaintBoss(r, bossState(r.b, now), now);
}, 1000);
// the rest moves slower: every 20 seconds
setInterval(() => { if (tab === 'home' && !document.hidden && !document.querySelector('.hm-tile.dragging')) homeRefresh(['status', 'cal', 'news', 'stats']); }, 20000);
