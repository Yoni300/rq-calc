'use strict';
/* «База»: a reference of the game built from facts only.
   - monsters: data/base-monsters.js (tools/update-base-wiki.mjs, the wiki's monster templates);
   - the world: data/base-world.js (tools/update-world-wiki.mjs) — locations with their map and markers, NPCs, quests,
     recipes, gathering points / ore veins / fishing spots;
   - the calculator's items, cards and stamps; loot from the market catalog (data/market-items.js).
   No article text, quest descriptions or dialogues are copied. Everything is linked: for any name the base knows where
   it comes from (monsters, gathering, vendors, quest rewards, recipes) and what it is needed for (recipes, quests).
   Uses globals from app.js / market.js / bosses.js at call time (h, T, ctx, ch, IMG, store, itemTip, MI, …). */

const BASE_T = {
  uk: {
    title: 'База', sub: 'Монстри, локації з картами, НПС, завдання, рецепти, ресурси, предмети — і де що взяти',
    cats: { monster: 'Монстри', loc: 'Локації', npc: 'НПС', quest: 'Завдання', recipe: 'Рецепти', res: 'Збір і рибалка', item: 'Спорядження', card: 'Карти', stamp: 'Печатки', loot: 'Видобуток', thing: 'Предмет' },
    search: 'Пошук по всій базі…', empty: 'Нічого не знайдено', pick: 'Оберіть щось у списку ліворуч', back: 'Назад', more: 'Показано {n} з {all} — уточніть пошук',
    lvl: 'рів.', level: 'Рівень', hp: 'Життя', race: 'Раса', element: 'Стихія', defense: 'Захист', exp: 'Досвід', mode: 'Атака',
    aggro: 'Агресивний', yes: 'так', no: 'ні', event: 'Івент', group: 'Група', quest: 'Завдання', summoned: 'Призивається', type: 'Тип',
    boss: 'бос', elite: 'еліта', where: 'Де живе', resp: 'респаун', toTimer: 'У таймер',
    drops: { equip: 'Спорядження', cards: 'Карти', drop: 'Видобуток', cons: 'Розхідники', questDrop: 'Для завдань', recipes: 'Рецепти', summon: 'Призов' },
    src: { drop: 'Хто дропає', node: 'Збір', shop: 'Продають', quest: 'Нагорода за завдання', craft: 'Створюється за рецептом' },
    use: { recipe: 'Потрібно для рецептів', quest: 'Потрібно для завдань' },
    whereGet: 'Де взяти', usedFor: 'Де потрібно', nobody: 'У вікі немає, звідки це береться',
    equip: 'Вдягнути в калькуляторі', equipped: 'Вдягнуто: {slot}', cantEquip: 'Не підходить поточному класу ({cls}) або рівню',
    slots: 'Куди ставиться', variants: 'Кольори печатки', monsters: 'Монстри', npc: 'Торговцю', market: 'Ціна на ринку',
    map: 'Карта', npcsHere: 'НПС', exits: 'Переходи', resHere: 'Ресурси', locType: 'Тип локації', levels: 'Рівні',
    gives: 'Дає завдання', takes: 'Приймає завдання', shop: 'Продає', price: 'Ціна', standsIn: 'Де стоїть',
    from: 'Видає', to: 'Здати', chain: 'Ланцюжок', prev: 'Перед цим', next: 'Далі', cls: 'Клас',
    task: 'Що зробити', kill: 'Убити', need: 'Принести', useIt: 'Використати', bring: 'Віднести', reward: 'Нагорода', choice: 'На вибір', gold: 'Золото',
    result: 'Результат', chance: 'Шанс', ingredients: 'Ресурси', recipeFrom: 'Де взяти рецепт',
    nodeKind: { gather: 'Точка збору', ore: 'Рудне родовище', fish: 'Рибне місце' }, bait: 'Наживка', yields: 'Що дає', locsOf: 'Де є',
    marks: { npc: 'НПС', shop: 'Торговець', exit: 'Перехід', fish: 'Рибалка', craft: 'Майстерня', post: 'Пошта', infanta: 'Інфанта' },
    questsN: 'завдань: {n}', sellsN: 'товарів: {n}', andMore: '…і ще {n}',
    src2: 'Факти з royalquest.info (вікі гри) і бази калькулятора — без описів і діалогів', wiki: 'Сторінка у вікі',
  },
  ru: {
    title: 'База', sub: 'Монстры, локации с картами, НПС, задания, рецепты, ресурсы, предметы — и где что взять',
    cats: { monster: 'Монстры', loc: 'Локации', npc: 'НПС', quest: 'Задания', recipe: 'Рецепты', res: 'Сбор и рыбалка', item: 'Снаряжение', card: 'Карты', stamp: 'Печати', loot: 'Добыча', thing: 'Предмет' },
    search: 'Поиск по всей базе…', empty: 'Ничего не найдено', pick: 'Выберите что-нибудь в списке слева', back: 'Назад', more: 'Показано {n} из {all} — уточните поиск',
    lvl: 'ур.', level: 'Уровень', hp: 'Жизни', race: 'Раса', element: 'Стихия', defense: 'Защита', exp: 'Опыт', mode: 'Атака',
    aggro: 'Агрессивный', yes: 'да', no: 'нет', event: 'Ивент', group: 'Группа', quest: 'Задание', summoned: 'Призывается', type: 'Тип',
    boss: 'босс', elite: 'элита', where: 'Где живёт', resp: 'респаун', toTimer: 'В таймер',
    drops: { equip: 'Снаряжение', cards: 'Карты', drop: 'Добыча', cons: 'Расходники', questDrop: 'Для заданий', recipes: 'Рецепты', summon: 'Призыв' },
    src: { drop: 'Кто дропает', node: 'Сбор', shop: 'Продают', quest: 'Награда за задание', craft: 'Создаётся по рецепту' },
    use: { recipe: 'Нужно для рецептов', quest: 'Нужно для заданий' },
    whereGet: 'Где взять', usedFor: 'Где нужно', nobody: 'В вики нет, откуда это берётся',
    equip: 'Надеть в калькуляторе', equipped: 'Надето: {slot}', cantEquip: 'Не подходит текущему классу ({cls}) или уровню',
    slots: 'Куда ставится', variants: 'Цвета печати', monsters: 'Монстры', npc: 'Торговцу', market: 'Цена на рынке',
    map: 'Карта', npcsHere: 'НПС', exits: 'Переходы', resHere: 'Ресурсы', locType: 'Тип локации', levels: 'Уровни',
    gives: 'Даёт задания', takes: 'Принимает задания', shop: 'Продаёт', price: 'Цена', standsIn: 'Где стоит',
    from: 'Выдаёт', to: 'Сдать', chain: 'Цепочка', prev: 'Перед этим', next: 'Дальше', cls: 'Класс',
    task: 'Что сделать', kill: 'Убить', need: 'Принести', useIt: 'Использовать', bring: 'Отнести', reward: 'Награда', choice: 'На выбор', gold: 'Золото',
    result: 'Результат', chance: 'Шанс', ingredients: 'Ресурсы', recipeFrom: 'Где взять рецепт',
    nodeKind: { gather: 'Точка сбора', ore: 'Рудное месторождение', fish: 'Рыбное место' }, bait: 'Наживка', yields: 'Что даёт', locsOf: 'Где есть',
    marks: { npc: 'НПС', shop: 'Торговец', exit: 'Переход', fish: 'Рыбалка', craft: 'Мастерская', post: 'Почта', infanta: 'Инфанта' },
    questsN: 'заданий: {n}', sellsN: 'товаров: {n}', andMore: '…и ещё {n}',
    src2: 'Факты с royalquest.info (вики игры) и из базы калькулятора — без описаний и диалогов', wiki: 'Страница в вики',
  },
  en: {
    title: 'Database', sub: 'Monsters, locations with maps, NPCs, quests, recipes, resources, items — and where to get what',
    cats: { monster: 'Monsters', loc: 'Locations', npc: 'NPCs', quest: 'Quests', recipe: 'Recipes', res: 'Gathering & fishing', item: 'Gear', card: 'Cards', stamp: 'Stamps', loot: 'Loot', thing: 'Item' },
    search: 'Search the whole database…', empty: 'Nothing found', pick: 'Pick something in the list on the left', back: 'Back', more: 'Showing {n} of {all} — narrow the search',
    lvl: 'lvl', level: 'Level', hp: 'Health', race: 'Race', element: 'Element', defense: 'Defence', exp: 'Experience', mode: 'Attack',
    aggro: 'Aggressive', yes: 'yes', no: 'no', event: 'Event', group: 'Group', quest: 'Quest', summoned: 'Summoned by', type: 'Type',
    boss: 'boss', elite: 'elite', where: 'Lives in', resp: 'respawn', toTimer: 'To the timer',
    drops: { equip: 'Gear', cards: 'Cards', drop: 'Loot', cons: 'Consumables', questDrop: 'Quest items', recipes: 'Recipes', summon: 'Summons' },
    src: { drop: 'Dropped by', node: 'Gathering', shop: 'Sold by', quest: 'Quest reward', craft: 'Crafted by recipe' },
    use: { recipe: 'Used in recipes', quest: 'Needed for quests' },
    whereGet: 'Where to get', usedFor: 'Used for', nobody: 'The wiki does not say where it comes from',
    equip: 'Put on in the calculator', equipped: 'Put on: {slot}', cantEquip: 'Not for the current class ({cls}) or level',
    slots: 'Goes into', variants: 'Stamp colours', monsters: 'Monsters', npc: 'To a vendor', market: 'Market price',
    map: 'Map', npcsHere: 'NPCs', exits: 'Exits', resHere: 'Resources', locType: 'Location type', levels: 'Levels',
    gives: 'Gives quests', takes: 'Takes quests', shop: 'Sells', price: 'Price', standsIn: 'Stands in',
    from: 'Given by', to: 'Turn in to', chain: 'Chain', prev: 'Before', next: 'Next', cls: 'Class',
    task: 'To do', kill: 'Kill', need: 'Bring', useIt: 'Use', bring: 'Deliver to', reward: 'Reward', choice: 'Choice of', gold: 'Gold',
    result: 'Result', chance: 'Chance', ingredients: 'Resources', recipeFrom: 'Where to get the recipe',
    nodeKind: { gather: 'Gathering point', ore: 'Ore vein', fish: 'Fishing spot' }, bait: 'Bait', yields: 'Yields', locsOf: 'Found in',
    marks: { npc: 'NPC', shop: 'Vendor', exit: 'Exit', fish: 'Fishing', craft: 'Workshop', post: 'Post', infanta: 'Infanta' },
    questsN: 'quests: {n}', sellsN: 'goods: {n}', andMore: '…and {n} more',
    src2: 'Facts from royalquest.info (the game wiki) and the calculator\'s database — no descriptions or dialogues', wiki: 'Wiki page',
  },
};
const BTX = () => BASE_T[lang] || BASE_T.ru;
const bget2 = (k, def) => { try { const v = localStorage.getItem('rqc.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const BS = { cat: bget2('baseCat', 'monster'), q: '', sel: bget2('baseSel', null), back: [] };
const BCATS = ['monster', 'loc', 'npc', 'quest', 'recipe', 'res', 'item', 'card', 'stamp', 'loot'];

// ---------- the index (built on first use) ----------
const bnorm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
// "Ледяная коса к.вд2сл", "Брюки ловца 1 слот" → the item itself
const bstrip = s => String(s || '').replace(/\s+\d+\s+слот(а|ов)?\s*$/i, '').replace(/\s+к\.\s*\S+$/i, '').trim();
let BX = null;
function baseIndex() {
  if (BX) return BX;
  const W = window.RQ_BASE_WORLD || { locs: [], npcs: [], quests: [], recipes: [], nodes: [] };
  const special = m => !!m.event || /Ивент|Квест|Призыва/i.test(m.group || '') || !(m.locs || []).length;
  const monsters = (window.RQ_BASE_MONSTERS || []).slice().sort((a, b) => special(a) - special(b) || (a.level ?? 999) - (b.level ?? 999) || a.name.localeCompare(b.name, 'ru'));
  const items = [...ctx.equipment.values()].filter(i => i.inVersion !== false);
  const cards = [...ctx.cards.values()].filter(c => c.inVersion !== false && !c.isLegacy);
  const stamps = [...ctx.stamps.values()].filter(s => !s.isLegacy);
  const loot = (window.RQ_MARKET_ITEMS || []).filter(i => i.cat !== 'card');
  const byName = list => new Map(list.map(x => [bnorm(x.name), x]));
  const X = { W, monsters, items, cards, stamps, loot, npcs: W.npcs, recipes: W.recipes,
    // quests: the story ones by level first, event and level-1 ones at the end
    quests: W.quests.slice().sort((a, b) => (!!a.event || (a.level ?? 0) <= 1) - (!!b.event || (b.level ?? 0) <= 1) || (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name, 'ru')), nodes: W.nodes,
    itemBy: byName(items), cardBy: byName(cards), lootBy: byName(window.RQ_MARKET_ITEMS || []), monBy: byName(monsters),
    npcBy: byName(W.npcs), questBy: byName(W.quests), recipeBy: byName(W.recipes), nodeBy: byName(W.nodes) };

  // locations: the wiki's (map, markers) together with the ones the monsters name
  const locs = new Map();
  const loc = name => { if (!locs.has(name)) locs.set(name, { name, monsters: [], npcs: [], nodes: [] }); return locs.get(name); };
  for (const l of W.locs) Object.assign(loc(l.name), l);
  for (const m of monsters) for (const l of m.locs || []) loc(l.loc).monsters.push({ m, resp: l.resp });
  for (const n of W.npcs) for (const l of n.locs || []) loc(l).npcs.push(n);
  for (const n of W.nodes) for (const l of n.locs || []) loc(l).nodes.push(n);
  X.locs = [...locs.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  for (const l of X.locs) {
    l.monsters.sort((a, b) => (a.m.level ?? 999) - (b.m.level ?? 999));
    const lv = l.monsters.map(x => x.m.level).filter(v => v != null && v > 1);
    if (lv.length) { l.min = Math.min(...lv); l.max = Math.max(...lv); }
  }
  X.locBy = new Map(X.locs.map(l => [l.name, l]));

  // where every name comes from, and what it is needed for
  const src = new Map(), use = new Map();
  const put = (map, name, kind, v) => { const k = bnorm(name); if (!k) return; if (!map.has(k)) map.set(k, {}); const o = map.get(k); (o[kind] ||= []).includes(v) || o[kind].push(v); };
  for (const m of monsters) {
    for (const x of m.equip || []) put(src, bstrip(x), 'drop', m);
    for (const k of ['cards', 'drop', 'cons', 'questDrop', 'recipes']) for (const x of m[k] || []) put(src, x, 'drop', m);
  }
  for (const n of W.nodes) for (const d of n.drops || []) put(src, d.n, 'node', n);
  for (const n of W.npcs) for (const s of n.shop || []) put(src, s.n, 'shop', { npc: n, price: s.p });
  for (const q of W.quests) {
    for (const r of [...(q.reward || []), ...(q.choice || [])]) put(src, r.n, 'quest', q);
    for (const r of [...(q.need || []), ...(q.use || [])]) put(use, r.n, 'quest', q);
  }
  for (const r of W.recipes) {
    if (r.result) put(src, bstrip(r.result), 'craft', r);
    for (const x of r.res || []) put(use, x.n, 'recipe', r);
  }
  X.src = src; X.use = use;
  X.questsFrom = new Map(); X.questsTo = new Map(); X.questsAfter = new Map();
  const add = (map, k, v) => { if (!k) return; if (!map.has(k)) map.set(k, []); map.get(k).push(v); };
  for (const q of W.quests) { add(X.questsFrom, q.from, q); if (q.to && q.to !== q.from) add(X.questsTo, q.to, q); for (const p of q.prev || []) add(X.questsAfter, bnorm(p), q); }
  BX = X;
  return X;
}
const sourcesOf = name => baseIndex().src.get(bnorm(bstrip(name))) || baseIndex().src.get(bnorm(name)) || {};
const usesOf = name => baseIndex().use.get(bnorm(name)) || {};

// ---------- entries: { kind, key, name, icon, round, meta } ----------
const ph = kind => ({ loc: 'globe', npc: 'group', quest: 'book', recipe: 'calc', res: 'globe' }[kind] || 'book');
function iconOfName(name) {
  const X = baseIndex(), k = bnorm(bstrip(name));
  const it = X.itemBy.get(k); if (it) return IMG(it.imageId);
  const c = X.cardBy.get(bnorm(name)); if (c) return IMG(c.imageId);
  const l = X.lootBy.get(bnorm(name)); if (l) return MI_IMG(l.id);
  return null;
}
function entryOf(kind, x) {
  const t = BTX();
  switch (kind) {
    case 'monster': return { kind, key: x.name, name: x.name, icon: x.img ? `../data/monsters/${x.img}` : null, round: true,
      meta: [x.level != null ? `${t.lvl} ${x.level}` : '', x.race, /босс/i.test(x.type || '') ? t.boss : /элит/i.test(x.type || '') ? t.elite : ''].filter(Boolean).join(' · ') };
    case 'item': return { kind, key: x.id, name: x.name, icon: IMG(x.imageId), meta: `${ctx.eqTypes.get(x.typeId)?.name || ''} · ${t.lvl} ${x.level}` };
    case 'card': return { kind, key: x.id, name: x.name, icon: IMG(x.imageId), meta: cardTypeLabel(x) };
    case 'stamp': return { kind, key: x.id, name: `${T.stampWord} ${x.name}`, icon: IMG(x.variants[x.variants.length - 1]?.color?.Image_Id), meta: `${x.variants.length} · ${t.variants.toLowerCase()}` };
    case 'loc': return { kind, key: x.name, name: x.name, icon: null, meta: [(x.type || [])[0], x.min != null ? `${t.lvl} ${x.min === x.max ? x.min : `${x.min}–${x.max}`}` : ''].filter(Boolean).join(' · ') };
    case 'loot': return { kind, key: x.id, name: x.name, icon: MI_IMG(x.id), meta: x.type || '' };
    case 'npc': return { kind, key: x.name, name: x.name, icon: x.img ? `../data/npcs/${x.img}` : null, round: true,
      meta: [(x.locs || [])[0], (baseIndex().questsFrom.get(x.name) || []).length ? fmtT(t.questsN, { n: baseIndex().questsFrom.get(x.name).length }) : '', (x.shop || []).length ? fmtT(t.sellsN, { n: x.shop.length }) : ''].filter(Boolean).join(' · ') };
    case 'quest': return { kind, key: x.name, name: x.name, icon: null, meta: [x.level != null ? `${t.lvl} ${x.level}` : '', x.from, x.type].filter(Boolean).join(' · ') };
    case 'recipe': return { kind, key: x.name, name: x.name.replace(/^Рецепт:\s*/, ''), icon: iconOfName(x.result), meta: [`${t.chance} ${x.chance ?? '?'}%`, `${(x.res || []).length} ${t.ingredients.toLowerCase()}`].join(' · ') };
    case 'res': return { kind, key: x.name, name: x.name, icon: null, meta: [t.nodeKind[x.kind], (x.locs || []).length ? `${t.locsOf.toLowerCase()}: ${x.locs.length}` : ''].filter(Boolean).join(' · ') };
    case 'thing': return { kind, key: x, name: x, icon: iconOfName(x), meta: '' };
  }
  return null;
}
const entryCache = new Map();
function entriesOf(kind) {
  const ck = kind + ':' + lang;
  if (entryCache.has(ck)) return entryCache.get(ck);
  const X = baseIndex();
  const src = { monster: X.monsters, item: X.items, card: X.cards, stamp: X.stamps, loc: X.locs, loot: X.loot, npc: X.npcs, quest: X.quests, recipe: X.recipes, res: X.nodes }[kind] || [];
  const list = src.map(x => entryOf(kind, x));
  entryCache.set(ck, list);
  return list;
}
function findEntry(kind, key) {
  const X = baseIndex();
  const pick = (x) => x && { e: entryOf(kind, x), x };
  switch (kind) {
    case 'monster': return pick(X.monBy.get(bnorm(key)));
    case 'item': return pick(ctx.equipment.get(key));
    case 'card': return pick(ctx.cards.get(key));
    case 'stamp': return pick(ctx.stamps.get(key));
    case 'loc': return pick(X.locBy.get(key));
    case 'loot': return pick(MI_BY.get(key));
    case 'npc': return pick(X.npcBy.get(bnorm(key)));
    case 'quest': return pick(X.questBy.get(bnorm(key)));
    case 'recipe': return pick(X.recipeBy.get(bnorm(key)));
    case 'res': return pick(X.nodeBy.get(bnorm(key)));
    case 'thing': return { e: entryOf('thing', key), x: key };
  }
  return null;
}
// any name → the entry it opens, or null (an item, a card, loot, a recipe, an NPC, a monster, a location, or a «thing»
// the base knows sources or uses of)
function linkOfName(name) {
  const X = baseIndex(), k = bnorm(bstrip(name)), n = bnorm(name);
  const it = X.itemBy.get(k); if (it) return { kind: 'item', key: it.id };
  const c = X.cardBy.get(n); if (c) return { kind: 'card', key: c.id };
  if (X.recipeBy.has(n)) return { kind: 'recipe', key: X.recipeBy.get(n).name };
  const l = X.lootBy.get(n); if (l && l.cat !== 'card') return { kind: 'loot', key: l.id };
  if (X.npcBy.has(n)) return { kind: 'npc', key: X.npcBy.get(n).name };
  if (X.monBy.has(n)) return { kind: 'monster', key: X.monBy.get(n).name };
  if (X.locBy.has(name)) return { kind: 'loc', key: name };
  if (X.nodeBy.has(n)) return { kind: 'res', key: X.nodeBy.get(n).name };
  if (X.src.has(k) || X.src.has(n) || X.use.has(n)) return { kind: 'thing', key: name };
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

function baseRow(e, showCat, onclick) {
  const on = BS.sel && BS.sel.kind === e.kind && BS.sel.key === e.key;
  return h('div', { class: 'bs-row' + (on ? ' on' : ''), onclick: onclick || (() => openBase(e.kind, e.key, { push: false })) },
    e.icon ? h('img', { class: 'bs-ic' + (e.round ? ' round' : ''), src: e.icon, loading: 'lazy', draggable: 'false' }) : h('span', { class: 'bs-ic ph' }, iconEl(ph(e.kind))),
    h('div', { class: 'bs-name' }, e.name, h('small', null, (showCat ? BTX().cats[e.kind] + ' · ' : '') + (e.meta || ''))));
}

function drawBaseList() {
  const el = document.getElementById('baseList');
  if (!el) return;
  const t = BTX();
  el.innerHTML = '';
  const q = BS.q.trim();
  const list = q ? BCATS.flatMap(c => entriesOf(c)).filter(e => matches(q, e.name)) : entriesOf(BS.cat);
  if (!list.length) { el.append(h('div', { class: 'bs-empty' }, t.empty)); return; }
  const N = 300;
  for (const e of list.slice(0, N)) el.append(baseRow(e, !!q));
  if (list.length > N) el.append(h('div', { class: 'bs-empty' }, fmtT(t.more, { n: N, all: list.length })));
}

// ---------- pieces of a page ----------
const bsec = (title, ...kids) => h('div', { class: 'bs-sec' }, h('h4', null, title), kids);
const bfacts = rows => h('div', { class: 'bs-facts' }, rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => h('div', null, h('span', null, k), h('b', null, v instanceof Node ? v : String(v)))));
function bchip(name, link, { count, extra, icon } = {}) {
  if (link === undefined) link = linkOfName(name);
  const f = link && findEntry(link.kind, link.key);
  const ic = icon || (f && f.e.icon);
  return h(link ? 'button' : 'span', { class: 'bs-chip' + (link ? ' link' : ''), onclick: link ? () => openBase(link.kind, link.key) : null },
    ic ? h('img', { src: ic, loading: 'lazy', draggable: 'false', class: f && f.e.round ? 'round' : '' }) : null,
    name, count && count > 1 ? h('b', { class: 'bs-n' }, '×' + fmtNum(count)) : null, extra ? h('small', null, extra) : null);
}
const chips = (list, fn) => h('div', { class: 'bs-chips' }, list.map(fn));
const mchip = m => bchip(`${m.name}${m.level != null ? ` · ${BTX().lvl} ${m.level}` : ''}`, { kind: 'monster', key: m.name });
const qchip = q => bchip(`${q.name}${q.level != null ? ` · ${BTX().lvl} ${q.level}` : ''}`, { kind: 'quest', key: q.name });
const fmtMin = min => { const hh = Math.floor(min / 60), mm = min % 60; return (hh ? `${hh} ${T.hShort} ` : '') + (mm || !hh ? `${mm} ${T.mShort}` : ''); };
const wikiLink = title => h('a', { class: 'bs-wiki', href: `https://royalquest.info/ru/${encodeURIComponent(title.replace(/ /g, '_'))}`, target: '_blank', rel: 'noopener' }, BTX().wiki + ' ↗');

/** «Где взять» and «Где нужно» for any name. */
function whereBlocks(name) {
  const t = BTX(), s = sourcesOf(name), u = usesOf(name);
  const out = [];
  const parts = [];
  if (s.drop) parts.push(bsec(t.src.drop, chips(s.drop.slice().sort((a, b) => (a.level ?? 999) - (b.level ?? 999)), mchip)));
  if (s.node) parts.push(bsec(t.src.node, chips(s.node, n => bchip(n.name, { kind: 'res', key: n.name }, { extra: t.nodeKind[n.kind] }))));
  if (s.shop) parts.push(bsec(t.src.shop, chips(s.shop, x => bchip(x.npc.name, { kind: 'npc', key: x.npc.name }, { extra: priceEl(x.price) }))));
  if (s.quest) parts.push(bsec(t.src.quest, chips(s.quest, qchip)));
  if (s.craft) parts.push(bsec(t.src.craft, chips(s.craft, r => bchip(r.name.replace(/^Рецепт:\s*/, ''), { kind: 'recipe', key: r.name }, { extra: `${r.chance ?? '?'}%` }))));
  out.push(h('div', { class: 'bs-group' }, h('h3', null, t.whereGet), parts.length ? parts : h('div', { class: 'hint' }, t.nobody)));
  const uses = [];
  if (u.recipe) uses.push(bsec(t.use.recipe, chips(u.recipe, r => bchip(r.name.replace(/^Рецепт:\s*/, ''), { kind: 'recipe', key: r.name }, { count: (r.res.find(x => bnorm(x.n) === bnorm(name)) || {}).c }))));
  if (u.quest) uses.push(bsec(t.use.quest, chips(u.quest, qchip)));
  if (uses.length) out.push(h('div', { class: 'bs-group' }, h('h3', null, t.usedFor), uses));
  return out;
}

// the location map: the wiki's frame is 800 × 640, the map image sits in it at its own size and offset
const MARK_KIND = { 'НПС': 'npc', 'Лорд': 'npc', 'Инфанта': 'infanta', 'Продавец': 'shop', 'Рынок': 'shop', 'ТорговецРыбой': 'shop', 'Почта': 'post',
  'Локация': 'exit', 'Подземелье': 'exit', 'Здание': 'exit', 'Замок': 'exit', 'Летающий': 'exit', 'Рыбалка': 'fish' };
const MARK_GLYPH = { npc: '!', infanta: '♛', shop: '$', post: '✉', exit: '➜', fish: '≈', craft: '⚒' };
const markKind = t => MARK_KIND[t] || 'craft';
function markTip(m) {
  const t = BTX(), X = baseIndex(), k = markKind(m.t);
  const title = `<div class="bs-tt-h"><b>${esc(m.n)}</b><span>${esc(m.t === 'Продавец' ? t.marks.shop : t.marks[k] || m.t)}</span></div>`;
  if (k === 'npc' || k === 'shop' || k === 'infanta' || k === 'post') {
    const n = X.npcBy.get(bnorm(m.n));
    const qs = (n && X.questsFrom.get(n.name)) || [];
    const img = n && n.img ? `<img class="bs-tt-img" src="../data/npcs/${n.img}">` : '';
    let body = '';
    if (qs.length) body += `<div class="bs-tt-s">${esc(t.gives)}</div>` + qs.slice(0, 6).map(q => `<div>${q.level != null ? `<span class="m">${t.lvl} ${q.level}</span> ` : ''}${esc(q.name)}</div>`).join('') + (qs.length > 6 ? `<div class="m">${esc(fmtT(t.andMore, { n: qs.length - 6 }))}</div>` : '');
    if (n && (n.shop || []).length) body += `<div class="bs-tt-s">${esc(t.shop)}</div>` + n.shop.slice(0, 5).map(s => `<div>${esc(s.n)} <span class="m">${priceHtml(s.p)}</span></div>`).join('') + (n.shop.length > 5 ? `<div class="m">${esc(fmtT(t.andMore, { n: n.shop.length - 5 }))}</div>` : '');
    return `<div class="bs-tt">${img}<div>${title}${body}</div></div>`;
  }
  if (k === 'exit') {
    const l = X.locBy.get(m.n);
    return `<div class="bs-tt"><div>${title}${l && l.min != null ? `<div class="m">${t.lvl} ${l.min}–${l.max}</div>` : ''}</div></div>`;
  }
  if (k === 'fish') {
    const n = X.nodeBy.get(bnorm(m.n));
    return `<div class="bs-tt"><div>${title}${n ? (n.drops || []).slice(0, 6).map(d => `<div>${esc(d.n)}</div>`).join('') : ''}</div></div>`;
  }
  return `<div class="bs-tt"><div>${title}</div></div>`;
}
function markOpen(m) {
  const X = baseIndex(), k = markKind(m.t);
  if ((k === 'npc' || k === 'shop' || k === 'infanta' || k === 'post') && X.npcBy.has(bnorm(m.n))) openBase('npc', X.npcBy.get(bnorm(m.n)).name);
  else if (k === 'exit' && X.locBy.has(m.n)) openBase('loc', m.n);
  else if (k === 'fish' && X.nodeBy.has(bnorm(m.n))) openBase('res', X.nodeBy.get(bnorm(m.n)).name);
}
function mapView(l) {
  const wrap = h('div', { class: 'bs-map' });
  const sz = l.size || 800;
  const im = h('img', { class: 'bs-map-img', src: `../data/maps/${l.map}`, draggable: 'false' });
  Object.assign(im.style, { left: `${((800 - sz) / 2 / 800) * 100}%`, top: `${(((640 - sz) / 2 + (l.off || 0)) / 640) * 100}%`, width: `${(sz / 800) * 100}%` });
  wrap.append(im);
  for (const m of l.marks || []) {
    if (m.x == null || m.y == null) continue;
    const k = markKind(m.t);
    wrap.append(h('button', { class: `bs-mark ${k}`, style: `left:${(m.x / 800) * 100}%;top:${(m.y / 640) * 100}%`, tip: () => markTip(m), onclick: () => markOpen(m) }, MARK_GLYPH[k]));
  }
  return wrap;
}

// ---------- the page ----------
function drawBaseDetail() {
  const el = document.getElementById('baseDetail');
  if (!el) return;
  const t = BTX(), X = baseIndex();
  el.innerHTML = '';
  const f = BS.sel && findEntry(BS.sel.kind, BS.sel.key);
  if (!f) { el.append(h('div', { class: 'bs-empty big' }, t.pick)); return; }
  const { e, x } = f;
  if (BS.back.length) el.append(h('button', { class: 'btn small ghost bs-back', onclick: () => { const p = BS.back.pop(); if (p) openBase(p.kind, p.key, { push: false }); } }, '← ' + t.back));
  el.append(h('div', { class: 'bs-head' },
    e.icon ? h('img', { class: 'bs-big' + (e.round ? ' round' : ''), src: e.icon, draggable: 'false' }) : h('span', { class: 'bs-big ph' }, iconEl(ph(e.kind))),
    h('div', { class: 'bs-title' }, h('h2', null, e.name), h('div', { class: 'bs-meta' }, t.cats[e.kind] + (e.meta ? ' · ' + e.meta : '')))));

  if (e.kind === 'monster') {
    el.append(bfacts([[t.level, x.level], [t.hp, x.hp != null ? fmtNum(x.hp) : null], [t.race, x.race], [t.element, x.element], [t.defense, x.defense],
      [t.exp, x.exp != null ? fmtNum(x.exp) : null], [t.mode, x.mode], [t.aggro, x.aggro ? t.yes : t.no], [t.event, x.event], [t.group, x.group], [t.quest, x.quest], [t.summoned, x.summoned]]));
    if ((x.locs || []).length) {
      el.append(bsec(t.where, h('div', { class: 'bs-chips' }, x.locs.map(l => bchip(l.loc, { kind: 'loc', key: l.loc }, { extra: l.resp ? `${t.resp} ${fmtMin(l.resp)}` : '' })))));
      if (typeof BOSSES !== 'undefined' && BOSSES.find(b => b.name === x.name)) el.append(h('button', { class: 'btn small bs-act', onclick: () => { BT.q = x.name; switchTool('timer'); } }, iconEl('skull'), t.toTimer));
    }
    for (const k of ['equip', 'cards', 'drop', 'cons', 'questDrop', 'recipes', 'summon']) {
      const list = x[k] || [];
      if (list.length) el.append(bsec(t.drops[k], chips(list, n => bchip(n, k === 'summon' ? linkOfName(n) : undefined))));
    }
    el.append(h('div', { class: 'bs-foot' }, wikiLink('Монстр ' + x.name)));
  } else if (e.kind === 'loc') {
    el.append(bfacts([[t.locType, (x.type || []).join(', ')], [t.levels, x.min != null ? `${x.min}–${x.max}` : (x.lv || []).join('–')], [t.event, x.event]]));
    if (x.map) el.append(mapView(x));
    const marks = x.marks || [];
    const npcNames = [...new Set([...marks.filter(m => ['npc', 'shop', 'infanta', 'post'].includes(markKind(m.t))).map(m => m.n), ...x.npcs.map(n => n.name)])];
    if (npcNames.length) el.append(bsec(t.npcsHere, chips(npcNames, n => bchip(n, X.npcBy.has(bnorm(n)) ? { kind: 'npc', key: X.npcBy.get(bnorm(n)).name } : null))));
    if (x.monsters.length) {
      const grid = h('div', { class: 'bs-mlist' });
      for (const { m, resp } of x.monsters) { const en = entryOf('monster', m); if (resp) en.meta += ` · ${t.resp} ${fmtMin(resp)}`; grid.append(baseRow(en, false, () => openBase('monster', m.name))); }
      el.append(bsec(t.monsters, grid));
    }
    const res = [...new Set([...x.nodes.map(n => n.name), ...marks.filter(m => markKind(m.t) === 'fish').map(m => m.n)])];
    if (res.length) el.append(bsec(t.resHere, chips(res, n => bchip(n, X.nodeBy.has(bnorm(n)) ? { kind: 'res', key: X.nodeBy.get(bnorm(n)).name } : null))));
    const exits = marks.filter(m => markKind(m.t) === 'exit');
    if (exits.length) el.append(bsec(t.exits, chips(exits, m => bchip(m.n, X.locBy.has(m.n) ? { kind: 'loc', key: m.n } : null, { extra: m.t }))));
    el.append(h('div', { class: 'bs-foot' }, wikiLink(x.name)));
  } else if (e.kind === 'npc') {
    el.append(bfacts([[t.race, x.race], [t.event, x.event]]));
    if ((x.locs || []).length) el.append(bsec(t.standsIn, chips(x.locs, l => bchip(l, X.locBy.has(l) ? { kind: 'loc', key: l } : null))));
    const gives = X.questsFrom.get(x.name) || [], takes = X.questsTo.get(x.name) || [];
    if (gives.length) el.append(bsec(`${t.gives} (${gives.length})`, chips(gives, qchip)));
    if (takes.length) el.append(bsec(`${t.takes} (${takes.length})`, chips(takes, qchip)));
    if ((x.shop || []).length) {
      el.append(bsec(`${t.shop} (${x.shop.length})`, h('div', { class: 'bs-shop' }, x.shop.map(s => h('div', null, bchip(s.n), h('span', { class: 'bs-price' }, priceEl(s.p)))))));
    }
    el.append(h('div', { class: 'bs-foot' }, wikiLink(x.name)));
  } else if (e.kind === 'quest') {
    el.append(bfacts([[t.level, x.level], [t.type, x.type], [t.event, x.event], [t.chain, x.chain ? `${x.chain}${x.num ? ` · №${x.num}` : ''}` : ''], [t.cls, (x.cls || []).join(', ')],
      [t.exp, x.exp ? fmtNum(x.exp) : null], [t.gold, x.gold ? priceEl(x.gold) : null]]));
    const npcLink = n => bchip(n, X.npcBy.has(bnorm(n)) ? { kind: 'npc', key: X.npcBy.get(bnorm(n)).name } : null);
    el.append(h('div', { class: 'bs-pair' }, x.from ? bsec(t.from, npcLink(x.from)) : null, x.to ? bsec(t.to, npcLink(x.to)) : null));
    const prev = (x.prev || []).map(p => X.questBy.get(bnorm(p))).filter(Boolean);
    const next = X.questsAfter.get(bnorm(x.name)) || [];
    if (prev.length || next.length) el.append(h('div', { class: 'bs-pair' }, prev.length ? bsec(t.prev, chips(prev, qchip)) : null, next.length ? bsec(t.next, chips(next, qchip)) : null));
    const task = [];
    if ((x.kill || []).length) task.push(bsec(t.kill, chips(x.kill, k => bchip(k.n, X.monBy.has(bnorm(k.n)) ? { kind: 'monster', key: X.monBy.get(bnorm(k.n)).name } : null, { count: k.c }))));
    if ((x.need || []).length) task.push(bsec(t.need, chips(x.need, k => bchip(k.n, undefined, { count: k.c }))));
    if ((x.use || []).length) task.push(bsec(t.useIt, chips(x.use, k => bchip(k.n, undefined, { count: k.c }))));
    if ((x.bring || []).length) task.push(bsec(t.bring, chips(x.bring, npcLink)));
    if ((x.loc || []).length) task.push(bsec(t.where, chips(x.loc, l => bchip(l, X.locBy.has(l) ? { kind: 'loc', key: l } : null))));
    if (task.length) el.append(h('div', { class: 'bs-group' }, h('h3', null, t.task), task));
    const rew = [];
    if ((x.reward || []).length) rew.push(bsec(t.reward, chips(x.reward, k => bchip(k.n, undefined, { count: k.c }))));
    if ((x.choice || []).length) rew.push(bsec(t.choice, chips(x.choice, k => bchip(k.n, undefined, { count: k.c }))));
    if (rew.length) el.append(h('div', { class: 'bs-group' }, h('h3', null, t.reward), rew));
    el.append(h('div', { class: 'bs-foot' }, wikiLink('Задание — ' + x.name)));
  } else if (e.kind === 'recipe') {
    el.append(bfacts([[t.chance, x.chance != null ? `${x.chance}%` : null]]));
    if (x.result) el.append(bsec(t.result, chips([x.result], n => bchip(n, undefined, { count: x.count }))));
    el.append(bsec(t.ingredients, chips(x.res || [], r => bchip(r.n, undefined, { count: r.c }))));
    const s = sourcesOf(x.name);
    const parts = [];
    if (s.drop) parts.push(bsec(t.src.drop, chips(s.drop, mchip)));
    if (s.shop) parts.push(bsec(t.src.shop, chips(s.shop, y => bchip(y.npc.name, { kind: 'npc', key: y.npc.name }, { extra: priceEl(y.price) }))));
    if (s.quest) parts.push(bsec(t.src.quest, chips(s.quest, qchip)));
    if (x.from) parts.push(bsec(t.from, chips([x.from], n => bchip(n))));
    el.append(h('div', { class: 'bs-group' }, h('h3', null, t.recipeFrom), parts.length ? parts : h('div', { class: 'hint' }, t.nobody)));
    el.append(h('div', { class: 'bs-foot' }, wikiLink(x.name)));
  } else if (e.kind === 'res') {
    if ((x.bait || []).length) el.append(bsec(t.bait, chips(x.bait, n => bchip(n))));
    el.append(bsec(t.yields, chips(x.drops || [], d => bchip(d.n, undefined, { count: d.c, extra: d.ev || '' }))));
    if ((x.locs || []).length) el.append(bsec(t.locsOf, chips(x.locs, l => bchip(l, X.locBy.has(l) ? { kind: 'loc', key: l } : null))));
  } else if (e.kind === 'item') {
    const tip = h('div', { class: 'bs-tip' });
    tip.innerHTML = itemTip(x, null);
    el.append(tip);
    const sets = allowedSets(ch);
    const keys = [...sets.keys()].filter(k => sets.get(k).has(x.id));
    const key = keys.find(k => !ch.equipment[k]) || keys[0];
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
      : h('div', { class: 'hint' }, fmtT(t.cantEquip, { cls: ctx.classes.get(ch.classId)?.name || '' })));
    el.append(...whereBlocks(x.name));
  } else if (e.kind === 'card') {
    el.append(h('div', { class: 'bs-bonuses' }, x.bonuses.map(cb => h('div', null, bonusText({ typeId: cb.typeId, vars: cardBonusVarsForDisplay(cb) })))));
    const where = [...(x.slotIds || []).map(id => ctx.slots.get(id)?.name), ...(x.typeIds || []).map(id => ctx.eqTypes.get(id)?.name)].filter(Boolean);
    if (where.length) el.append(bsec(t.slots, chips(where, w => h('span', { class: 'bs-chip' }, w))));
    const mi = X.lootBy.get(bnorm(x.name));
    if (mi) el.append(h('button', { class: 'btn small bs-act', onclick: () => { MK.sel = mi.id; store.set('marketSel', mi.id); switchTool('market'); } }, iconEl('coins'), t.market));
    el.append(...whereBlocks(x.name));
  } else if (e.kind === 'stamp') {
    el.append(bsec(t.variants, h('div', { class: 'bs-variants' }, x.variants.map(v => h('div', { class: 'bs-var' },
      h('i', { style: `background:${v.color?.Argb || '#888'}` }),
      h('div', null, v.bonuses.map(b => h('div', null, bonusText({ typeId: b.typeId, vars: [b.value] })))))))));
  } else if (e.kind === 'loot' || e.kind === 'thing') {
    const mi = e.kind === 'loot' ? x : X.lootBy.get(bnorm(x));
    if (mi) {
      el.append(bfacts([[t.npc, mi.npc != null ? priceEl(mi.npc) : null], [t.event, mi.event]]));
      el.append(h('button', { class: 'btn small bs-act', onclick: () => { MK.sel = mi.id; store.set('marketSel', mi.id); switchTool('market'); } }, iconEl('coins'), t.market));
    }
    el.append(...whereBlocks(e.kind === 'loot' ? x.name : x));
  }
  el.append(h('div', { class: 'note bs-src' }, t.src2));
  el.scrollTop = 0;
}
