/* Upgrade simulator (заточка). Chances: data/forge.js (tools/update-forge-wiki.mjs, from the Royal Quest Wiki).
   One attempt at +L: success → +L+1, break → the item is gone, otherwise → +L-1. A rune keeps the item and the level on failure;
   the Ashkalot cube has the shard's chances and never breaks. The numbers are exact (absorbing Markov chain), not sampled. */
/* global RQ_FORGE */

const FORGE_T = {
  uk: {
    win: "Покращення предмета", pick: "Вибрати предмет", anyItem: "Будь-який предмет (тип і грейд вручну)", up: "Покращити", reset: "Новий предмет",
    putRune: "Покласти руну", takeRune: "Прибрати", noRune: "Без руни", msgUp: "Покращення пройшло успішно!", msgDown: "Не вдалося: заточка знизилась на 1",
    msgKeep: "Не вдалося, але руна зберегла заточку", msgBreak: "Предмет зруйновано!", msgDone: "Мету досягнуто!", spentGold: "золота",
    maxNote: "Грейд C точиться максимум до +10.",
    title: 'Симулятор заточки', kind: 'Предмет', armor: 'Одяг', oneHand: 'Одноручна зброя, щит, орб', twoHand: 'Дворучна зброя', grade: 'Грейд',
    from: 'Зараз', to: 'Мета', step: 'Заточка', stone: 'Камінь', rune: 'Руна', ok: 'Успіх', down: '−1', brk: 'Поломка', all: 'Для всіх',
    prices: 'Ціни (золото)', item: 'Предмет', result: 'Результат', reach: 'Шанс дійти до {to} без поломки', avgStones: 'У середньому піде',
    cost: 'Ціна в середньому', costNoBreak: 'Камені й руни на одну спробу дійти до мети', costRebuy: 'З купівлею нового предмета після поломки',
    attempts: 'спроб', sim: 'Спробувати', simOne: 'Точити', simAuto: 'До мети', simReset: 'Скинути', simSpent: 'Витрачено', simLog: 'Журнал',
    gotUp: 'успіх', gotDown: 'невдача, −1', gotKeep: 'невдача, руна зберегла', gotBreak: 'предмет зламався', gotDone: 'готово!', newItem: 'новий предмет',
    p11: 'Заточка на +11', p11Text: 'Предмет +10 грейду A чи B точать на +11 копією такого ж предмета. Невдача лишає +10, копія зникає. Шанс залежить від заточки копії:',
    copy: 'Копія', notePlan: 'Камінь на кожен рівень можна вибрати окремо. Рядки нижче «Зараз» потрібні, якщо предмет упаде.',
    noteSrc: 'Шанси з Royal Quest Wiki (сторінка «Заточка»). Крихта філософського каменю для грейду C має шанси Уламка.',
    stones: { shard: 'Уламок філософського каменю', cube: 'Ашкалотський кубик', black: 'Чорний філософський камінь', white: 'Білий філософський камінь', red: 'Червоний філософський камінь', purple: 'Пурпуровий філософський камінь' },
    runeName: 'Руна Холода / Збереження',
  },
  ru: {
    win: "Улучшение предмета", pick: "Выбрать предмет", anyItem: "Любой предмет (тип и грейд вручную)", up: "Улучшить", reset: "Новый предмет",
    putRune: "Положить руну", takeRune: "Убрать", noRune: "Без руны", msgUp: "Улучшение прошло успешно!", msgDown: "Не удалось: заточка снизилась на 1",
    msgKeep: "Не удалось, но руна сохранила заточку", msgBreak: "Предмет разрушен!", msgDone: "Цель достигнута!", spentGold: "золота",
    maxNote: "Грейд C точится максимум до +10.",
    title: 'Симулятор заточки', kind: 'Предмет', armor: 'Одежда', oneHand: 'Одноручное оружие, щит, орб', twoHand: 'Двуручное оружие', grade: 'Грейд',
    from: 'Сейчас', to: 'Цель', step: 'Заточка', stone: 'Камень', rune: 'Руна', ok: 'Успех', down: '−1', brk: 'Поломка', all: 'Для всех',
    prices: 'Цены (золото)', item: 'Предмет', result: 'Результат', reach: 'Шанс дойти до {to} без поломки', avgStones: 'В среднем уйдёт',
    cost: 'Цена в среднем', costNoBreak: 'Камни и руны на одну попытку дойти до цели', costRebuy: 'С покупкой нового предмета после поломки',
    attempts: 'попыток', sim: 'Попробовать', simOne: 'Точить', simAuto: 'До цели', simReset: 'Сбросить', simSpent: 'Потрачено', simLog: 'Журнал',
    gotUp: 'успех', gotDown: 'неудача, −1', gotKeep: 'неудача, руна сохранила', gotBreak: 'предмет сломался', gotDone: 'готово!', newItem: 'новый предмет',
    p11: 'Заточка на +11', p11Text: 'Предмет +10 грейда A или B точат на +11 копией такого же предмета. Неудача оставляет +10, копия пропадает. Шанс зависит от заточки копии:',
    copy: 'Копия', notePlan: 'Камень на каждый уровень можно выбрать отдельно. Строки ниже «Сейчас» нужны, если предмет упадёт.',
    noteSrc: 'Шансы с Royal Quest Wiki (страница «Заточка»). Крошка философского камня для грейда C имеет шансы Осколка.',
    stones: { shard: 'Осколок философского камня', cube: 'Ашкалотский кубик', black: 'Чёрный философский камень', white: 'Белый философский камень', red: 'Красный философский камень', purple: 'Пурпурный философский камень' },
    runeName: 'Руна Холода / Сохранения',
  },
  en: {
    win: "Item upgrade", pick: "Choose an item", anyItem: "Any item (type and grade by hand)", up: "Upgrade", reset: "New item",
    putRune: "Add a rune", takeRune: "Remove", noRune: "No rune", msgUp: "The upgrade succeeded!", msgDown: "Failed: the upgrade dropped by 1",
    msgKeep: "Failed, but the rune kept the upgrade", msgBreak: "The item was destroyed!", msgDone: "Goal reached!", spentGold: "gold",
    maxNote: "Grade C goes up to +10 at most.",
    title: 'Upgrade simulator', kind: 'Item', armor: 'Armor', oneHand: 'One-handed weapon, shield, orb', twoHand: 'Two-handed weapon', grade: 'Grade',
    from: 'Now', to: 'Goal', step: 'Upgrade', stone: 'Stone', rune: 'Rune', ok: 'Success', down: '−1', brk: 'Break', all: 'For all',
    prices: 'Prices (gold)', item: 'Item', result: 'Result', reach: 'Chance to reach {to} without breaking', avgStones: 'On average it takes',
    cost: 'Average cost', costNoBreak: 'Stones and runes for one try at the goal', costRebuy: 'Buying a new item after a break',
    attempts: 'tries', sim: 'Try it', simOne: 'Upgrade', simAuto: 'To the goal', simReset: 'Reset', simSpent: 'Spent', simLog: 'Log',
    gotUp: 'success', gotDown: 'failed, −1', gotKeep: 'failed, the rune kept it', gotBreak: 'the item broke', gotDone: 'done!', newItem: 'new item',
    p11: 'Upgrading to +11', p11Text: 'A +10 item of grade A or B is upgraded to +11 with a copy of the same item. A failure keeps +10, the copy is gone. The chance depends on the copy\'s upgrade:',
    copy: 'Copy', notePlan: 'Each level can use its own stone. Rows below "Now" matter if the item drops.',
    noteSrc: 'Chances from the Royal Quest Wiki ("Заточка" page). Philosopher\'s Stone Crumbs for grade C have the Shard\'s chances.',
    stones: { shard: 'Philosopher\'s Stone Shard', cube: 'Ashkalot Cube', black: 'Black Philosopher\'s Stone', white: 'White Philosopher\'s Stone', red: 'Red Philosopher\'s Stone', purple: 'Purple Philosopher\'s Stone' },
    runeName: 'Rune of Cold / Preservation',
  },
};
const FT = () => FORGE_T[lang] || FORGE_T.ru;
const FORGE_STONES = ['shard', 'cube', 'black', 'white', 'red', 'purple'];
const STONE_COLOR = { shard: '#b9a27a', cube: '#7fb2d6', black: '#5b5b66', white: '#e6e2d6', red: '#d0503c', purple: '#a35bd6' };

// loaded before app.js (its `store` doesn't exist yet), so read the saved choices directly
const fget = (k, def) => { try { const v = localStorage.getItem('rqc.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const FG = {
  kind: fget('forgeKind', 'armor'), grade: fget('forgeGrade', 'A'),
  from: fget('forgeFrom', 0), to: fget('forgeTo', 8),
  plan: fget('forgePlan', {}),                 // level (1…10) → { stone, rune }
  prices: fget('forgePrices', {}),             // stone / 'rune' / 'item' → gold
  sim: null,                                   // { level, spent: {stone: n}, runes, items, log: [] }
};
FG.itemId = fget('forgeItem', null);           // an item from the database: its type and grade pick the table
const fgSave = () => { store.set('forgeKind', FG.kind); store.set('forgeGrade', FG.grade); store.set('forgeFrom', FG.from); store.set('forgeTo', FG.to); store.set('forgePlan', FG.plan); store.set('forgePrices', FG.prices); store.set('forgeItem', FG.itemId); };

// which wiki table an item uses: two-handed weapons, one-handed weapons with shields and orbs, everything else
function forgeKindOf(item) {
  const t = ctx.eqTypes.get(item.typeId);
  if (t.weaponInfo) return t.weaponInfo.isSingleHand ? 'oneHand' : 'twoHand';
  return /^(7|8)$/.test(String(t.id)) ? 'oneHand' : 'armor'; // 7 shield, 8 orb
}
// costumes, ornaments and mounts can't be upgraded
const forgeItems = () => [...ctx.equipment.values()].filter(i => i.inVersion !== false && ctx.slots.get(ctx.eqTypes.get(i.typeId).slotId).isWeapon != null);
const forgeItem = () => (FG.itemId != null ? ctx.equipment.get(FG.itemId) : null);
function setForgeItem(id) {
  FG.itemId = id;
  const it = forgeItem();
  if (it) { FG.kind = forgeKindOf(it); FG.grade = ctx.equipmentClassOf(it).Name; }
  FG.to = Math.min(FG.to, 10); FG.from = Math.min(FG.from, FG.to - 1);
}
const planAt = lv => ({ stone: 'shard', rune: false, ...(FG.plan[lv] || {}) });

// chances for an attempt from +lv to +lv+1 with this level's plan: { ok, brk, down, keep }
function stepChance(lv, plan = planAt(lv + 1)) {
  const table = RQ_FORGE[FG.kind][FG.grade];
  const [ok, brk0] = table[plan.stone === 'cube' ? 'shard' : plan.stone][lv];
  const brk = plan.stone === 'cube' || plan.rune ? 0 : brk0;
  const fail = 1 - ok - brk;
  return plan.rune ? { ok, brk: 0, down: 0, keep: 1 - ok } : { ok, brk, down: lv > 0 ? fail : 0, keep: lv > 0 ? 0 : fail };
}

// Exact numbers from `start` to FG.to: expected visits of each level, chance to reach the goal, chance to break.
function forgeMath(start) {
  const n = FG.to;                                // transient states: levels 0 … to-1
  if (start >= n) return { reach: 1, brk: 0, visits: [] };
  // expected visits v solves v = e_start + v·Q  →  (I − Q)ᵀ v = e_start
  const A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  for (let i = 0; i < n; i++) A[i][i] = 1;
  for (let lv = 0; lv < n; lv++) {
    const c = stepChance(lv);
    if (lv + 1 < n) A[lv + 1][lv] -= c.ok;       // (I−Q)ᵀ[to][from]
    if (lv > 0) A[lv - 1][lv] -= c.down;
    A[lv][lv] -= c.keep;
  }
  A[start][n] = 1;
  for (let col = 0; col < n; col++) {             // Gauss-Jordan with partial pivoting (n ≤ 10)
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    const d = A[col][col];
    if (Math.abs(d) < 1e-15) return null;
    for (let k = col; k <= n; k++) A[col][k] /= d;
    for (let r = 0; r < n; r++) if (r !== col && A[r][col]) { const f = A[r][col]; for (let k = col; k <= n; k++) A[r][k] -= f * A[col][k]; }
  }
  const visits = A.map(row => row[n]);
  const reach = visits[n - 1] * stepChance(n - 1).ok;
  const brk = visits.reduce((s, v, lv) => s + v * stepChance(lv).brk, 0);
  return { reach, brk, visits };
}

function forgeCost(m) {
  const price = k => +FG.prices[k] || 0;
  const stones = {}; let runes = 0, gold = 0;
  m.visits.forEach((v, lv) => {
    const p = planAt(lv + 1);
    stones[p.stone] = (stones[p.stone] || 0) + v;
    if (p.rune) runes += v;
    gold += v * (price(p.stone) + (p.rune ? price('rune') : 0));
  });
  return { stones, runes, gold };
}

function renderForge(el) {
  const t = FT();
  const seg = (items, cur, on) => h('div', { class: 'seg' }, items.map(([v, label]) => h('button', { class: v === cur ? 'on' : '', onclick: () => on(v) }, label)));
  const set = fn => { fn(); FG.sim = null; fgSave(); renderCenter(); };
  const lvSelect = (val, min, max, on) => h('select', { class: 'inp fg-lv', onchange: e => on(+e.target.value) },
    Array.from({ length: max - min + 1 }, (_, i) => min + i).map(v => h('option', { value: v, selected: v === val }, '+' + v)));

  // an item from the database sets the table (type) and the grade by itself; without one they are chosen by hand
  const it = forgeItem();
  const pickBtn = h('button', { class: 'btn fg-pick', onclick: () => openPopover(pickBtn,
    forgeItems().sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'ru')).map(i => ({
      id: i.id, name: i.name, icon: i.imageId, sub: `${ctx.eqTypes.get(i.typeId).name} · ${ctx.equipmentClassOf(i).Name} · ${T.lvl} ${i.level}` })),
    FG.itemId, id => set(() => setForgeItem(id))) },
    it ? h('img', { class: 'fg-pick-ic', src: IMG(it.imageId), draggable: 'false' }) : null, it ? it.name : t.pick, ' ▾');
  el.append(h('div', { class: 'pb-bar fg-bar' }, pickBtn,
    it ? h('span', { class: 'fg-chip' }, `${t[FG.kind]} · ${FG.grade}`)
      : [seg([['armor', t.armor], ['oneHand', t.oneHand], ['twoHand', t.twoHand]], FG.kind, v => set(() => { FG.kind = v; })),
        seg(['C', 'B', 'A'].map(g => [g, g]), FG.grade, v => set(() => { FG.grade = v; }))],
    h('label', { class: 'fg-l' }, t.from, lvSelect(FG.from, 0, 9, v => set(() => { FG.from = v; if (FG.to <= v) FG.to = v + 1; })),
      t.to, lvSelect(FG.to, 1, 10, v => set(() => { FG.to = v; if (FG.from >= v) FG.from = v - 1; })))));

  const left = h('div', { class: 'fg-left' });
  const wrap = h('div', { class: 'fg-wrap' }, left);
  el.append(wrap);
  left.append(renderForgeWindow(t));

  // plan: a stone (and maybe a rune) for every level up to the goal
  const allSel = h('select', { class: 'inp fg-stone', onchange: e => set(() => { for (let lv = 1; lv <= 10; lv++) FG.plan[lv] = { ...planAt(lv), stone: e.target.value }; }) },
    h('option', { value: '' }, t.all + '…'), FORGE_STONES.map(s => h('option', { value: s }, t.stones[s])));
  const allRune = h('input', { type: 'checkbox', title: t.all, onchange: e => set(() => { for (let lv = 1; lv <= 10; lv++) FG.plan[lv] = { ...planAt(lv), rune: e.target.checked }; }) });
  const pct = v => (v <= 0 ? '—' : v < 0.01 ? '<1%' : Math.round(v * 100) + '%');
  const rows = [];
  for (let lv = 1; lv <= FG.to; lv++) {
    const p = planAt(lv), c = stepChance(lv - 1, p);
    rows.push(h('tr', { class: lv <= FG.from ? 'fg-done' : '' },
      h('td', { class: 'fg-step' }, '+' + lv),
      h('td', null, h('span', { class: 'fg-dot', style: `background:${STONE_COLOR[p.stone]}` }),
        h('select', { class: 'inp fg-stone', onchange: e => set(() => { FG.plan[lv] = { ...p, stone: e.target.value }; }) },
          FORGE_STONES.map(s => h('option', { value: s, selected: s === p.stone }, t.stones[s])))),
      h('td', { class: 'fg-c' }, h('input', { type: 'checkbox', checked: p.rune, title: t.runeName, onchange: e => set(() => { FG.plan[lv] = { ...p, rune: e.target.checked }; }) })),
      h('td', { class: 'fg-n ok' }, pct(c.ok)),
      h('td', { class: 'fg-n down' }, pct(c.down)),
      h('td', { class: 'fg-n brk' }, pct(c.brk))));
  }
  left.append(h('div', { class: 'fg-card' },
    h('table', { class: 'fg-plan' },
      h('thead', null, h('tr', null, h('th', null, t.step), h('th', null, t.stone, ' ', allSel), h('th', { class: 'fg-c', title: t.runeName }, t.rune, h('br'), allRune),
        h('th', null, t.ok), h('th', null, t.down), h('th', null, t.brk))),
      h('tbody', null, rows)),
    h('div', { class: 'note' }, t.notePlan)));

  // results + prices
  const m = forgeMath(FG.from);
  const side = h('div', { class: 'fg-side' });
  wrap.append(side);
  if (m) {
    const cost = forgeCost(m);
    const m0 = FG.from > 0 ? forgeMath(0) : m, c0 = FG.from > 0 ? forgeCost(m0) : cost;
    const item = +FG.prices.item || 0;
    // after a break a new item starts from +0: total = cost(start) + P_break(start)·(item + total from 0)
    const total0 = m0.brk < 1 ? (c0.gold + m0.brk * item) / (1 - m0.brk) : Infinity;
    const totalRebuy = cost.gold + m.brk * (item + total0);
    const fmt = v => (isFinite(v) ? Math.round(v).toLocaleString(locale()) : '∞');
    const avg = Object.entries(cost.stones).filter(([, v]) => v > 0.005).map(([s, v]) => h('div', { class: 'fg-kv' }, h('span', null, h('span', { class: 'fg-dot', style: `background:${STONE_COLOR[s]}` }), t.stones[s]), h('b', null, v.toFixed(1))));
    if (cost.runes > 0.005) avg.push(h('div', { class: 'fg-kv' }, h('span', null, t.runeName), h('b', null, cost.runes.toFixed(1))));
    side.append(h('div', { class: 'fg-card' },
      h('h4', null, t.result),
      h('div', { class: 'fg-big' }, h('span', null, fmtT(t.reach, { to: '+' + FG.to })), h('b', { class: m.reach > 0.5 ? 'ok' : m.reach > 0.15 ? 'mid' : 'bad' }, (m.reach * 100).toFixed(m.reach < 0.1 ? 2 : 1) + '%')),
      h('div', { class: 'fg-sub' }, t.avgStones + ':'), avg,
      h('div', { class: 'fg-sub' }, t.cost + ':'),
      h('div', { class: 'fg-kv' }, h('span', null, t.costNoBreak), h('b', null, fmt(cost.gold))),
      h('div', { class: 'fg-kv' }, h('span', null, t.costRebuy), h('b', null, fmt(totalRebuy)))));
  }
  const priceInp = (k, label, color) => h('label', { class: 'fg-price' }, h('span', null, color ? h('span', { class: 'fg-dot', style: `background:${color}` }) : null, label),
    h('input', { class: 'inp', type: 'number', min: 0, step: 1, value: FG.prices[k] ?? '', placeholder: '0',
      onchange: e => set(() => { FG.prices[k] = Math.max(0, +e.target.value || 0); }) }));
  side.append(h('div', { class: 'fg-card' }, h('h4', null, t.prices),
    FORGE_STONES.map(s => priceInp(s, t.stones[s], STONE_COLOR[s])), priceInp('rune', t.runeName), priceInp('item', t.item)));

  // +11
  const p11 = RQ_FORGE.plus11;
  side.append(h('div', { class: 'fg-card fg-11' }, h('h4', null, t.p11), h('div', { class: 'note' }, t.p11Text),
    h('div', { class: 'fg-11-grid' }, p11.map((v, i) => h('div', null, h('small', null, t.copy + ' +' + i), h('b', null, Math.round(v * 100) + '%'))))));
  el.append(h('div', { class: 'note bt-src' }, t.noteSrc));
}

// The game's "Улучшение предмета" window: the item, the stone, the rune slot, the +1 / −1 / break chances,
// the result, and a button that really rolls the dice. Stone and rune here are the plan for the next level.
function renderForgeWindow(t) {
  if (!FG.sim) FG.sim = { level: FG.from, spent: {}, runes: 0, items: 0, log: [], last: null };
  const S = FG.sim, it = forgeItem();
  const done = S.level >= FG.to;
  const next = Math.min(S.level + 1, 10);
  const p = planAt(next), c = stepChance(next - 1, p);
  const keep = fn => { fn(); fgSave(); renderCenter(); };          // a plan change that keeps the simulation going
  const name = it ? it.name : `${t[FG.kind]} · ${FG.grade}`;
  const icon = cls => (it ? h('img', { class: cls, src: IMG(it.imageId), draggable: 'false' }) : h('div', { class: cls + ' fw-noimg' }, '?'));
  const pct = v => (v <= 0 ? '0%' : v < 0.01 ? '<1%' : Math.round(v * 100) + '%');
  const price = k => +FG.prices[k] || 0;
  const gold = Object.entries(S.spent).reduce((s, [k, n]) => s + n * price(k), 0) + S.runes * price('rune') + S.items * price('item');

  const one = () => {
    if (S.level >= FG.to) return 'done';
    const pl = planAt(S.level + 1), ch = stepChance(S.level, pl), r = Math.random();
    S.spent[pl.stone] = (S.spent[pl.stone] || 0) + 1;
    if (pl.rune) S.runes++;
    let res;
    if (r < ch.ok) { S.level++; res = S.level >= FG.to ? 'done' : 'up'; }
    else if (r < ch.ok + ch.brk) { res = 'break'; S.items++; S.level = 0; }
    else if (r < ch.ok + ch.brk + ch.down) { S.level--; res = 'down'; }
    else res = 'keep';
    S.last = res;
    S.log.unshift({ res, level: S.level });
    S.log.length = Math.min(S.log.length, 10);
    return res;
  };
  const redraw = () => box.replaceWith(renderForgeWindow(t));
  const msg = { up: t.msgUp, down: t.msgDown, keep: t.msgKeep, break: t.msgBreak, done: t.msgDone };
  const word = { up: t.gotUp, down: t.gotDown, keep: t.gotKeep, break: t.gotBreak, done: t.gotDone };

  const box = h('div', { class: 'fw' + (S.last ? ' fw-' + S.last : '') },
    h('div', { class: 'fw-title' }, t.win),
    h('div', { class: 'fw-row fw-item' }, h('div', { class: 'fw-slot' + (S.last === 'break' ? ' broken' : '') }, icon('fw-ic')),
      h('div', { class: 'fw-name' }, h('b', { class: 'fw-lv' }, '+' + S.level), ' ', name)),
    h('div', { class: 'fw-sub' },
      h('div', { class: 'fw-row' }, h('div', { class: 'fw-slot small' }, h('i', { class: 'fw-gem', style: `--gem:${STONE_COLOR[p.stone]}` })),
        h('select', { class: 'inp fw-sel', disabled: done, onchange: e => keep(() => { FG.plan[next] = { ...p, stone: e.target.value }; }) },
          FORGE_STONES.map(s => h('option', { value: s, selected: s === p.stone }, t.stones[s])))),
      h('div', { class: 'fw-row' }, h('div', { class: 'fw-slot small' + (p.rune ? '' : ' empty') }, p.rune ? h('i', { class: 'fw-rune' }) : null),
        h('span', { class: 'fw-rune-name' + (p.rune ? '' : ' off') }, p.rune ? t.runeName : t.noRune),
        h('button', { class: 'btn small' + (p.rune ? ' ghost' : ' fw-buy'), disabled: done, onclick: () => keep(() => { FG.plan[next] = { ...p, rune: !p.rune }; }) }, p.rune ? t.takeRune : t.putRune))),
    h('div', { class: 'fw-chances' },
      h('div', { class: 'fw-ch ok', title: t.ok }, h('i', null, '▲'), h('small', null, '+1'), h('b', null, done ? '—' : pct(c.ok))),
      h('div', { class: 'fw-ch down', title: p.rune ? t.gotKeep : t.down }, h('i', null, p.rune ? '=' : '▼'), h('small', null, p.rune ? '±0' : '−1'), h('b', null, done ? '—' : pct(p.rune ? c.keep : c.down + c.keep))),
      h('div', { class: 'fw-ch brk', title: t.brk }, h('i', null, '✖'), h('small', null, t.brk), h('b', null, done ? '—' : pct(c.brk)))),
    h('div', { class: 'fw-row fw-result' + (done ? ' done' : '') }, h('div', { class: 'fw-slot' }, icon('fw-ic')),
      h('div', { class: 'fw-name' }, h('b', { class: 'fw-lv' }, '+' + (done ? S.level : S.level + 1)), ' ', name)),
    h('div', { class: 'fw-msg' }, S.last ? msg[S.last] : ' '),
    h('div', { class: 'fw-btns' },
      h('button', { class: 'btn primary fw-go', disabled: done, onclick: () => { one(); redraw(); } }, t.up),
      h('button', { class: 'btn', disabled: done, onclick: () => { for (let i = 0; i < 100000 && one() !== 'done';); redraw(); } }, t.simAuto),
      h('button', { class: 'btn ghost', onclick: () => { FG.sim = null; redraw(); } }, t.reset)),
    h('div', { class: 'fw-cost' }, h('span', null, t.simSpent), h('b', null, Math.round(gold).toLocaleString(locale()) + ' ' + t.spentGold)),
    h('div', { class: 'fw-spent' }, [...Object.entries(S.spent).map(([s, n]) => `${n}× ${t.stones[s]}`), S.runes ? `${S.runes}× ${t.runeName}` : null, S.items ? `${S.items}× ${t.newItem}` : null].filter(Boolean).join(' · ')),
    h('div', { class: 'fg-log' }, S.log.map(x => h('div', { class: 'fg-log-' + x.res }, `+${x.level} · ${word[x.res]}`))));
  return box;
}
