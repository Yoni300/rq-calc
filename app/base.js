'use strict';
/* «База»: a reference of the game built from facts — monsters (data/base-monsters.js, from the wiki's monster templates:
   no article text), the calculator's items, cards and stamps, locations, and loot from the market catalog
   (data/market-items.js). Everything is linked: a monster's drops open the item, an item shows who drops it, a boss
   opens in the timer, loot opens on the market, an item can be put on in the calculator.
   Uses globals from app.js / market.js / bosses.js at call time (h, T, ctx, ch, IMG, store, itemTip, MI, …). */

const BASE_T = {
  uk: {
    title: 'База', sub: 'Монстри, предмети, карти, печатки, локації й видобуток — і хто що дропає',
    cats: { monster: 'Монстри', item: 'Спорядження', card: 'Карти', stamp: 'Печатки', loc: 'Локації', loot: 'Видобуток' },
    search: 'Пошук по всій базі…', empty: 'Нічого не знайдено', pick: 'Оберіть щось у списку ліворуч',
    back: 'Назад', more: 'Показано {n} з {all} — уточніть пошук',
    lvl: 'рів.', level: 'Рівень', hp: 'Життя', race: 'Раса', element: 'Стихія', defense: 'Захист', exp: 'Досвід', mode: 'Атака',
    aggro: 'Агресивний', yes: 'так', no: 'ні', event: 'Івент', group: 'Група', quest: 'Завдання', summoned: 'Призивається',
    boss: 'бос', elite: 'еліта', where: 'Де живе', resp: 'респаун', toTimer: 'У таймер',
    drops: { equip: 'Спорядження', cards: 'Карти', drop: 'Видобуток', cons: 'Розхідники', questDrop: 'Для завдань', recipes: 'Рецепти', summon: 'Призов' },
    droppedBy: 'Хто дропає', nobody: 'У вікі немає монстрів, з яких це падає',
    equip: 'Вдягнути в калькуляторі', equipped: 'Вдягнуто: {slot}', cantEquip: 'Не підходить поточному класу ({cls}) або рівню',
    slots: 'Куди ставиться', variants: 'Кольори печатки', monsters: 'Монстри', npc: 'Торговцю', market: 'Ціна на ринку',
    src: 'Факти з royalquest.info (вікі гри) і бази калькулятора', wiki: 'Сторінка у вікі',
  },
  ru: {
    title: 'База', sub: 'Монстры, предметы, карты, печати, локации и добыча — и кто что дропает',
    cats: { monster: 'Монстры', item: 'Снаряжение', card: 'Карты', stamp: 'Печати', loc: 'Локации', loot: 'Добыча' },
    search: 'Поиск по всей базе…', empty: 'Ничего не найдено', pick: 'Выберите что-нибудь в списке слева',
    back: 'Назад', more: 'Показано {n} из {all} — уточните поиск',
    lvl: 'ур.', level: 'Уровень', hp: 'Жизни', race: 'Раса', element: 'Стихия', defense: 'Защита', exp: 'Опыт', mode: 'Атака',
    aggro: 'Агрессивный', yes: 'да', no: 'нет', event: 'Ивент', group: 'Группа', quest: 'Задание', summoned: 'Призывается',
    boss: 'босс', elite: 'элита', where: 'Где живёт', resp: 'респаун', toTimer: 'В таймер',
    drops: { equip: 'Снаряжение', cards: 'Карты', drop: 'Добыча', cons: 'Расходники', questDrop: 'Для заданий', recipes: 'Рецепты', summon: 'Призыв' },
    droppedBy: 'Кто дропает', nobody: 'В вики нет монстров, с которых это падает',
    equip: 'Надеть в калькуляторе', equipped: 'Надето: {slot}', cantEquip: 'Не подходит текущему классу ({cls}) или уровню',
    slots: 'Куда ставится', variants: 'Цвета печати', monsters: 'Монстры', npc: 'Торговцу', market: 'Цена на рынке',
    src: 'Факты с royalquest.info (вики игры) и из базы калькулятора', wiki: 'Страница в вики',
  },
  en: {
    title: 'Database', sub: 'Monsters, items, cards, stamps, locations and loot — and who drops what',
    cats: { monster: 'Monsters', item: 'Gear', card: 'Cards', stamp: 'Stamps', loc: 'Locations', loot: 'Loot' },
    search: 'Search the whole database…', empty: 'Nothing found', pick: 'Pick something in the list on the left',
    back: 'Back', more: 'Showing {n} of {all} — narrow the search',
    lvl: 'lvl', level: 'Level', hp: 'Health', race: 'Race', element: 'Element', defense: 'Defence', exp: 'Experience', mode: 'Attack',
    aggro: 'Aggressive', yes: 'yes', no: 'no', event: 'Event', group: 'Group', quest: 'Quest', summoned: 'Summoned by',
    boss: 'boss', elite: 'elite', where: 'Lives in', resp: 'respawn', toTimer: 'To the timer',
    drops: { equip: 'Gear', cards: 'Cards', drop: 'Loot', cons: 'Consumables', questDrop: 'Quest items', recipes: 'Recipes', summon: 'Summons' },
    droppedBy: 'Dropped by', nobody: 'The wiki lists no monster that drops it',
    equip: 'Put on in the calculator', equipped: 'Put on: {slot}', cantEquip: 'Not for the current class ({cls}) or level',
    slots: 'Goes into', variants: 'Stamp colours', monsters: 'Monsters', npc: 'To a vendor', market: 'Market price',
    src: 'Facts from royalquest.info (the game wiki) and the calculator\'s database', wiki: 'Wiki page',
  },
};
const BTX = () => BASE_T[lang] || BASE_T.ru;
const bget2 = (k, def) => { try { const v = localStorage.getItem('rqc.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const BS = { cat: bget2('baseCat', 'monster'), q: '', sel: bget2('baseSel', null), back: [] };
const BCATS = ['monster', 'item', 'card', 'stamp', 'loc', 'loot'];

// ---------- the index (built on first use) ----------
const bnorm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
// "Ледяная коса к.вд2сл", "Брюки ловца 1 слот" → the item itself
const bstrip = s => String(s || '').replace(/\s+\d+\s+слот(а|ов)?\s*$/i, '').replace(/\s+к\.\s*\S+$/i, '').trim();
let BX = null;
function baseIndex() {
  if (BX) return BX;
  // ordinary monsters by level first; event, quest and summoned ones (mostly level 1, no location) at the end
  const special = m => !!m.event || /Ивент|Квест|Призыва/i.test(m.group || '') || !(m.locs || []).length;
  const monsters = (window.RQ_BASE_MONSTERS || []).slice().sort((a, b) => special(a) - special(b) || (a.level ?? 999) - (b.level ?? 999) || a.name.localeCompare(b.name, 'ru'));
  const items = [...ctx.equipment.values()].filter(i => i.inVersion !== false);
  const cards = [...ctx.cards.values()].filter(c => c.inVersion !== false && !c.isLegacy);
  const stamps = [...ctx.stamps.values()].filter(s => !s.isLegacy);
  const loot = (window.RQ_MARKET_ITEMS || []).filter(i => i.cat !== 'card');
  const byName = (list) => new Map(list.map(x => [bnorm(x.name), x]));
  const itemBy = byName(items), cardBy = byName(cards), lootBy = byName(window.RQ_MARKET_ITEMS || []), monBy = byName(monsters);
  // who drops what: name → monsters
  const dropsBy = new Map();
  const addDrop = (name, m) => { const k = bnorm(name); if (!dropsBy.has(k)) dropsBy.set(k, new Set()); dropsBy.get(k).add(m); };
  const locs = new Map();
  for (const m of monsters) {
    for (const x of m.equip || []) addDrop(bstrip(x), m);
    for (const k of ['cards', 'drop', 'cons', 'questDrop', 'recipes']) for (const x of m[k] || []) addDrop(x, m);
    for (const l of m.locs || []) { if (!locs.has(l.loc)) locs.set(l.loc, { name: l.loc, monsters: [] }); locs.get(l.loc).monsters.push({ m, resp: l.resp }); }
  }
  const locList = [...locs.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  for (const l of locList) {
    l.monsters.sort((a, b) => (a.m.level ?? 999) - (b.m.level ?? 999));
    const lv = l.monsters.map(x => x.m.level).filter(v => v != null);
    l.min = Math.min(...lv); l.max = Math.max(...lv);
  }
  BX = { monsters, items, cards, stamps, loot, locs: locList, locBy: new Map(locList.map(l => [l.name, l])), itemBy, cardBy, lootBy, monBy, dropsBy };
  return BX;
}
const whoDrops = name => [...(baseIndex().dropsBy.get(bnorm(name)) || [])].sort((a, b) => (a.level ?? 999) - (b.level ?? 999));

// one entry: { kind, key, name, icon, meta }
function entryOf(kind, x) {
  const t = BTX();
  if (kind === 'monster') return { kind, key: x.name, name: x.name, icon: x.img ? `../data/monsters/${x.img}` : null, round: true,
    meta: [x.level != null ? `${t.lvl} ${x.level}` : '', x.race, /босс/i.test(x.type || '') ? t.boss : /элит/i.test(x.type || '') ? t.elite : ''].filter(Boolean).join(' · ') };
  if (kind === 'item') return { kind, key: x.id, name: x.name, icon: IMG(x.imageId), meta: `${ctx.eqTypes.get(x.typeId)?.name || ''} · ${t.lvl} ${x.level}` };
  if (kind === 'card') return { kind, key: x.id, name: x.name, icon: IMG(x.imageId), meta: cardTypeLabel(x) };
  if (kind === 'stamp') return { kind, key: x.id, name: `${T.stampWord} ${x.name}`, icon: IMG(x.variants[x.variants.length - 1]?.color?.Image_Id), meta: x.variants.map(v => v.color?.Name).filter(Boolean).length + ' ' + BTX().variants.toLowerCase() };
  if (kind === 'loc') return { kind, key: x.name, name: x.name, icon: null, meta: `${x.monsters.length} · ${t.lvl} ${x.min === x.max ? x.min : `${x.min}–${x.max}`}` };
  if (kind === 'loot') return { kind, key: x.id, name: x.name, icon: MI_IMG(x.id), meta: x.type || '' };
  return null;
}
function entriesOf(kind) {
  const X = baseIndex();
  const src = { monster: X.monsters, item: X.items, card: X.cards, stamp: X.stamps, loc: X.locs, loot: X.loot }[kind] || [];
  return src.map(x => entryOf(kind, x));
}
function findEntry(kind, key) {
  const X = baseIndex();
  if (kind === 'monster') { const m = X.monBy.get(bnorm(key)); return m && { e: entryOf(kind, m), x: m }; }
  if (kind === 'item') { const i = ctx.equipment.get(key); return i && { e: entryOf(kind, i), x: i }; }
  if (kind === 'card') { const c = ctx.cards.get(key); return c && { e: entryOf(kind, c), x: c }; }
  if (kind === 'stamp') { const s = ctx.stamps.get(key); return s && { e: entryOf(kind, s), x: s }; }
  if (kind === 'loc') { const l = X.locBy.get(key); return l && { e: entryOf(kind, l), x: l }; }
  if (kind === 'loot') { const i = MI_BY.get(key); return i && { e: entryOf(kind, i), x: i }; }
  return null;
}
// a name from a monster's drop list → the entry it opens (an item, a card, loot), or null
function linkOfName(name) {
  const X = baseIndex(), k = bnorm(bstrip(name));
  const it = X.itemBy.get(k); if (it) return { kind: 'item', key: it.id };
  const c = X.cardBy.get(bnorm(name)); if (c) return { kind: 'card', key: c.id };
  const l = X.lootBy.get(bnorm(name)); if (l && l.cat !== 'card') return { kind: 'loot', key: l.id };
  return null;
}

// ---------- the view ----------
function openBase(kind, key, { push = true } = {}) {
  if (push && BS.sel && !(BS.sel.kind === kind && BS.sel.key === key)) BS.back.push(BS.sel);
  BS.sel = { kind, key };
  store.set('baseSel', BS.sel);
  if (tab !== 'base') { switchTool('base'); return; }
  drawBaseList();
  drawBaseDetail();
}

function renderBase(el) {
  const t = BTX();
  const search = h('input', { class: 'inp', placeholder: t.search, value: BS.q, spellcheck: false });
  search.addEventListener('input', () => { BS.q = search.value; drawBaseList(); });
  el.append(h('div', { class: 'bs-wrap' },
    h('div', { class: 'bs-side' },
      h('div', { class: 'bs-cats' }, BCATS.map(c => h('button', { class: 'bs-cat' + (BS.cat === c && !BS.q.trim() ? ' on' : ''), onclick: () => { BS.cat = c; BS.q = ''; store.set('baseCat', c); renderCenter(); } }, t.cats[c]))),
      search,
      h('div', { class: 'bs-list', id: 'baseList' })),
    h('div', { class: 'bs-detail', id: 'baseDetail' })));
  drawBaseList();
  drawBaseDetail();
  if (!BS.q) search.focus({ preventScroll: true });
}

function baseRow(e, showCat) {
  const on = BS.sel && BS.sel.kind === e.kind && BS.sel.key === e.key;
  return h('div', { class: 'bs-row' + (on ? ' on' : ''), onclick: () => openBase(e.kind, e.key, { push: false }) },
    e.icon ? h('img', { class: 'bs-ic' + (e.round ? ' round' : ''), src: e.icon, loading: 'lazy', draggable: 'false' }) : h('span', { class: 'bs-ic ph' }, iconEl(e.kind === 'loc' ? 'globe' : 'book')),
    h('div', { class: 'bs-name' }, e.name, h('small', null, (showCat ? BTX().cats[e.kind] + ' · ' : '') + (e.meta || ''))));
}

function drawBaseList() {
  const el = document.getElementById('baseList');
  if (!el) return;
  const t = BTX();
  el.innerHTML = '';
  const q = BS.q.trim();
  let list;
  if (q) list = BCATS.flatMap(c => entriesOf(c)).filter(e => matches(q, e.name));
  else list = entriesOf(BS.cat);
  if (!list.length) { el.append(h('div', { class: 'bs-empty' }, t.empty)); return; }
  const N = 300;
  for (const e of list.slice(0, N)) el.append(baseRow(e, !!q));
  if (list.length > N) el.append(h('div', { class: 'bs-empty' }, fmtT(t.more, { n: N, all: list.length })));
}

// small pieces of the detail
const bsec = (title, ...kids) => h('div', { class: 'bs-sec' }, h('h4', null, title), kids);
function bchip(name, link, icon) {
  const f = link && findEntry(link.kind, link.key);
  const ic = icon || (f && f.e.icon);
  return h(link ? 'button' : 'span', { class: 'bs-chip' + (link ? ' link' : ''), onclick: link ? () => openBase(link.kind, link.key) : null },
    ic ? h('img', { src: ic, loading: 'lazy', draggable: 'false', class: f && f.e.round ? 'round' : '' }) : null, name);
}
function monsterChips(list) {
  return h('div', { class: 'bs-chips' }, list.map(m => bchip(`${m.name}${m.level != null ? ` · ${BTX().lvl} ${m.level}` : ''}`, { kind: 'monster', key: m.name })));
}
function droppedBy(name) {
  const t = BTX(), who = whoDrops(name);
  return bsec(t.droppedBy, who.length ? monsterChips(who) : h('div', { class: 'hint' }, t.nobody));
}
const fmtMin = min => { const hh = Math.floor(min / 60), mm = min % 60; return (hh ? `${hh} ${T.hShort} ` : '') + (mm || !hh ? `${mm} ${T.mShort}` : ''); };
const wikiLink = title => h('a', { class: 'bs-wiki', href: `https://royalquest.info/ru/${encodeURIComponent(title.replace(/ /g, '_'))}`, target: '_blank', rel: 'noopener' }, BTX().wiki + ' ↗');

function drawBaseDetail() {
  const el = document.getElementById('baseDetail');
  if (!el) return;
  const t = BTX();
  el.innerHTML = '';
  const f = BS.sel && findEntry(BS.sel.kind, BS.sel.key);
  if (!f) { el.append(h('div', { class: 'bs-empty big' }, t.pick)); return; }
  const { e, x } = f;
  if (BS.back.length) el.append(h('button', { class: 'btn small ghost bs-back', onclick: () => { const p = BS.back.pop(); if (p) openBase(p.kind, p.key, { push: false }); } }, '← ' + t.back));
  const head = h('div', { class: 'bs-head' },
    e.icon ? h('img', { class: 'bs-big' + (e.round ? ' round' : ''), src: e.icon, draggable: 'false' }) : null,
    h('div', { class: 'bs-title' }, h('h2', null, e.name), h('div', { class: 'bs-meta' }, t.cats[e.kind] + (e.meta ? ' · ' + e.meta : ''))));
  el.append(head);

  if (e.kind === 'monster') {
    const facts = [[t.level, x.level], [t.hp, x.hp != null ? fmtNum(x.hp) : null], [t.race, x.race], [t.element, x.element], [t.defense, x.defense],
      [t.exp, x.exp != null ? fmtNum(x.exp) : null], [t.mode, x.mode], [t.aggro, x.aggro ? t.yes : t.no], [t.event, x.event], [t.group, x.group], [t.quest, x.quest], [t.summoned, x.summoned]]
      .filter(([, v]) => v != null && v !== '');
    el.append(h('div', { class: 'bs-facts' }, facts.map(([k, v]) => h('div', null, h('span', null, k), h('b', null, String(v))))));
    if ((x.locs || []).length) {
      el.append(bsec(t.where, h('div', { class: 'bs-chips' }, x.locs.map(l => h('span', { class: 'bs-loc' },
        bchip(l.loc, { kind: 'loc', key: l.loc }),
        l.resp ? h('small', null, `${t.resp} ${fmtMin(l.resp)}`) : null)))));
      const boss = typeof BOSSES !== 'undefined' && BOSSES.find(b => b.name === x.name);
      if (boss) el.append(h('button', { class: 'btn small bs-act', onclick: () => { BT.q = x.name; switchTool('timer'); } }, iconEl('skull'), t.toTimer));
    }
    for (const k of ['equip', 'cards', 'drop', 'cons', 'questDrop', 'recipes', 'summon']) {
      const list = x[k] || [];
      if (!list.length) continue;
      el.append(bsec(t.drops[k], h('div', { class: 'bs-chips' }, list.map(n => bchip(n, k === 'summon' ? null : linkOfName(n))))));
    }
    el.append(h('div', { class: 'bs-foot' }, wikiLink('Монстр ' + x.name)));
  } else if (e.kind === 'item') {
    const tip = h('div', { class: 'bs-tip' });
    tip.innerHTML = itemTip(x, null);
    el.append(tip);
    const sets = allowedSets(ch);
    const keys = [...sets.keys()].filter(k => sets.get(k).has(x.id));
    const key = keys.find(k => !ch.equipment[k]) || keys[0];
    const cls = ctx.classes.get(ch.classId);
    el.append(key
      ? h('button', { class: 'btn primary small bs-act', onclick: () => {
        changed(c => {
          const n = ctx.cardCount(x);
          const en = { itemId: x.id, upgrade: 0, cards: Array.from({ length: n }, () => null) };
          if (x.primaryCardId) en.cards[0] = x.primaryCardId;
          c.equipment[key] = en;
          if (slotLockedByTwoHander(c, ctx.reverseKey(key) || '')) delete c.equipment[ctx.reverseKey(key)];
        }, { center: false });
        toast(fmtT(t.equipped, { slot: ctx.slots.get(+key.split(':')[0])?.name || '' }));
      } }, iconEl('calc'), t.equip)
      : h('div', { class: 'hint' }, fmtT(t.cantEquip, { cls: cls?.name || '' })));
    el.append(droppedBy(x.name));
  } else if (e.kind === 'card') {
    const lines = x.bonuses.map(cb => bonusText({ typeId: cb.typeId, vars: cardBonusVarsForDisplay(cb) }));
    el.append(h('div', { class: 'bs-bonuses' }, lines.map(s => h('div', null, s))));
    const where = [...(x.slotIds || []).map(id => ctx.slots.get(id)?.name), ...(x.typeIds || []).map(id => ctx.eqTypes.get(id)?.name)].filter(Boolean);
    if (where.length) el.append(bsec(t.slots, h('div', { class: 'bs-chips' }, where.map(w => h('span', { class: 'bs-chip' }, w)))));
    const mi = baseIndex().lootBy.get(bnorm(x.name));
    if (mi) el.append(h('button', { class: 'btn small bs-act', onclick: () => { MK.sel = mi.id; store.set('marketSel', mi.id); switchTool('market'); } }, iconEl('coins'), t.market));
    el.append(droppedBy(x.name));
  } else if (e.kind === 'stamp') {
    el.append(bsec(t.variants, h('div', { class: 'bs-variants' }, x.variants.map(v => h('div', { class: 'bs-var' },
      h('i', { style: `background:${v.color?.Argb || '#888'}` }),
      h('div', null, v.bonuses.map(b => h('div', null, bonusText({ typeId: b.typeId, vars: [b.value] })))))))));
  } else if (e.kind === 'loc') {
    el.append(bsec(t.monsters, h('div', { class: 'bs-mlist' }, x.monsters.map(({ m, resp }) => baseRow(Object.assign(entryOf('monster', m), resp ? { meta: entryOf('monster', m).meta + ` · ${t.resp} ${fmtMin(resp)}` } : {}), false)))));
    el.querySelectorAll('.bs-mlist .bs-row').forEach((r, i) => { r.onclick = () => openBase('monster', x.monsters[i].m.name); });
  } else if (e.kind === 'loot') {
    const facts = [[t.npc, x.npc != null ? fmtNum(x.npc) : null], [t.event, x.event]].filter(([, v]) => v);
    if (facts.length) el.append(h('div', { class: 'bs-facts' }, facts.map(([k, v]) => h('div', null, h('span', null, k), h('b', null, String(v))))));
    el.append(h('button', { class: 'btn small bs-act', onclick: () => { MK.sel = x.id; store.set('marketSel', x.id); switchTool('market'); } }, iconEl('coins'), t.market));
    el.append(droppedBy(x.name));
  }
  el.append(h('div', { class: 'note bs-src' }, t.src));
  el.scrollTop = 0;
}
