'use strict';
/* global RQEngine, RQDATA, RQC_I18N */

const ctx = RQEngine.createContext(window.RQDATA);
const IMG = id => (id ? `../data/img/${id}.png` : '');
const $ = id => document.getElementById(id);

// ---------- storage ----------
const store = {
  get(k, def) { try { const v = localStorage.getItem('rqc.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem('rqc.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

let lang = store.get('lang', 'uk');
// started from the source code (the TEST client), not the installed app
const IS_TEST = new URLSearchParams(location.search).get('test') === '1';
let T = RQC_I18N[lang] || RQC_I18N.uk;
let ch = normalize(store.get('current', null)) || ctx.defaultCharacter();
let buildName = store.get('currentName', '');
let tab = store.get('tab', 'gear');
// a tab that no longer exists (e.g. a removed tool) opens the gear instead
if (!['gear', 'talents', 'effects', 'builds', 'collection', 'bosses', 'market', 'base'].includes(tab)) tab = 'gear';
let baseline = null;      // pinned stats (Map) or null
let previous = null;      // stats before the last change
let lastResult = null;
const fmtT = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// ---------- tiny DOM helper ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (tag === 'img') el.decoding = 'sync'; // re-rendered pictures appear at once, no blink
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.setAttribute('style', v);
    else if (k === 'tip') el._tip = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const img = (id, cls) => (id ? h('img', { src: IMG(id), class: cls, decoding: 'sync', draggable: 'false' }) : h('div', { class: 'ph ' + (cls || '') }));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- number formatting ----------
function fmtNum(v, digits) {
  if (!isFinite(v)) return '—';
  const d = digits ?? (Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 2);
  const s = (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace(/\.?0+$/, m => (m.includes('.') ? '' : m));
  const [i, f] = s.split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (f ? '.' + f : '');
}
// a price in gold with a coin after it; other currencies ("12 АР") are shown as they are
function goldNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v ?? '').trim();
  return /^[\d\s  ]+$/.test(s) && /\d/.test(s) ? +s.replace(/[\s  ]/g, '') : null;
}
// other currencies, as the wiki's «Цена» template writes them ("5 ЗК"): icon in data/currency/<file>.png
const CURRENCIES = {
  КР: ['kr', 'Королевские реалы'], АР: ['ar', 'Алхимические руны'], ЗО: ['zo', 'Знаки отличия'], ЗК: ['zk', 'Знаки крови'], ОА: ['oa', 'Осколки Аркона'],
  ЖЯ: ['zhya', 'Жетоны Ярмарки'], ЗМ: ['zm', 'Запредельные монеты'], МИ: ['mi', 'Монеты игрока'], ВГ: ['vg', 'Валюта гильдии'], ФК: ['fk', 'Фишкоинсы'],
};
// "300" (gold), "5 ЗК" (another currency), "~2000" (an approximate price) → { about, n, cur }
function priceParts(v) {
  if (typeof v === 'number') return isFinite(v) ? { about: false, n: v, cur: null } : null;
  const m = String(v ?? '').trim().match(/^(~\s*)?(\d[\d\s  ]*?)\s*([А-ЯЁ]{2})?$/);
  if (!m || (m[3] && !CURRENCIES[m[3]])) return null;
  return { about: !!m[1], n: +m[2].replace(/[\s  ]/g, ''), cur: m[3] ? { file: CURRENCIES[m[3]][0], name: CURRENCIES[m[3]][1] } : null };
}
function priceEl(v) {
  const p = priceParts(v);
  if (!p) return h('span', { class: 'price' }, String(v ?? ''));
  return h('span', { class: 'price', title: p.cur ? p.cur.name : null }, p.about ? '≈ ' : null, fmtNum(p.n),
    p.cur ? h('img', { class: 'cur', src: `../data/currency/${p.cur.file}.png`, alt: p.cur.name, draggable: 'false' }) : h('i', { class: 'coin', title: T.goldWord || '' }));
}
const priceHtml = v => {
  const p = priceParts(v);
  if (!p) return esc(v);
  const icon = p.cur ? `<img class="cur" src="../data/currency/${p.cur.file}.png" alt="">` : '<i class="coin"></i>';
  return `<span${p.cur ? ` title="${esc(p.cur.name)}"` : ''}>${p.about ? '≈ ' : ''}${fmtNum(p.n)}${icon}</span>`;
};
function fmtStat(s, v) {
  const d = s.roundDigits ?? (Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 2);
  return fmtNum(v, d) + (s.isPercent ? '%' : '');
}

// ---------- search ----------
// any letter case, е = ё, several words in any order; each word must appear in one of the fields
const normSearch = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
function matches(query, ...fields) {
  const words = normSearch(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = normSearch(fields.filter(Boolean).join(' '));
  return words.every(w => hay.includes(w));
}

// ---------- character helpers ----------
function normalize(c) {
  if (!c || !ctx.classes.has(c.classId)) return null;
  const base = ctx.defaultCharacter();
  const out = Object.assign(base, c);
  out.stats = Object.assign({}, c.stats);
  for (const id of ctx.editStatIds(out.classId)) if (!out.stats[id]) out.stats[id] = 1;
  out.guildTalents = ctx.validGuildTalents(out.guildTalents);
  out.sharedAuras = Object.assign({}, out.sharedAuras);
  return out;
}

function allowedSets(c) {
  const sets = new Map();
  for (const key of ctx.slotKeys()) sets.set(key, new Set(ctx.itemsForSlot(c, key).map(i => i.id)));
  return sets;
}
function slotLockedByTwoHander(c, key) {
  const slot = key ? ctx.slots.get(+key.split(':')[0]) : null;
  if (!slot || slot.primarySlotId == null) return false;
  const prim = c.equipment[`${slot.primarySlotId}:${key.split(':')[1]}`];
  const item = prim && ctx.equipment.get(prim.itemId);
  const wi = item && ctx.eqTypes.get(item.typeId).weaponInfo;
  return !!(wi && !wi.isSingleHand);
}
function usedTalentCount(c) { return (c.talents || []).length; }
function validTalents(c) {
  const branches = ctx.classBranches(c.classId);
  const out = [];
  for (const br of branches) {
    const chosen = br.talents.filter(t => c.talents.includes(t.id));
    const rows = [...new Set(br.talents.map(t => t.h))].sort((a, b) => a - b);
    for (const h of rows) { const t = chosen.find(x => x.h === h); if (!t) break; out.push(t.id); }
  }
  return out.slice(0, ctx.talentPoints(c));
}

// The engine gets a cleaned copy: things the character can't use are left out.
// Recomputes a shared build from its data: the DPS/HP/EHP numbers stored with a public build are typed in by
// whoever published it, so they are never shown as is. Also lists what makes the build impossible in the game.
function verifyBuild(data) {
  try {
    const c = normalize(data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : null);
    if (!c) return null;
    const cls = ctx.classes.get(c.classId);
    const problems = [];
    if (!(c.level >= cls.minLevel && c.level <= cls.maxLevel)) { problems.push(T.pbBadLevel); c.level = clamp(+c.level || cls.minLevel, cls.minLevel, cls.maxLevel); }
    if (Object.values(c.stats).some(v => !Number.isInteger(v) || v < 1 || v > ctx.settings.maxStatCount) || ctx.freeStats(c) < 0) problems.push(T.pbBadStats);
    const x = calcInput(c);
    const worn = Object.entries(c.equipment || {}).filter(([key, e]) => e && !slotLockedByTwoHander(c, key));
    if (worn.length > Object.keys(x.equipment).length) problems.push(T.pbBadGear);
    if ((c.talents || []).length > x.talents.length) problems.push(T.pbBadTalents);
    const r = ctx.calc(x);
    return { classId: c.classId, level: c.level, dps: r.stats.get(75) ?? 0, hp: r.stats.get(ctx.ids.HP) ?? 0, ehp: r.stats.get(76) ?? 0, problems };
  } catch { return null; }
}

function calcInput(c) {
  const sets = allowedSets(c);
  const x = JSON.parse(JSON.stringify(c));
  x.equipment = {};
  for (const [key, e] of Object.entries(c.equipment)) {
    if (!e || !sets.get(key)?.has(e.itemId) || slotLockedByTwoHander(c, key)) continue;
    const item = ctx.equipment.get(e.itemId);
    const max = ctx.maxUpgrade(item);
    const ne = { itemId: e.itemId, upgrade: clamp(e.upgrade || 0, 0, max), cards: [], active: e.active !== false };
    if (e.stampVariantId && ctx.stampVariants.has(e.stampVariantId)) {
      const st = ctx.stamps.get(ctx.stampVariants.get(e.stampVariantId).stampId);
      if (ctx.stampAllowed(st, item, c.classId)) ne.stampVariantId = e.stampVariantId;
    }
    const n = ctx.cardCount(item);
    (e.cards || []).slice(0, n).forEach((cid, i) => {
      const card = cid && ctx.cards.get(cid);
      ne.cards.push(card && ctx.cardAllowedOn(card, item) && (card.elementId == null || i === 0) ? cid : null);
    });
    if (item.primaryCardId) ne.cards[0] = item.primaryCardId;
    x.equipment[key] = ne;
  }
  x.talents = validTalents(c);
  { const ok = new Set(ctx.availableBuffs(x).map(b => b.id)); for (const id of Object.keys(x.buffs || {})) if (!ok.has(+id)) delete x.buffs[id]; }
  for (const id of ctx.editStatIds(c.classId)) x.stats[id] = clamp(c.stats[id] || 1, 1, ctx.settings.maxStatCount);
  return x;
}

function recalc() {
  const res = ctx.calc(calcInput(ch));
  if (lastResult) previous = lastResult.stats;
  lastResult = res;
  return res;
}

// one-shot highlight for the element that was just chosen
let flash = null;
const J = key => (flash && flash === key ? ' just' : '');
function flashOnce(key, fn) { flash = key; try { fn(); } finally { flash = null; } }

function changed(mutator, opts = {}) {
  mutator(ch);
  recalc();
  store.set('current', ch);
  if (opts.left !== false) renderLeft();
  if (opts.center !== false) renderCenter();
  renderRight();
  if (opts.after) opts.after();
  flash = null;
}

function setClass(id) {
  const cls = ctx.classes.get(id);
  const oldPrimary = ctx.classes.get(ch.classId).primaryStatId;
  const old = ch.stats;
  ch.classId = id;
  ch.level = clamp(ch.level, cls.minLevel, cls.maxLevel);
  ch.stats = {};
  for (const sid of ctx.editStatIds(id)) ch.stats[sid] = old[sid] || 1;
  if (cls.primaryStatId !== oldPrimary) ch.stats[cls.primaryStatId] = old[oldPrimary] || 1;
  const branchTalents = new Set(ctx.classBranches(id).flatMap(b => b.talents.map(t => t.id)));
  ch.talents = ch.talents.filter(t => branchTalents.has(t));
  if (ch.auraId && !ctx.classAuras(id, ch.level).some(a => a.id === ch.auraId)) ch.auraId = null;
  pruneBuffs();
}
function pruneBuffs() {
  const ok = new Set(ctx.availableBuffs(ch).map(b => b.id));
  for (const id of Object.keys(ch.buffs)) if (!ok.has(+id)) delete ch.buffs[id];
}

// ---------- tooltip ----------
const tipEl = $('tip');
const tipOf = target => {
  let el = target;
  while (el && el !== document && !el._tip) el = el.parentElement;
  if (!el || el === document || !el._tip) return '';
  return (typeof el._tip === 'function' ? el._tip() : el._tip) || '';
};
// mouse: the tip follows the pointer. Touch: a tap only does the action (the browser's fake mouseover after a tap
// is ignored); a long press shows the tip by the finger, the next touch or a scroll hides it.
let lastTouch = 0, pressTimer = null, pressShown = false;
document.addEventListener('mouseover', e => {
  if (Date.now() - lastTouch < 1200) return;
  const v = tipOf(e.target);
  if (!v) { tipEl.hidden = true; return; }
  tipEl.innerHTML = v; tipEl.hidden = false; placeTip(e);
});
document.addEventListener('mousemove', e => { if (!tipEl.hidden && Date.now() - lastTouch >= 1200) placeTip(e); });
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  lastTouch = Date.now(); tipEl.hidden = true; pressShown = false; clearTimeout(pressTimer);
  const v = tipOf(e.target);
  if (!v) return;
  const at = { clientX: e.clientX, clientY: e.clientY };
  pressTimer = setTimeout(() => { tipEl.innerHTML = v; tipEl.hidden = false; placeTip(at, true); pressShown = true; }, 450);
}, true);
const cancelPress = () => { clearTimeout(pressTimer); lastTouch = Date.now(); };
document.addEventListener('pointerup', e => { if (e.pointerType === 'touch') cancelPress(); }, true);
document.addEventListener('pointercancel', cancelPress, true);
document.addEventListener('scroll', () => { clearTimeout(pressTimer); if (Date.now() - lastTouch < 1200) tipEl.hidden = true; }, true);
// the release after a long press is not a tap: don't open or toggle anything
document.addEventListener('click', e => { if (pressShown) { pressShown = false; e.preventDefault(); e.stopPropagation(); } }, true);
document.addEventListener('contextmenu', e => { if (Date.now() - lastTouch < 1200) e.preventDefault(); });
function placeTip(e, touch = false) {
  const r = tipEl.getBoundingClientRect();
  let x = e.clientX + 16, y = e.clientY + 14;
  if (touch) { x = e.clientX - r.width / 2; y = e.clientY - r.height - 24; if (y < 8) y = e.clientY + 28; } // above the finger
  if (x + r.width > innerWidth - 8) x = touch ? innerWidth - r.width - 8 : e.clientX - r.width - 12;
  if (y + r.height > innerHeight - 8) y = innerHeight - r.height - 8;
  tipEl.style.left = Math.max(8, x) + 'px'; tipEl.style.top = Math.max(8, y) + 'px';
}
// confirmation in the app's style (instead of the system confirm window); resolves true/false
function confirmBox(text, { ok = T.yes, danger = false } = {}) {
  return new Promise(resolve => {
    const wrap = h('div', { class: 'modal confirm-wrap' });
    const done = v => { wrap.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); done(false); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); done(true); }
    };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) done(false); });
    const okBtn = h('button', { class: 'btn ' + (danger ? 'danger-solid' : 'primary'), onclick: () => done(true) }, ok);
    wrap.append(h('div', { class: 'dialog confirm' },
      h('div', { class: 'confirm-icon' + (danger ? ' danger' : '') }, danger ? '✕' : '?'),
      h('div', { class: 'confirm-text' }, text),
      h('div', { class: 'confirm-foot' }, h('button', { class: 'btn', onclick: () => done(false) }, T.cancel), okBtn)));
    document.body.append(wrap);
    okBtn.focus();
  });
}
function toast(text) {
  const t = h('div', { class: 'toast' }, text);
  document.body.append(t); setTimeout(() => t.remove(), 1600);
}

// ---------- bonus text ----------
const bonusText = b => ctx.formatBonus(b);
// bonus types that only work during an event: typeId -> eventId
const EVENT_OF_TYPE = new Map();
for (const c of RQDATA.BonusTypeStatCondition || []) {
  if (c.Event_Id == null) continue;
  const bts = (RQDATA.BonusTypeStat || []).find(x => x.Id === c.BonusTypeStat_Id);
  if (bts) EVENT_OF_TYPE.set(bts.BonusType_Id, c.Event_Id);
}
// Some event bonuses have no stat in the calculator (e.g. "сопротивление критическому урону (на время Дня св.Валлена)"),
// so they have no condition row; recognise them by the "(на время …)" text and the event name.
{
  const stems = (RQDATA.Event || []).map(ev => ({ id: ev.Id, words: ev.Name.toLowerCase().replace(/ё/g, 'е').split(/[^а-яa-z]+/).filter(w => w.length > 4).map(w => w.slice(0, 5)) }));
  for (const t of RQDATA.BonusType || []) {
    if (EVENT_OF_TYPE.has(t.Id)) continue;
    const m = String(t.Template || '').toLowerCase().replace(/ё/g, 'е').match(/\(на время ([^)]*)\)/);
    if (!m) continue;
    const ev = stems.find(s => s.words.some(w => m[1].includes(w)));
    if (ev) EVENT_OF_TYPE.set(t.Id, ev.id);
  }
}
const itemEvents = item => [...new Set(item.bonuses.map(b => EVENT_OF_TYPE.get(b.typeId)).filter(Boolean))];
// lines of an item's own bonuses; event-only ones are marked off when that event isn't selected
function itemBonusLines(item) {
  return item.bonuses.map(b => {
    const t = ctx.bonusTypes.get(b.typeId);
    const bb = t.hasDynamic ? ctx.evaluateDynamicBonus(b, calcInput(ch)) : b;
    const ev = EVENT_OF_TYPE.get(b.typeId);
    return { text: bonusText(bb) + (b.activate != null ? ' *' : ''), off: ev != null && ev !== ch.eventId };
  }).concat(ctx.eqTypes.get(item.typeId).bonuses.filter(b => b.typeId !== RANGE_BONUS).map(b => ({ text: bonusText(b), off: false })));
}
// ranged weapons: the standard range of the weapon type is shown with the weapon's stats, not as a bonus;
// the item's own extra range is added next to it
const RANGE_BONUS = 22; // "{0} к Дальности дистанционной атаки"
function weaponRange(item) {
  const sum = list => list.filter(b => b.typeId === RANGE_BONUS).reduce((s, b) => s + (b.vars?.[0] || 0), 0);
  const base = sum(ctx.eqTypes.get(item.typeId).bonuses);
  return base ? { base, extra: sum(item.bonuses) } : null;
}
// item name takes the color of its stamp, like in the game
const stampColorOf = e => {
  const v = e && e.stampVariantId && ctx.stampVariants.get(e.stampVariantId);
  return v && v.color ? v.color.Argb : null;
};
const tinyIcon = (id, cls = 'tt-ic') => (id ? `<img class="${cls}" src="${IMG(id)}">` : '');
// in-game style item tooltip: "+8 [cards] Name" in stamp color, stats, cards, stamp, requirements
function itemTip(item, e) {
  const t = ctx.eqTypes.get(item.typeId);
  const color = stampColorOf(e);
  const cards = e ? (e.cards || []).map(id => id && ctx.cards.get(id)).filter(Boolean) : [];
  const up = e && e.upgrade ? ctx.upgradeBonus(item, e.upgrade) : null;
  const parts = [];
  parts.push(`<div class="tt-title"${color ? ` style="color:${color}"` : ''}>${e && e.upgrade ? `+${e.upgrade} ` : ''}${cards.map(c => tinyIcon(c.imageId)).join('')}${esc(item.name)}</div>`);
  if (item.isPersonal) parts.push(`<div class="tt-red">${esc(T.personal)}</div>`);
  parts.push(`<div class="tt-sub"><span>${esc(t.name)}</span><span>${ctx.slots.get(t.slotId).isWeapon != null ? esc(T.classLetter) + ' ' + esc(ctx.equipmentClassOf(item).Name) : ''}</span></div>`);
  // empty card slots, like the game shows them
  const emptySlots = Math.max(0, ctx.cardCount(item) - cards.length);
  if (emptySlots) parts.push(`<div class="tt-sec">${`<div class="tt-slot"><i class="tt-empty-card"></i>${esc(T.cardSlot)}</div>`.repeat(emptySlots)}</div>`);
  const stat = (label, base, plus) => `<div>${esc(label)}: ${base}${plus ? ` <span class="tt-up">+${plus}</span>` : ''}</div>`;
  if (item.info) {
    let s = '';
    if (item.info.attack) s += stat(T.attack, item.info.attack, up?.attack);
    if (item.info.defense) s += stat(T.defense, item.info.defense, up?.defense);
    if (item.info.attackSpeed) s += `<div>${esc(T.atkSpeed)}: ${item.info.attackSpeed} ${esc(T.perSec)}</div>`;
    const range = weaponRange(item);
    if (range) s += stat(T.attackRange, range.base, range.extra);
    if (up?.hp) s += `<div>${esc(ctx.stats.get(ctx.ids.HP).name)}: <span class="tt-up">+${up.hp}</span></div>`;
    if (up?.allStat) s += `<div><span class="tt-up">+${up.allStat}</span> ${esc(T.allStats)}</div>`;
    parts.push(`<div class="tt-sec">${s}</div>`);
  }
  const bl = itemBonusLines(item);
  if (bl.length) parts.push(`<div class="tt-sec">${bl.map(x => x.off ? `<div class="tt-off">${esc(x.text)} — ${esc(T.inactive)}</div>` : `<div>${esc(x.text)}</div>`).join('')}</div>`);
  for (const c of cards) {
    const lines = c.bonuses.map(cb => bonusText({ typeId: cb.typeId, vars: cardBonusVarsForDisplay(cb) }));
    parts.push(`<div class="tt-sec"><div class="tt-card">${tinyIcon(c.imageId)}${esc(c.name)}</div>${lines.map(x => `<div class="tt-li">${esc(x)}</div>`).join('')}</div>`);
  }
  if (color) {
    const v = ctx.stampVariants.get(e.stampVariantId);
    parts.push(`<div class="tt-sec"><div class="tt-card" style="color:${color}">${tinyIcon(v.color?.Image_Id)}${esc(T.stampWord)} ${esc(ctx.stamps.get(v.stampId).name)}</div>${ctx.stampBonuses(v.id, item).map(b => `<div>${esc(bonusText(b))}</div>`).join('')}</div>`);
  }
  const allowed = ctx.itemClassConditions(item).map(id => ctx.classes.get(id)).filter(c => c.baseId != null || !ctx.itemClassConditions(item).some(x => ctx.classes.get(x).baseId === c.id));
  // footer: class, level and gender requirements; red only when this character can't use the item
  const gender = item.genderId != null ? ctx.genders.find(g => g.Id === item.genderId) : null;
  const classOk = !allowed.length || ctx.itemAllowedForClass(item, ch.classId);
  const bad = cls => (cls ? ' class="bad"' : '');
  parts.push(`<div class="tt-req">`
    + `<div${bad(!classOk)}>${esc(T.classWord)}: ${esc(allowed.length ? allowed.map(c => c.name).join(', ') : T.anyClass)}</div>`
    + `<div class="tt-req-row"><span${bad(item.level > ch.level)}>${esc(T.reqLevel)}: ${item.level}</span>`
    + `<span${bad(gender && gender.Id !== ch.genderId)}>${esc(T.genderWord)}: ${esc(gender ? gender.Name : T.anyGender)}</span></div></div>`);
  return `<div class="tt-item">${parts.join('')}</div>`;
}
const cardTypeLabel = card => (T.cardTypes && T.cardTypes[card.cardTypeName]) || card.cardTypeName || '';
function cardBonusVarsForDisplay(cb) {
  const vars = [];
  if (cb.upgrade) { const m = cb.variables[0]; [m.value, cb.upgrade.step, cb.upgrade.condition].forEach((v, i) => { vars[m.index + i] = v; }); }
  else cb.variables.forEach(v => { vars[v.index] = v.value; });
  for (let i = 0; i < vars.length; i++) if (vars[i] == null) vars[i] = 0;
  // cards that change other cards (two П'атаг cards turn Рогоножка's minuses into pluses): same rule as the engine,
  // counted over everything the character wears
  const worn = id => Object.values(ch.equipment || {}).reduce((n, e) => n + ((e && e.cards) || []).filter(c => c === id).length, 0);
  if (cb.multiplyEffectCardId != null) { const n = worn(cb.multiplyEffectCardId); return vars.map(v => v * n); }
  if (cb.negateCardId != null) { const n = worn(cb.negateCardId); return vars.map(v => v * (1 - n)); }
  return vars;
}
function cardTip(card) {
  if (!card) return '';
  const bl = card.bonuses.map(cb => bonusText({ typeId: cb.typeId, vars: cardBonusVarsForDisplay(cb) }));
  return `<b>${esc(card.name)}</b> <span class="m">${esc(cardTypeLabel(card))}</span>\n<span class="g">${bl.map(esc).join('\n')}</span>`;
}
const talentVars = new Map();
for (const v of RQDATA.TalentVariable || []) { if (!talentVars.has(v.Talent_Id)) talentVars.set(v.Talent_Id, []); talentVars.get(v.Talent_Id)[v.Index] = v.Value; }
function talentText(t) {
  const vars = talentVars.get(t.id) || [];
  const sub = s => String(s || '').replace(/\{(\d+)\}/g, (_, n) => vars[+n] ?? '?').replace(/◊/g, '• ');
  let s = `<b>${esc(t.name)}</b>${t.active ? ` <span class="m">(${esc(T.activeTalent)})</span>` : ''}\n${esc(sub(t.description))}`;
  if (t.passiveDescription) s += `\n<span class="m">${esc(sub(t.passiveDescription))}</span>`;
  if (t.equipmentCondition) s += `\n<span class="m">${esc(t.equipmentCondition)}</span>`;
  return s;
}

// ---------- top bar ----------
// line icons for the top bar buttons (24×24, drawn with the text color)
const TOP_ICONS = {
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7.5 3v4.5h7V3"/><rect x="7" y="13" width="10" height="6" rx="1"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/>',
  new: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M12 12v6M9 15h6"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z"/><circle cx="8" cy="8" r="1.4"/>',
  // dizzy spiral with stars (crowd control)
  stun: '<path d="M12.5 12.2a1.6 1.6 0 1 1-1.4-2.2 3.4 3.4 0 1 1-3 4.6 5.2 5.2 0 1 1 9.4 1.6"/><path d="M5 4.5l.6 1.3 1.4.2-1 1 .2 1.4L5 7.7l-1.2.7.2-1.4-1-1 1.4-.2zM19 3.5l.5 1 1 .1-.7.7.2 1-1-.5-.9.5.2-1-.7-.7 1-.1z"/>',
  // tabs
  gear: '<path d="M12 3l7.5 3v5.5c0 4.4-3.1 7.9-7.5 9.5-4.4-1.6-7.5-5.1-7.5-9.5V6z"/><path d="M12 7.5v9M8.5 11h7"/>',
  talents: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
  effects: '<path d="M9.5 3h5M10.5 3v5.6L5.4 17.4A2.4 2.4 0 0 0 7.5 21h9a2.4 2.4 0 0 0 2.1-3.6l-5.1-8.8V3"/><path d="M7.4 14.5h9.2"/>',
  collection: '<path d="M7.5 4h9v5.5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6.5H5a2.8 2.8 0 0 0 3 3.6M16.5 6.5H19a2.8 2.8 0 0 1-3 3.6M12 14v3.5M8.5 20.5h7M9.5 17.5h5v3h-5z"/>',
  // boss timer
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/><path d="M12 3v2"/>',
  bug: '<rect x="7.5" y="7" width="9" height="12" rx="4.5"/><path d="M12 11v8M9 4.5l1.5 2.5M15 4.5l-1.5 2.5M7.5 11H4M7.5 15H4.5M16.5 11H20M16.5 15h3M7.8 18.5 5 20.5M16.2 18.5l2.8 2"/>',
  news: '<path d="M4 5h13v13.5a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v9.5a2 2 0 0 1-4 0"/><path d="M7 8.5h7M7 12h7M7 15.5h4"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7.5h8M8 11h6"/>',
  coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v3.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path d="M3.5 10.5V14c0 1.4 2.5 2.5 5.5 2.5"/><ellipse cx="15" cy="14" rx="5.5" ry="2.5"/><path d="M9.5 14v3.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V14"/>',
  skull: '<path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.6 3 5.8V19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2.7c1.7-1.2 3-3.2 3-5.8A7.5 7.5 0 0 0 12 3z"/><circle cx="9.2" cy="11" r="1.6"/><circle cx="14.8" cy="11" r="1.6"/><path d="M10.5 20v-2.5M13.5 20v-2.5M11.2 14.8l.8-1.3.8 1.3"/>',
  group: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5"/><circle cx="16.5" cy="9" r="2.4"/><path d="M15.5 14.6c2.6-.3 4.6 1.3 5 4.4"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  calc: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><rect x="7.5" y="5" width="9" height="4" rx=".8"/><path d="M8.5 12.5h.01M12 12.5h.01M15.5 12.5h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01M8.5 18.5h.01M12 18.5h.01M15.5 18.5h.01" stroke-width="2.4"/>',
  // settings (cog)
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.5 2.3 2.7-.6.6 2.7 2.3 1.5-1.2 2.5 1.2 2.5-2.3 1.5-.6 2.7-2.7-.6L12 21.2l-1.5-2.3-2.7.6-.6-2.7-2.3-1.5L6.1 12.8 4.9 10.3l2.3-1.5.6-2.7 2.7.6z"/>',
};
// the same icons as DOM elements, for h(...)
function iconEl(name) { const t = document.createElement('template'); t.innerHTML = svgIcon(name); return t.content.firstChild; }
const svgIcon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${TOP_ICONS[name]}</svg>`;
function topButton(id, icon, label, menu = false) {
  $(id).innerHTML = svgIcon(icon) + `<span>${esc(label)}</span>` + (menu ? svgIcon('down', 'ic caret') : '');
}

function renderTop() {
  document.documentElement.lang = lang;
  $('appTitle').textContent = T.title;
  document.title = T.title + (IS_TEST ? ' — ТЕСТ' : '');
  if (IS_TEST && !$('testBadge')) $('appTitle').after(h('span', { id: 'testBadge', class: 'test-badge', title: T.testTip }, 'ТЕСТ'));
  $('buildName').placeholder = T.buildName;
  $('buildName').value = buildName;
  topButton('btnSave', 'save', T.save);
  topButton('btnBuilds', 'folder', T.builds, true);
  topButton('btnNew', 'new', T.newBuild);
  topButton('btnCode', 'code', T.code);
  topButton('btnPublic', 'globe', T.publicBuilds);
  $('btnPublic').classList.toggle('on', tab === 'builds');
  // tools: the brand opens the list (calculator, boss timer, …); the timer hides the calculator's buttons
  if (!$('brandBtn').querySelector('.caret')) $('brandBtn').insertAdjacentHTML('beforeend', svgIcon('down', 'ic caret'));
  $('brandBtn').title = T.toolsTip;
  const tool = toolOfTab(tab);
  document.body.classList.toggle('tool-timer', !!tool); // hides the calculator's buttons
  $('toolName').hidden = !tool;
  if (tool) $('toolName').innerHTML = svgIcon(tool.icon) + `<span>${esc(tool.name())}</span>`;
  $('btnSettings').innerHTML = svgIcon('cog'); $('btnSettings').title = T.settings;
  $('btnBug').innerHTML = svgIcon('bug'); $('btnBug').title = RT().btn;
  drawNewsBell();
  drawSteamButton();
  drawMobileNav();
  // the game forum (royalquest.net), with its emblem
  $('btnForum').querySelector('span').textContent = lang === 'en' ? 'Forum' : 'Форум';
  $('btnForum').title = lang === 'en' ? 'Royal Quest forum' : 'Форум Royal Quest';
  if (settingsLang !== lang) { settingsLang = lang; applySettings(); } // tray menu texts follow the language
  const ls = $('langSwitch'); ls.innerHTML = ''; ls.title = T.language;
  for (const [k, label] of [['uk', 'УКР'], ['ru', 'РУС'], ['en', 'ENG']]) {
    ls.append(h('button', { class: k === lang ? 'on' : '', onclick: () => { lang = k; T = RQC_I18N[k]; store.set('lang', k); applyGameLang(); recalc(); renderAll(); } }, label));
  }
}
$('buildName').addEventListener('input', e => { buildName = e.target.value; store.set('currentName', buildName); });
$('btnSave').addEventListener('click', () => {
  const name = (buildName || '').trim() || `${ctx.classes.get(ch.classId).name} ${ch.level}`;
  buildName = name; store.set('currentName', name); $('buildName').value = name;
  const builds = store.get('builds', []).filter(b => b.name !== name);
  builds.unshift({ name, ch, savedAt: Date.now() });
  store.set('builds', builds);
  toast(T.saved);
});
// community builds open in the center area
$('btnPublic').addEventListener('click', () => {
  tab = tab === 'builds' ? 'gear' : 'builds'; store.set('tab', tab);
  renderCenter(); animateEnter($('center')); renderTop();
});
// settings (app/settings.js)
let settingsLang = null;
$('btnSettings').addEventListener('click', () => openSettings());
$('btnBug').addEventListener('click', () => openReport());
$('btnNews').addEventListener('click', e => { e.stopPropagation(); openNews(); });
// ---------- tools (the brand menu): the calculator and the boss timer; more can be added to TOOLS ----------
// phones: the calculator's columns stack, this bar jumps between them
function drawMobileNav() {
  const nav = $('mobileNav');
  if (!nav) return;
  nav.innerHTML = '';
  for (const [id, icon, label] of [['left', 'gear', T.character], ['center', 'collection', T.tabGear], ['right', 'calc', T.results]]) {
    nav.append(h('button', { onclick: () => { const el = id === 'center' ? document.querySelector('.center') : $(id); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, iconEl(icon), h('span', null, label)));
  }
}
// a tool other than the calculator owns one `tab` value and takes the whole window
const TOOLS = [
  { id: 'calc', icon: 'calc', name: () => T.toolCalc, sub: () => T.toolCalcSub },
  { id: 'timer', tab: 'bosses', icon: 'skull', name: () => T.toolTimer, sub: () => T.toolTimerSub },
  { id: 'market', tab: 'market', icon: 'coins', name: () => MT().title, sub: () => MT().sub },
  { id: 'base', tab: 'base', icon: 'book', name: () => BTX().title, sub: () => BTX().sub },
  { id: 'steam', tab: 'steam', icon: 'news', name: () => STX().title, sub: () => STX().sub },
];
const toolOfTab = t => TOOLS.find(x => x.tab && x.tab === t);
const curTool = () => toolOfTab(tab)?.id || 'calc';
function switchTool(id) {
  if (id === curTool()) return;
  const tool = TOOLS.find(x => x.id === id);
  if (!toolOfTab(tab)) store.set('calcTab', tab);
  if (tool.tab) tab = tool.tab;
  else { tab = store.get('calcTab', 'gear'); if (toolOfTab(tab)) tab = 'gear'; }
  store.set('tab', tab);
  renderCenter(); animateEnter($('center')); renderTop();
}
$('brandBtn').addEventListener('click', e => {
  e.stopPropagation();
  const menu = $('toolsMenu');
  if (!menu.hidden) { menu.hidden = true; $('brandBtn').classList.remove('open'); return; }
  menu.innerHTML = '';
  for (const t of TOOLS) {
    const on = t.id === curTool();
    menu.append(h('button', { class: 'tool-item' + (on ? ' on' : ''), onclick: () => { menu.hidden = true; $('brandBtn').classList.remove('open'); switchTool(t.id); } },
      h('span', { class: 'tool-ic' }, iconEl(t.icon)),
      h('span', { class: 'tool-txt' }, h('b', null, t.name()), h('small', null, t.sub())),
      on ? h('span', { class: 'tool-on' }, '✓') : null));
  }
  menu.append(h('div', { class: 'tool-more' }, T.toolMore));
  menu.hidden = false; $('brandBtn').classList.add('open');
});
document.addEventListener('click', e => { const m = $('toolsMenu'); if (!m.hidden && !m.contains(e.target)) { m.hidden = true; $('brandBtn').classList.remove('open'); } });
$('btnNew').addEventListener('click', async () => {
  if (!await confirmBox(T.newAsk, { ok: T.newBuild })) return;
  ch = ctx.defaultCharacter(); buildName = ''; store.set('currentName', ''); baseline = null; previous = null; lastResult = null;
  recalc(); store.set('current', ch); renderAll();
});
$('btnBuilds').addEventListener('click', e => {
  e.stopPropagation();
  const menu = $('buildsMenu');
  if (!menu.hidden) { menu.hidden = true; return; }
  menu.innerHTML = '';
  const builds = store.get('builds', []);
  if (!builds.length) menu.append(h('div', { class: 'empty' }, T.noBuilds));
  for (const b of builds) {
    const cls = ctx.classes.get(b.ch.classId);
    menu.append(h('div', { class: 'row' },
      img(cls?.imageId, 'mini'),
      h('div', { class: 'nm', onclick: () => { loadBuild(b); menu.hidden = true; } }, b.name, h('div', { class: 'sub' }, `${cls?.name || ''} · ${b.ch.level} · ${new Date(b.savedAt).toLocaleDateString()}`)),
      h('button', { class: 'btn small ghost danger', onclick: async ev => {
        ev.stopPropagation();
        menu.hidden = true;
        if (!await confirmBox(fmtT(T.delAsk, { name: b.name }), { ok: T.del, danger: true })) return;
        store.set('builds', store.get('builds', []).filter(x => x.name !== b.name));
        menu.hidden = true; $('btnBuilds').click();
      } }, '✕')));
  }
  menu.querySelectorAll('img.mini').forEach(i => { i.style.width = '28px'; i.style.height = '28px'; i.style.borderRadius = '6px'; });
  menu.hidden = false;
});
document.addEventListener('click', e => { const m = $('buildsMenu'); if (!m.hidden && !m.contains(e.target)) m.hidden = true; });
function loadBuild(b) {
  const c = normalize(JSON.parse(JSON.stringify(b.ch)));
  if (!c) return;
  ch = c; buildName = b.name; store.set('currentName', b.name); previous = null; lastResult = null;
  recalc(); store.set('current', ch); renderAll();
}

// build codes: "RQC1." + base64(JSON)
function encodeBuild() {
  const c = JSON.parse(JSON.stringify(ch));
  return 'RQC1.' + btoa(unescape(encodeURIComponent(JSON.stringify({ n: buildName, c }))));
}
function decodeBuild(code) {
  const m = String(code).trim().match(/^RQC1\.([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  try { const o = JSON.parse(decodeURIComponent(escape(atob(m[1])))); const c = normalize(o.c); return c ? { name: o.n || '', ch: c } : null; } catch { return null; }
}
// build links: https://rqcalc.com/#b=<the build as JSON, deflated, base64url> — the site opens that build
const b64url = bytes => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function buildLink() {
  const json = JSON.stringify({ n: buildName, c: JSON.parse(JSON.stringify(ch)) });
  const z = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  return SITE_URL + '#b=' + b64url(z);
}
async function readBuildLink(hash) {
  const m = String(hash || '').match(/#b=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const bytes = Uint8Array.from(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), x => x.charCodeAt(0));
    const o = JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text());
    const c = normalize(o.c);
    return c ? { name: o.n || '', ch: c } : null;
  } catch { return null; }
}

// "for the forum": the build as a BBCode post (royalquest.net is SMF 2.1: b, color, size, list, url) with its link
async function forumPost() {
  const r = recalc();
  const val = id => { const s = ctx.stats.get(id), v = r.stats.get(id); return s && v != null ? fmtStat(s, v) : '—'; };
  const sname = id => ctx.stats.get(id)?.name || '';
  const cls = ctx.classes.get(ch.classId);
  const name = (buildName || '').trim() || `${cls.name} ${ch.level}`;
  const order = k => { const i = SLOT_ORDER.indexOf(k); return i < 0 ? 99 : i; };
  const gear = Object.keys(ch.equipment).sort((a, b) => order(a) - order(b)).map(key => {
    const e = ch.equipment[key], item = e && ctx.equipment.get(e.itemId);
    if (!item || slotLockedByTwoHander(ch, key)) return null;
    const slot = ctx.slots.get(+key.split(':')[0])?.name || '';
    const sv = e.stampVariantId && ctx.stampVariants.get(e.stampVariantId);
    const stamp = sv && ctx.stamps.get(sv.stampId)?.name;
    const cards = (e.cards || []).map(id => id && ctx.cards.get(id)?.name).filter(Boolean);
    return `[li]${slot}: [b]${e.upgrade ? `+${e.upgrade} ` : ''}${item.name}[/b]${stamp ? ` · ${T.stamp.toLowerCase()}: ${stamp}` : ''}${cards.length ? ` · ${T.cards.toLowerCase()}: ${cards.join(', ')}` : ''}[/li]`;
  }).filter(Boolean);
  const main = [[75, true], [ctx.ids.HP], [76], [ctx.ids.ATTACK], [ctx.ids.DEFENSE]]
    .map(([id, hero]) => `${sname(id)}: ${hero ? '[color=#e6b85c]' : ''}[b]${val(id)}[/b]${hero ? '[/color]' : ''}`).join(' · ');
  return [
    `[size=14pt][b]${name}[/b][/size]`,
    `${cls.name}, ${T.level.toLowerCase()} ${ch.level}`,
    main,
    gear.length ? `[list]${gear.join('')}[/list]` : '',
    `[url=${await buildLink()}]${T.forumOpen}[/url]`,
  ].filter(Boolean).join('\n');
}
const copyText = (text, msg) => navigator.clipboard.writeText(text).then(() => toast(msg), () => toast(T.copyFailed));

$('btnCode').addEventListener('click', () => {
  const area = h('textarea', { class: 'code-area', spellcheck: false, readOnly: false });
  area.value = encodeBuild();
  const err = h('div', { class: 'warn', style: 'margin-top:6px' });
  openModal(h('div', { class: 'dialog narrow' },
    h('div', { class: 'dialog-head' }, h('h3', null, T.codeTitle), h('button', { class: 'btn small ghost', onclick: closeModal }, '✕')),
    h('div', { class: 'dialog-body' }, h('div', { class: 'hint', style: 'margin:0 0 8px' }, T.codeHelp), area, err),
    h('div', { class: 'dialog-foot' },
      h('button', { class: 'btn', onclick: () => { navigator.clipboard.writeText(area.value).then(() => toast(T.copied)); } }, T.copy),
      h('button', { class: 'btn', title: T.linkTip, onclick: async () => copyText(await buildLink(), T.linkCopied) }, T.copyLink),
      h('button', { class: 'btn', title: T.forumTip, onclick: async () => copyText(await forumPost(), T.forumCopied) }, T.forBtn),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn primary', onclick: () => {
        const b = decodeBuild(area.value);
        if (!b) { err.textContent = T.badCode; return; }
        closeModal(); loadBuild({ name: b.name, ch: b.ch });
      } }, T.load))));
  area.select();
});

// ---------- left: character ----------
// which equipped items give bonuses during an event; click to switch to that event
// tooltip: what exactly the item gives during this event
function eventHintTip(item, ev, evt, on) {
  const lines = item.bonuses.filter(b => EVENT_OF_TYPE.get(b.typeId) === ev).map(b => `<span class="g">${esc(bonusText(b))}</span>`
    + (ctx.bonusTypes.get(b.typeId).stats.length ? '' : ` <span class="m">(${esc(T.notCounted)})</span>`));
  return [`<b>${esc(item.name)}</b>`, `<span class="m">${esc(evt ? evt.Name : '')}</span>`, ...lines, `<span class="m">${esc(on ? T.clickToDisable : T.clickToEnable)}</span>`].join('\n');
}
// With an event selected: only the worn items of that event. Without one: every worn event item.
function eventHints() {
  let rows = [];
  for (const e of Object.values(ch.equipment)) {
    const item = e && ctx.equipment.get(e.itemId);
    if (!item) continue;
    for (const ev of itemEvents(item)) rows.push({ item, ev });
  }
  if (ch.eventId) {
    rows = rows.filter(r => r.ev === ch.eventId);
    if (!rows.length) return h('div', { class: 'ev-hints' }, h('div', { class: 'ev-none' }, T.noEventItems));
  }
  if (!rows.length) return null;
  return h('div', { class: 'ev-hints' }, rows.map(({ item, ev }) => {
    const evt = ctx.events.find(x => x.Id === ev);
    const on = ch.eventId === ev;
    return h('div', { class: 'ev-hint' + (on ? ' on' : ''), tip: () => eventHintTip(item, ev, evt, on), onclick: () => changed(c => { c.eventId = on ? null : ev; }) },
      h('span', null, on ? '✓ ' : '◇ '), h('b', null, item.name), ' — ', evt ? evt.Name : '');
  }));
}
// class picker: four columns (base class + its two specializations) with icons and level ranges
// Class list with icons. Used for the character's class and for the class filter of public builds
// (opts.allLabel adds an "all classes" item that picks null).
function openClassPicker(anchor, opts = {}) {
  if (!popoverToggle(anchor)) return;
  const cur = 'current' in opts ? opts.current : ch.classId;
  const pick = opts.onPick || (id => { if (id !== ch.classId) changed(() => setClass(id)); });
  const roots = [...ctx.classes.values()].filter(c => c.baseId == null);
  const card = (c, sub) => h('div', {
    class: 'cp-item' + (sub ? ' sub' : '') + (c.id === cur ? ' on' : ''),
    onclick: () => { closePopover(); pick(c.id); },
  }, img(c.imageId), h('div', null, h('div', { class: 'cp-name' }, c.name), h('div', { class: 'cp-lv' }, opts.sub ? opts.sub(c) : `${T.lvl} ${c.minLevel}–${c.maxLevel}`)));
  popover = h('div', { class: 'pop cp' },
    opts.allLabel ? h('div', { class: 'cp-item cp-all' + (cur == null ? ' on' : ''), onclick: () => { closePopover(); pick(null); } },
      h('span', { class: 'cp-all-ic' }, iconEl('globe')), h('div', { class: 'cp-name' }, opts.allLabel)) : null,
    h('div', { class: 'cp-grid' }, roots.map(r => h('div', { class: 'cp-col' },
      card(r, false), h('div', { class: 'cp-subs' }, r.children.map(id => card(ctx.classes.get(id), true)))))));
  document.body.append(popover);
  const rc = anchor.getBoundingClientRect();
  popover.style.left = Math.max(8, Math.min(rc.left, innerWidth - popover.offsetWidth - 8)) + 'px';
  popover.style.top = rc.bottom + 6 + 'px';
}
function renderLeft() {
  const el = $('left'); el.innerHTML = '';
  const cls = ctx.classes.get(ch.classId);

  const classSel = h('button', { class: 'cls-btn', type: 'button', onclick: e => openClassPicker(e.currentTarget) },
    img(cls.imageId), h('span', null, cls.name), h('span', { class: 'pb-arrow' }, '▾'));
  const lvlRange = h('input', { type: 'range', min: cls.minLevel, max: cls.maxLevel, value: ch.level });
  const lvlInp = h('input', { class: 'inp', type: 'number', min: cls.minLevel, max: cls.maxLevel, value: ch.level });
  const setLevel = v => changed(c => { c.level = clamp(+v || cls.minLevel, cls.minLevel, cls.maxLevel); if (c.auraId && !ctx.classAuras(c.classId, c.level).some(a => a.id === c.auraId)) c.auraId = null; pruneBuffs(); });
  lvlRange.addEventListener('input', () => { lvlInp.value = lvlRange.value; });
  lvlRange.addEventListener('change', () => setLevel(lvlRange.value));
  lvlInp.addEventListener('change', () => setLevel(lvlInp.value));

  const seg = (items, cur, on) => h('div', { class: 'seg' }, items.map(([v, label]) => h('button', { class: v === cur ? 'on' : '', onclick: () => on(v) }, label)));
  const eventSel = h('select', { onchange: e => changed(c => { c.eventId = e.target.value ? +e.target.value : null; }) },
    h('option', { value: '' }, T.none), ctx.events.map(ev => h('option', { value: ev.Id, selected: ev.Id === ch.eventId }, ev.Name)));

  el.append(h('div', { class: 'box' },
    h('div', { class: 'class-head' }, img(cls.imageId), h('div', null, h('div', { class: 'nm' }, cls.name), h('div', { class: 'sub' }, `${T.level} ${ch.level}`))),
    h('div', { class: 'field' }, h('label', null, T.cls), classSel),
    h('div', { class: 'field' }, h('label', null, T.level), h('div', { class: 'level-row' }, lvlRange, lvlInp)),
    h('div', { class: 'field' }, h('label', null, T.gender), seg(ctx.genders.map(g => [g.Id, g.Name]), ch.genderId, v => changed(c => { c.genderId = v; }))),
    h('div', { class: 'field' }, h('label', null, T.state), seg(ctx.states.map(s => [s.Id, s.Name]), ch.stateId, v => changed(c => { c.stateId = v; }))),
    h('div', { class: 'field' }, h('label', null, T.event), eventSel),
    eventHints(),
    // "under crowd control": a switch card; turns on item bonuses that only work while stunned etc.
    h('label', { class: 'lc' + (ch.lostControl ? ' on' : ''), title: T.lostControl },
      h('input', { type: 'checkbox', checked: !!ch.lostControl, onchange: e => changed(c => { c.lostControl = e.target.checked; }) }),
      h('span', { class: 'lc-ic' }, iconEl('stun')),
      h('span', { class: 'lc-text' }, h('b', null, T.lcTitle), h('small', null, T.lcSub)),
      h('span', { class: 'sw' })),
  ));

  // attributes are spent with +/− on the mastery bars in the stat sheet (right panel)
}

// ---------- center ----------
const SLOT_ORDER = ['1:0', '2:0', '3:0', '4:0', '5:0', '6:0', '21:0', '7:0', '22:0', '12:0', '11:0', '11:1', '9:0', '10:0', '13:0', '14:0', '15:0'];
function renderTabs() {
  const el = $('tabs'); el.innerHTML = '';
  const eqCount = Object.keys(ch.equipment).length;
  const talCount = validTalents(ch).length;
  const effCount = Object.keys(ch.buffs).length + (ch.auraId ? 1 : 0) + Object.keys(ch.sharedAuras || {}).length + (ch.elixirId ? 1 : 0) + ch.consumables.length;
  for (const [k, label, n] of [['gear', T.tabGear, eqCount], ['talents', T.tabTalents, talCount], ['effects', T.tabEffects, effCount], ['collection', T.tabCollection, ch.collected.length]]) {
    el.append(h('button', { class: 'tab' + (tab === k ? ' on' : ''), onclick: () => { if (tab === k) return; tab = k; store.set('tab', k); renderCenter(); animateEnter($('center')); renderTop(); } }, iconEl(k), label, n ? h('span', { class: 'n' }, n) : null));
  }
}
// fade the content in only when the tab changes, not on every update (that made pictures blink)
function animateEnter(el) {
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  setTimeout(() => el.classList.remove('enter'), 250);
}
function renderCenter() {
  // the boss timer has nothing to do with the character: it takes the whole window
  document.querySelector('.layout').classList.toggle('wide', !!toolOfTab(tab));
  renderTabs();
  const el = $('center'); const scroll = el.scrollTop; el.innerHTML = '';
  if (tab === 'gear') renderGear(el);
  else if (tab === 'talents') renderTalents(el);
  else if (tab === 'effects') renderEffects(el);
  else if (tab === 'builds') renderBuilds(el);
  else if (tab === 'bosses') renderBosses(el);
  else if (tab === 'market') renderMarket(el);
  else if (tab === 'base') renderBase(el);
  else if (tab === 'steam') renderSteamNews(el);
  else renderCollection(el);
  el.scrollTop = scroll;
}

// Character window like in the game: grid positions [column, row] for each slot.
// Left: head, face, armor, gloves, legs, boots, weapon. Right: decoration, amulet, rings, totem, artifact.
// Bottom row: left hand and spear. Decorations, costume and mount sit in a separate "Украшения" block.
const DOLL_POS = {
  '1:0': [1, 1], '2:0': [1, 2], '3:0': [1, 3], '4:0': [1, 4], '5:0': [1, 5], '6:0': [1, 6], '21:0': [1, 7],
  '14:0': [3, 1], '13:0': [4, 1], '12:0': [4, 2], '11:0': [4, 3], '11:1': [4, 4], '10:0': [4, 5], '9:0': [4, 6],
  '15:0': [2, 7], '7:0': [3, 7], '22:0': [4, 7],
};
const DECOR_KEYS = [];

function slotIcon(key, sets) {
  const slot = ctx.slots.get(+key.split(':')[0]);
  const e = ch.equipment[key];
  const item = e && ctx.equipment.get(e.itemId);
  const locked = slotLockedByTwoHander(ch, key);
  const off = slot.stateId != null && slot.stateId !== ch.stateId;
  const bad = item && !sets.get(key).has(item.id);
  const stampV = item && e.stampVariantId && ctx.stampVariants.get(e.stampVariantId);
  const cardsN = item ? (e.cards || []).filter(Boolean).length : 0;
  const tip = () => {
    if (item) return itemTip(item, e) + (off ? `\n<span class="m">${esc(T.notActive)}</span>` : '');
    return `<b>${esc(slot.name)}</b>\n<span class="m">${esc(locked ? T.twoHanded : (off ? T.notActive : T.clickToPick))}</span>`;
  };
  return h('div', {
    style: stampV && stampV.color ? '--sc:' + stampV.color.Argb : null,
    class: 'gslot' + J('slot:' + key) + (stampV ? ' stamped' : '') + (item ? ' full' : '') + (off ? ' off' : '') + (bad ? ' bad' : '') + (locked ? ' locked' : ''),
    tip, onclick: () => { if (!locked) openEditor(key); },
  },
    h('div', { class: 'gs-img', style: item ? `background-image:url('${IMG(item.imageId)}')` : (slot.imageId ? `background-image:url('${IMG(slot.imageId)}')` : '') }),
    item && e.upgrade ? h('span', { class: 'gs-up' }, '+' + e.upgrade) : null,
    stampV ? h('i', { class: 'gs-stamp', style: `background:${stampV.color?.Argb || '#999'}` }) : null,
    cardsN ? h('span', { class: 'gs-cards' }, '◆'.repeat(cardsN)) : null,
    item ? procCorner(e, stampV) : null);
}

// checkbox in the slot corner for effects that cards/stamps trigger with a chance (e.g. «Пружинка»)
function itemProcBuffs(e, stampV) {
  const cardIds = new Set((e.cards || []).filter(Boolean));
  return [...ctx.buffs.values()].filter(b => b.inVersion && ((b.cardId != null && cardIds.has(b.cardId)) || (stampV && b.stampId === stampV.stampId)));
}
function procCorner(e, stampV) {
  const list = itemProcBuffs(e, stampV);
  if (!list.length) return null;
  const on = list.every(b => ch.buffs[b.id]);
  const effectText = b => b.bonuses.map(x => bonusText({ typeId: x.typeId, vars: x.vars.map(v => v * Math.max(1, ch.buffs[b.id] || b.maxStack)) })).join(', ');
  const tip = () => [`<b>${esc(T.procActive)}</b>`,
    ...list.map(b => `<span class="g">${esc(effectText(b))}</span> <span class="m">— ${esc(b.name)}</span>`),
    ch.enableBuffs ? '' : `<span class="m">${esc(T.buffsOff)}</span>`].filter(Boolean).join('\n');
  return h('label', { class: 'gs-proc' + (on ? ' on' : ''), tip, onclick: ev => ev.stopPropagation() },
    h('input', { type: 'checkbox', checked: on, onchange: ev => changed(c => { for (const b of list) { if (ev.target.checked) c.buffs[b.id] = b.maxStack; else delete c.buffs[b.id]; } }) }),
    h('span', { class: 'box' }));
}

// The character window grows with the free space: slot size is picked to fill the tab.
function fitCharWindow() {
  const body = $('center'), win = body.querySelector('.charwin');
  if (!win) return;
  const cs = getComputedStyle(win);
  const H = win.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const W = win.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  // moderate slots; the gaps and the model area take the rest, so the window fills the tab
  const s = clamp(Math.floor(Math.min(H / 8.4, W / 7)), 56, 72);
  const gy = clamp(Math.floor((H - 7 * s) / 6), 6, 24);
  const gx = clamp(Math.round(s * 0.12), 6, 12);
  const mw = clamp(W - 3 * s - 3 * gx, Math.round(s * 3.4), Math.round(s * 5.2));
  win.style.setProperty('--s', s + 'px');
  win.style.setProperty('--gy', gy + 'px');
  win.style.setProperty('--gx', gx + 'px');
  win.style.setProperty('--mw', mw + 'px');
}
window.addEventListener('resize', () => { if (tab === 'gear') fitCharWindow(); });

// backgrounds behind the character: parts of in-game locations (Steam screenshots), zoomed past the game HUD
const MODEL_BGS = [
  { id: 'tomb', size: 'auto 175%', pos: '30% 18%' },
  { id: 'jungle', size: 'auto 170%', pos: '62% 10%' },
  { id: 'crypt', size: 'auto 170%', pos: '20% 30%' },
  { id: 'snow', size: 'auto 170%', pos: '45% 8%' },
  { id: 'autumn', size: 'auto 165%', pos: '25% 25%' },
];
let modelBg = store.get('modelBg', 'tomb');
function renderModel() {
  const cls = ctx.classes.get(ch.classId);
  const costume = ch.equipment['14:0'] && ctx.equipment.get(ch.equipment['14:0'].itemId);
  const costumeImg = costume && costume.costumeImageId && (costume.genderId == null || costume.genderId === ch.genderId) ? costume.costumeImageId : null;
  const gender = ctx.genders.find(g => g.Id === ch.genderId);
  const figure = costumeImg || gender?.Image_Id;
  const mount = ch.equipment['15:0'] && ctx.equipment.get(ch.equipment['15:0'].itemId);
  const bg = MODEL_BGS.find(b => b.id === modelBg) || MODEL_BGS[0];
  return h('div', { class: 'model', style: 'grid-column: 2 / 4; grid-row: 1 / 7', tip: costume ? () => itemTip(costume, ch.equipment['14:0']) : null, onclick: () => openEditor('14:0') },
    h('div', { class: 'model-bg', style: `background-image:url('bg/${bg.id}.jpg');background-size:${bg.size};background-position:${bg.pos}` }),
    h('div', { class: 'model-shade' }),
    h('div', { class: 'bg-pick' }, MODEL_BGS.map(b => h('button', {
      class: b.id === bg.id ? 'on' : '', style: `background-image:url('bg/${b.id}.jpg');background-position:${b.pos}`, tip: esc(T.bgNames[b.id] || b.id),
      onclick: ev => { ev.stopPropagation(); modelBg = b.id; store.set('modelBg', b.id); renderCenter(); },
    }))),
    h('div', { class: 'model-cap' },
      h('div', { class: 'mc-name' }, cls.name),
      h('div', { class: 'mc-sub' }, `${ch.level} ${T.level.toLowerCase()} · ${gender?.Name || ''}${ch.stateId === 2 && mount ? ' · ' + mount.name : ''}`),
      costume ? h('div', { class: 'mc-sub' }, costume.name) : null),
    // costumes: sharper 2× pictures in data/costumes (tools/upscale-costumes.cjs), the small original if one is missing
    figure ? h('img', { class: 'model-fig' + (costumeImg ? '' : ' silhouette'), src: costumeImg ? `../data/costumes/${costumeImg}.png` : IMG(figure), draggable: 'false',
      onerror: costumeImg ? function () { if (this.dataset.fb) return; this.dataset.fb = 1; this.src = IMG(figure); } : null }) : null,
    h('div', { class: 'model-floor' }));
}
function renderGear(el) {
  const sets = allowedSets(ch);
  const keys = new Set(ctx.slotKeys());
  const cls = ctx.classes.get(ch.classId);
  const win = h('div', { class: 'charwin' });
  win.append(renderModel());
  win.append(h('div', { class: 'gs-emblem', style: 'grid-column: 2 / 4; grid-row: 7; justify-self: center' }, cls.artImageId ? h('img', { src: IMG(cls.artImageId), draggable: 'false' }) : null));
  for (const [key, [c, r]] of Object.entries(DOLL_POS)) {
    if (!keys.has(key)) continue;
    const s = slotIcon(key, sets);
    s.style.gridColumn = c; s.style.gridRow = r;
    if (key === '15:0') s.style.justifySelf = 'start'; // mount sits right next to the weapon
    if (key === '14:0') s.style.zIndex = 3; // costume sits in the model's top corner, next to the decoration
    win.append(s);
  }
  const decor = h('div', { class: 'decor' }, h('div', { class: 'decor-title' }, T.decorations),
    h('div', { class: 'decor-list' }, DECOR_KEYS.filter(k => keys.has(k)).map(k => slotCard(k, sets))));
  const others = ctx.slotKeys().filter(k => !(k in DOLL_POS) && !DECOR_KEYS.includes(k));
  if (others.length) decor.append(h('div', { class: 'decor-row' }, others.map(k => slotIcon(k, sets))));

  el.append(h('div', { class: 'gear-layout' }, h('div', { class: 'charwin-wrap' }, win, DECOR_KEYS.length || others.length ? decor : null)));
  requestAnimationFrame(fitCharWindow);
}
function slotCard(key, sets) {
  {
    const slot = ctx.slots.get(+key.split(':')[0]);
    const e = ch.equipment[key];
    const item = e && ctx.equipment.get(e.itemId);
    const locked = slotLockedByTwoHander(ch, key);
    const off = slot.stateId != null && slot.stateId !== ch.stateId;
    const bad = item && !sets.get(key).has(item.id);
    const chips = [];
    if (item) {
      if (e.stampVariantId && ctx.stampVariants.has(e.stampVariantId)) {
        const v = ctx.stampVariants.get(e.stampVariantId);
        chips.push(h('span', { class: 'chip stamp' }, h('i', { class: 'dot', style: `background:${v.color?.Argb || '#999'}` }), ctx.stamps.get(v.stampId).name));
      }
      for (const cid of e.cards || []) if (cid && ctx.cards.has(cid)) chips.push(h('span', { class: 'chip card' }, ctx.cards.get(cid).name));
    }
    const ico = h('div', { class: 'ico', style: item ? `background-image:url('${IMG(item.imageId)}')` : (slot.imageId ? `background-image:url('${IMG(slot.imageId)}');opacity:.35` : '') },
      item && e.upgrade ? h('span', { class: 'up' }, '+' + e.upgrade) : null);
    return h('div', {
      class: 'slot' + (off ? ' off' : '') + (bad ? ' bad' : '') + (locked ? ' locked' : ''),
      tip: item ? () => itemTip(item, e) : (locked ? esc(T.twoHanded) : null),
      onclick: () => { if (!locked) openEditor(key); },
    }, ico, h('div', { style: 'min-width:0' },
      h('div', { class: 'sn' }, slot.name + (off ? ' · ' + T.notActive : '')),
      h('div', { class: 'in' + (item ? '' : ' none') }, item ? item.name : (locked ? T.twoHanded : T.empty)),
      bad ? h('div', { class: 'warn' }, T.invalid) : null,
      h('div', { class: 'chips' }, chips)));
  }
}

// item editor
let editor = null;
function openModal(content) { const m = $('modal'); m.innerHTML = ''; m.append(content); m.hidden = false; }
function closeModal() { const k = editor && editor.key; $('modal').hidden = true; $('modal').innerHTML = ''; editor = null; flashOnce('slot:' + k, renderCenter); }
$('modal').addEventListener('mousedown', e => { if (e.target === $('modal')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').hidden) closeModal(); });

function openEditor(key) {
  const slot = ctx.slots.get(+key.split(':')[0]);
  editor = { key, search: '' };
  const search = h('input', { class: 'inp', placeholder: T.search, spellcheck: false });
  search.addEventListener('input', () => { editor.search = search.value; renderEditorList(); });
  openModal(h('div', { class: 'dialog' },
    h('div', { class: 'dialog-head' }, h('h3', null, slot.name), h('button', { class: 'btn small ghost', onclick: closeModal }, '✕')),
    h('div', { class: 'dialog-body' },
      h('div', { class: 'picker' }, search, h('div', { class: 'list', id: 'edList' })),
      h('div', { class: 'detail', id: 'edDetail' })),
    h('div', { class: 'dialog-foot' },
      ctx.slots.get(+key.split(':')[0]).count > 1 ? h('button', { class: 'btn', style: 'margin-right:auto', onclick: () => copyToTwin(key) }, T.copyTwin) : null,
      h('button', { class: 'btn danger', onclick: () => changed(c => { delete c.equipment[key]; }, { center: false, after: () => { renderEditorList(); renderEditorDetail(); } }) }, T.remove),
      h('button', { class: 'btn primary', onclick: closeModal }, T.done))));
  renderEditorList(); renderEditorDetail();
  setTimeout(() => { search.focus(); document.querySelector('#edList .li.on')?.scrollIntoView({ block: 'center' }); }, 0);
}
function renderEditorList() {
  const list = $('edList'); if (!list) return;
  list.innerHTML = '';
  const cur = ch.equipment[editor.key];
  const items = ctx.itemsForSlot(ch, editor.key).filter(i => matches(editor.search, i.name, ctx.eqTypes.get(i.typeId).name, itemBonusLines(i).map(x => x.text).join(' ')));
  if (!items.length) list.append(h('div', { class: 'hint', style: 'padding:10px' }, T.noItems));
  for (const item of items.slice(0, 400)) {
    const t = ctx.eqTypes.get(item.typeId);
    const sub = [t.name];
    if (item.info?.attack) sub.push(`${T.attack} ${item.info.attack}`);
    if (item.info?.defense) sub.push(`${T.defense} ${item.info.defense}`);
    list.append(h('div', { class: 'li' + J('li:' + item.id) + (cur && cur.itemId === item.id ? ' on' : ''), tip: () => itemTip(item), onclick: () => pickItem(item) },
      img(item.imageId), h('div', null, h('div', { class: 't' }, item.name), h('div', { class: 's' }, sub.join(' · '))), h('div', { class: 'lv' }, item.level)));
  }
}
function pickItem(item) {
  flash = 'li:' + item.id;
  changed(c => {
    const old = c.equipment[editor.key] || {};
    const e = { itemId: item.id, upgrade: clamp(old.upgrade || 0, 0, ctx.maxUpgrade(item)), cards: [] };
    if (old.stampVariantId) { const v = ctx.stampVariants.get(old.stampVariantId); if (v && ctx.stampAllowed(ctx.stamps.get(v.stampId), item, c.classId)) e.stampVariantId = old.stampVariantId; }
    const n = ctx.cardCount(item);
    for (let i = 0; i < n; i++) { const cid = (old.cards || [])[i]; const card = cid && ctx.cards.get(cid); e.cards.push(card && ctx.cardAllowedOn(card, item) && (card.elementId == null || i === 0) ? cid : null); }
    if (item.primaryCardId) e.cards[0] = item.primaryCardId;
    if (ctx.slots.get(ctx.eqTypes.get(item.typeId).slotId).isWeapon == null) { e.upgrade = 0; e.cards = []; }
    c.equipment[editor.key] = e;
    // a two-handed weapon frees the left hand
    if (slotLockedByTwoHander(c, ctx.reverseKey(editor.key) || '')) delete c.equipment[ctx.reverseKey(editor.key)];
  }, { center: false, after: () => { renderEditorList(); renderEditorDetail(); } });
}
// ---------- picker with descriptions (stamps, cards) ----------
// card groups in the order players expect: boss cards first
const CARD_TYPE_ORDER = ['Boss', 'Ellite', 'Blood', 'Premium', 'Main', 'Fire', 'Water', 'Earth', 'Air', 'Chaos', 'Poison', 'Transmute', 'Zeebo'];
const cardRank = c => { const i = CARD_TYPE_ORDER.indexOf(c.cardTypeName); return i < 0 ? 99 : i; };
// series like «Карта Пружинки I…X» sort by their level, not alphabetically
const cardOrder = (a, b) => a.rank - b.rank || (a.series || a.name).localeCompare(b.series || b.name, 'ru') || (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0) || a.name.localeCompare(b.name, 'ru');
const cardOption = c => ({
  rank: cardRank(c), series: c.groupKey, seriesOrder: c.groupOrder,
  id: c.id, name: c.name, group: cardTypeLabel(c), icon: c.imageId,
  sub: c.bonuses.map(cb => bonusText({ typeId: cb.typeId, vars: cardBonusVarsForDisplay(cb) })).join('\n'),
});
function pickerButton(cur, onOpen, flashKey) {
  const btn = h('button', { class: 'pickbtn' + (onOpen ? '' : ' fixed') + (flashKey ? J(flashKey) : ''), type: 'button' },
    cur?.dot ? h('i', { class: 'dot', style: `background:${cur.dot}` }) : null,
    cur?.icon ? h('img', { class: 'pop-ic', src: IMG(cur.icon), draggable: 'false' }) : null,
    h('div', { class: 'pb-main' }, h('div', { class: 'pb-name' + (cur ? '' : ' none') }, cur ? cur.name : T.none), cur?.sub ? h('div', { class: 'pb-sub' }, cur.sub) : null),
    onOpen ? h('span', { class: 'pb-arrow' }, '▾') : null);
  if (onOpen) btn.addEventListener('click', () => onOpen(btn));
  return btn;
}
let popover = null, popAnchor = null, popToggledOff = null;
function closePopover() { if (popover) { popover.remove(); popover = null; popAnchor = null; } }
// A second click on the button that opened the popover closes it instead of reopening it.
function popoverToggle(anchor) {
  const off = popToggledOff === anchor;
  popToggledOff = null;
  if (off) return false;
  closePopover(); popAnchor = anchor;
  return true;
}
function openPopover(anchor, options, curId, onPick) {
  if (!popoverToggle(anchor)) return;
  const search = h('input', { class: 'inp', placeholder: T.search, spellcheck: false });
  const list = h('div', { class: 'pop-list' });
  const pick = id => { closePopover(); onPick(id); };
  const draw = () => {
    const q = search.value;
    list.innerHTML = '';
    list.append(h('div', { class: 'pop-opt' + (curId == null ? ' on' : ''), onclick: () => pick(null) }, h('div', { class: 'pb-name none' }, T.none)));
    let group = null;
    for (const o of options) {
      if (!matches(q, o.name, o.sub, o.group)) continue;
      if (o.group && o.group !== group) { group = o.group; list.append(h('div', { class: 'pop-group' }, group)); }
      list.append(h('div', { class: 'pop-opt' + (o.id === curId ? ' on' : ''), onclick: () => pick(o.id) },
        o.dot ? h('i', { class: 'dot', style: `background:${o.dot};margin-top:5px` }) : null,
        o.icon ? h('img', { class: 'pop-ic', src: IMG(o.icon), draggable: 'false' }) : null,
        h('div', null, h('div', { class: 'pb-name' }, o.name), o.sub ? h('div', { class: 'pb-sub' }, o.sub) : null)));
    }
  };
  search.addEventListener('input', draw);
  popover = h('div', { class: 'pop' }, search, list);
  document.body.append(popover);
  const r = anchor.getBoundingClientRect();
  const w = Math.max(r.width, 380);
  popover.style.width = w + 'px';
  popover.style.left = Math.min(r.left, innerWidth - w - 10) + 'px';
  const below = innerHeight - r.bottom - 10, above = r.top - 10;
  if (below >= 300 || below >= above) { popover.style.top = r.bottom + 4 + 'px'; popover.style.maxHeight = Math.min(460, below) + 'px'; }
  else { popover.style.bottom = innerHeight - r.top + 4 + 'px'; popover.style.maxHeight = Math.min(460, above) + 'px'; }
  draw();
  search.focus();
  list.querySelector('.pop-opt.on')?.scrollIntoView({ block: 'center' });
}
document.addEventListener('mousedown', e => {
  popToggledOff = null;
  if (!popover || popover.contains(e.target)) return;
  if (popAnchor?.contains(e.target)) popToggledOff = popAnchor;
  closePopover();
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && popover) { closePopover(); e.stopImmediatePropagation(); } }, true);

// checkbox for an effect that a card or stamp triggers (e.g. «Пружинка»: chance to get +attack)
function procToggles(list) {
  if (!list.length) return null;
  return h('div', { class: 'procs' }, list.map(b => {
    const on = !!ch.buffs[b.id];
    const stacks = Math.max(1, ch.buffs[b.id] || b.maxStack);
    return h('label', { class: 'check proc' + (on ? ' on' : '') },
      h('input', { type: 'checkbox', checked: on, onchange: e => changed(c => { if (e.target.checked) c.buffs[b.id] = b.maxStack; else delete c.buffs[b.id]; }, { center: false, after: () => renderEditorDetail() }) }),
      h('span', null, h('b', null, T.procActive), ' — ', b.bonuses.map(x => bonusText({ typeId: x.typeId, vars: x.vars.map(v => v * stacks) })).join(', ')));
  }), ch.enableBuffs ? null : h('div', { class: 'warn' }, T.buffsOff));
}
function copyToTwin(key) {
  const [sid, idx] = key.split(':').map(Number);
  const slot = ctx.slots.get(sid);
  const e = ch.equipment[key];
  if (!e) return;
  const other = sid + ':' + ((idx + 1) % slot.count);
  changed(c => { c.equipment[other] = JSON.parse(JSON.stringify(e)); }, { center: false });
  toast(T.copied + ' → ' + slot.name + ' ' + ((idx + 1) % slot.count + 1));
}

function renderEditorDetail() {
  const el = $('edDetail'); if (!el) return;
  el.innerHTML = '';
  const e = ch.equipment[editor.key];
  const item = e && ctx.equipment.get(e.itemId);
  if (!item) { el.append(h('div', { class: 'hint' }, T.pickItem)); return; }
  const t = ctx.eqTypes.get(item.typeId);
  const slot = ctx.slots.get(t.slotId);
  const upd = (fn) => changed(c => fn(c.equipment[editor.key]), { center: false, after: () => { renderEditorDetail(); renderEditorList(); } });
  const res = lastResult?.items[editor.key];

  el.append(h('div', { class: 'head' }, img(item.imageId), h('div', null,
    h('div', { class: 'nm', style: stampColorOf(e) ? 'color:' + stampColorOf(e) : null }, item.name),
    h('div', { class: 'sub' }, `${t.name} · ${T.lvl} ${item.level} · ${ctx.equipmentClassOf(item).Name}`))));
  if (item.info) {
    const u = res?.upgrade;
    const plus = v => (v ? h('small', { style: 'color:var(--gold);font-size:12px;margin-left:4px' }, '+' + v) : null);
    el.append(h('div', { class: 'kv' },
      item.info.attack ? h('div', null, T.attack, h('b', null, item.info.attack, plus(u?.attack))) : null,
      item.info.defense ? h('div', null, T.defense, h('b', null, item.info.defense, plus(u?.defense))) : null,
      item.info.attackSpeed ? h('div', null, T.speed, h('b', null, item.info.attackSpeed)) : null,
      weaponRange(item) ? h('div', null, T.attackRange, h('b', null, weaponRange(item).base, plus(weaponRange(item).extra))) : null,
      u?.hp ? h('div', null, ctx.stats.get(ctx.ids.HP).name, h('b', null, '+' + u.hp)) : null));
  }
  const bl = itemBonusLines(item);
  if (bl.length) el.append(h('h4', null, T.bonuses), h('ul', { class: 'bonus-list' }, bl.map(x => h('li', { class: x.off ? 'muted' : null }, x.text + (x.off ? ' — ' + T.inactive : '')))));
  if (item.bonuses.some(b => b.activate != null)) {
    el.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: e.active !== false, onchange: ev => upd(x => { x.active = ev.target.checked; }) }), T.active));
  }
  if (slot.isWeapon == null) return; // costumes, mounts, decorations: no upgrade, stamps or cards

  // upgrade
  const max = ctx.maxUpgrade(item);
  el.append(h('h4', null, T.upgrade), h('div', { class: 'upg' },
    Array.from({ length: max + 1 }, (_, i) => h('button', { class: ((e.upgrade || 0) === i ? 'on' : '') + J('upg:' + i), onclick: () => { flash = 'upg:' + i; upd(x => { x.upgrade = i; }); } }, '+' + i))));
  if (res?.upgrade?.allStat) el.append(h('div', { class: 'sub-note' }, `+${res.upgrade.allStat} ${T.allStats}`));

  // stamp: the list shows each stamp's bonuses in the current color, computed for this item
  const stamps = ctx.stampsForItem(item, ch.classId);
  if (stamps.length) {
    const curV = e.stampVariantId ? ctx.stampVariants.get(e.stampVariantId) : null;
    const variantFor = s => (curV && s.variants.find(v => v.colorId === curV.colorId)) || s.variants[s.variants.length - 1];
    // stamps the wiki no longer lists go last, under their own heading (values from Anon's older database)
    const options = [...stamps.filter(s => !s.isLegacy), ...stamps.filter(s => s.isLegacy)].map(s => {
      const v = variantFor(s);
      return { id: s.id, name: s.name, dot: v.color?.Argb, sub: ctx.stampBonuses(v.id, item).map(bonusText).join('\n'), group: s.isLegacy ? T.stampsLegacy : null };
    });
    const cur = curV ? options.find(o => o.id === curV.stampId) : null;
    el.append(h('h4', null, T.stamp), pickerButton(cur ? { ...cur, dot: curV.color?.Argb, sub: ctx.stampBonuses(curV.id, item).map(bonusText).join('\n') } : null,
      anchor => openPopover(anchor, options, cur?.id, id => { flash = 'stamp'; return upd(x => {
        if (id == null) { delete x.stampVariantId; return; }
        x.stampVariantId = variantFor(ctx.stamps.get(id)).id;
      }); }), 'stamp'));
    if (curV) {
      const st = ctx.stamps.get(curV.stampId);
      el.append(h('div', { class: 'colors' }, st.variants.map(v => h('button', {
        class: (v.id === curV.id ? 'on' : '') + J('col:' + v.id), style: `background:${v.color?.Argb || '#888'}`,
        tip: () => ctx.stampBonuses(v.id, item).map(bonusText).map(esc).join('\n'),
        onclick: () => { flash = 'col:' + v.id; upd(x => { x.stampVariantId = v.id; }); },
      }))));
      const stampProcs = procToggles([...ctx.buffs.values()].filter(b => b.stampId === curV.stampId && b.inVersion));
      if (stampProcs) el.append(stampProcs);
    }
  }

  // cards
  const n = ctx.cardCount(item);
  if (n) {
    el.append(h('h4', null, T.cards));
    for (let i = 0; i < n; i++) {
      const fixed = i === 0 && item.primaryCardId;
      const curId = (e.cards || [])[i] || null;
      const options = ctx.cardsForItem(item, i).filter(c => !c.isLegacy || c.id === curId).map(cardOption)
        .sort(cardOrder);
      const curCard = fixed ? ctx.cards.get(item.primaryCardId) : (curId ? ctx.cards.get(curId) : null);
      const cur = curCard ? cardOption(curCard) : null;
      if (cur && fixed) cur.name += ` (${T.fixedCard})`;
      const btn = pickerButton(cur, fixed ? null : anchor => openPopover(anchor, options, curId, id => { flash = 'card:' + i; return upd(x => {
        x.cards = x.cards || []; while (x.cards.length < n) x.cards.push(null); x.cards[i] = id;
      }); }), 'card:' + i);
      el.append(h('div', { class: 'card-row' }, h('div', { class: 'n' }, i + 1), h('div', null, btn, curCard ? procToggles([...ctx.buffs.values()].filter(b => b.cardId === curCard.id && b.inVersion)) : null)));
    }
  }
}

// Talent window like in the game: one horizontal row per branch, talents in columns left to right
// (one column per tier, 1–2 talents each). Passive talents are round, active ones square.
function renderTalents(el) {
  const total = ctx.talentPoints(ch);
  const valid = validTalents(ch);
  const used = valid.length;
  const win = h('div', { class: 'talwin' + (ch.enableTalents ? '' : ' disabled-section') });
  for (const br of ctx.classBranches(ch.classId)) {
    const rows = [...new Set(br.talents.map(t => t.h))].sort((a, b) => a - b);
    const chosen = br.talents.filter(t => valid.includes(t.id));
    const chosenRows = new Set(chosen.map(t => t.h));
    const nextRow = rows.find(r => !chosenRows.has(r));
    const cols = h('div', { class: 'tal-cols' });
    for (const r of rows) {
      const ts = br.talents.filter(t => t.h === r).sort((a, b2) => a.v - b2.v);
      const col = h('div', { class: 'tal-col' + (ts.length === 1 ? ' single' : '') });
      for (const t of ts) {
        const on = valid.includes(t.id);
        const canPick = on || chosenRows.has(r) || (r === nextRow && used < total);
        col.append(h('div', {
          class: 'tal' + (t.active ? ' active' : '') + J('tal:' + t.id) + (on ? ' on' : '') + (canPick ? ' can' : ' locked'),
          tip: () => talentText(t),
          onclick: () => {
            if (!canPick) return;
            flash = 'tal:' + t.id;
            changed(c => {
              const inBranch = new Set(br.talents.map(x => x.id));
              if (on) c.talents = c.talents.filter(id => !inBranch.has(id) || ctx.talents.get(id).h < r);
              else { c.talents = c.talents.filter(id => !(inBranch.has(id) && ctx.talents.get(id).h === r)); c.talents.push(t.id); }
              c.talents = validTalents(c);
              pruneBuffs();
            });
          },
        }, h('img', { src: IMG(t.imageId), draggable: 'false' })));
      }
      cols.append(col);
    }
    win.append(h('div', { class: 'tal-branch' },
      h('div', { class: 'tal-name', style: `--bc:${br.color || '#555'}` }, h('span', null, br.name), chosen.length ? h('b', null, chosen.length) : null),
      cols));
  }
  const free = total - used;
  win.append(h('div', { class: 'tal-foot' },
    h('div', { class: 'tal-free' + (free < 0 ? ' neg' : '') }, `${T.talentFree}: ${free}`),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ch.enableTalents, onchange: e => changed(c => { c.enableTalents = e.target.checked; }) }), T.useTalents),
    h('button', { class: 'btn', onclick: () => changed(c => { c.talents = []; pruneBuffs(); }) }, T.clearTalents)));
  el.append(win);
  el.append(renderGuildTalents());
}

// guild talents: one talent per branch; the next branch opens when the previous one is maxed
function renderGuildTalents() {
  const gts = ch.guildTalents || {};
  const used = Object.values(gts).reduce((s, n) => s + n, 0);
  const setGuild = mut => changed(c => { const g = { ...c.guildTalents }; mut(g); c.guildTalents = ctx.validGuildTalents(g); pruneBuffs(); });
  const win = h('div', { class: 'talwin guildwin' + (ch.enableGuildTalents ? '' : ' disabled-section') },
    h('div', { class: 'gw-title' }, T.guildTalents));
  let open = true; // all previous branches are maxed
  for (const br of ctx.guildBranches) {
    const cur = br.talents.find(t => gts[t.id] > 0);
    const pts = cur ? gts[cur.id] : 0;
    const rowOpen = open;
    const icons = h('div', { class: 'tal-cols' });
    for (const t of br.talents) {
      const on = cur === t;
      icons.append(h('div', {
        class: 'tal' + (t.active ? ' active' : '') + J('gt:' + t.id) + (on ? ' on' : '') + (rowOpen ? ' can' : ' locked'),
        tip: () => guildTalentText(t, on ? pts : 0, br.maxPoints),
        onclick: () => {
          if (!rowOpen) return;
          flash = 'gt:' + t.id;
          setGuild(g => {
            for (const x of br.talents) delete g[x.id];
            if (!on) g[t.id] = pts || br.maxPoints;
          });
        },
      }, h('img', { src: IMG(t.imageId), draggable: 'false' }), on && br.maxPoints > 1 ? h('span', { class: 'gt-pts' }, pts) : null));
    }
    const step = d => () => setGuild(g => { const n = pts + d; if (n <= 0) delete g[cur.id]; else g[cur.id] = Math.min(n, br.maxPoints); });
    const stepper = br.maxPoints > 1 ? h('div', { class: 'gt-step' + (cur ? '' : ' off') },
      h('button', { type: 'button', disabled: !cur, onclick: step(-1) }, '−'),
      h('span', null, `${pts}/${br.maxPoints}`),
      h('button', { type: 'button', disabled: !cur || pts >= br.maxPoints, onclick: step(1) }, '+')) : h('div');
    win.append(h('div', { class: 'tal-branch gt-branch' + (rowOpen ? '' : ' gt-locked') },
      h('div', { class: 'tal-name', style: '--bc:var(--gold-3)' }, h('span', null, br.name)), icons, stepper));
    open = open && pts === br.maxPoints;
  }
  win.append(h('div', { class: 'tal-foot' },
    h('div', { class: 'tal-free' }, `${T.guildFree}: ${ctx.guildPointsTotal - used}`),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ch.enableGuildTalents, onchange: e => changed(c => { c.enableGuildTalents = e.target.checked; }) }), T.useGuild),
    h('button', { class: 'btn', onclick: () => changed(c => { c.guildTalents = {}; pruneBuffs(); }) }, T.clearTalents)));
  return win;
}
function guildTalentText(t, pts, max) {
  const shown = pts || 1;
  const desc = t.description.replace(/\{(\d+)\}/g, (_, n) => t.value(+n, shown));
  const bon = t.bonuses(shown).map(bonusText).join('\n');
  let s = `<b>${esc(t.name)}</b>${t.active ? ` <span class="m">(${esc(T.activeTalent)})</span>` : ''}`;
  if (max > 1) s += `\n<span class="m">${T.guildLevel}: ${pts}/${max}</span>`;
  if (desc) s += `\n${esc(desc)}`;
  if (bon) s += `\n<span class="g">${esc(bon)}</span>`;
  return s;
}

function renderEffects(el) {
  const grid = h('div', { class: 'eff-grid' });
  const toggle = (key, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!ch[key], onchange: e => changed(c => { c[key] = e.target.checked; }) }), label);
  const bonusesText = (list, k = 1) => list.map(b => bonusText({ typeId: b.typeId, vars: b.vars.map(v => v * k) })).join('\n');

  // aura
  const auras = ctx.classAuras(ch.classId, ch.level);
  const auraBox = h('div', { class: 'box' }, h('h3', null, T.aura), toggle('enableAura', T.useAura));
  const auraList = h('div', { class: ch.enableAura ? '' : 'disabled-section' });
  auraList.append(h('label', { class: 'opt' }, h('input', { type: 'radio', name: 'aura', checked: !ch.auraId, onchange: () => changed(c => { c.auraId = null; }) }), h('div', { class: 'ph' }), h('div', { class: 't' }, T.noAura)));
  for (const a of auras) {
    auraList.append(h('label', { class: 'opt' }, h('input', { type: 'radio', name: 'aura', checked: ch.auraId === a.id, onchange: () => changed(c => { c.auraId = a.id; }) }),
      img(a.imageId), h('div', null, h('div', { class: 't' }, a.name), h('div', { class: 's' }, bonusesText(a.bonuses.filter(b => b.inVersion))))));
  }
  // auras of other party members (they get the aura's "shared" value)
  auraList.append(h('h4', { class: 'party-h' }, T.partyAuras), h('div', { class: 'hint' }, T.partyAurasHint));
  for (const { aura: a, base, withTalents } of ctx.sharedAuras) {
    const on = ch.sharedAuras && a.id in ch.sharedAuras, tal = on && ch.sharedAuras[a.id];
    const canTal = bonusesText(base) !== bonusesText(withTalents);
    const chip = canTal ? h('button', { class: 'tal-chip' + (tal ? ' on' : ''), type: 'button', title: T.withTalentsTip, onclick: e => {
      e.preventDefault(); e.stopPropagation();
      changed(c => { c.sharedAuras = { ...c.sharedAuras, [a.id]: !tal }; });
    } }, T.withTalents) : h('div');
    auraList.append(h('label', { class: 'opt' },
      h('input', { type: 'checkbox', checked: on, onchange: e => changed(c => {
        const s = { ...c.sharedAuras };
        if (e.target.checked) s[a.id] = false; else delete s[a.id];
        c.sharedAuras = s;
      }) }),
      img(a.imageId),
      h('div', null, h('div', { class: 't' }, a.name.trim(), h('span', { class: 'cls-of' }, ' · ' + ctx.classes.get(a.classId).name)),
        h('div', { class: 's' }, bonusesText(tal ? withTalents : base))),
      chip));
  }
  auraBox.append(auraList);

  // elixir + consumables
  const elixBox = h('div', { class: 'box' }, h('h3', null, T.elixir), toggle('enableElixir', T.useElixir));
  // elixir list with icons and bonuses, like stamps and cards
  const elixOpt = x => ({ id: x.id, name: x.name, icon: x.imageId, sub: x.bonuses.map(bonusText).join('\n') });
  const elixOptions = [...ctx.elixirs.values()].filter(x => !x.isLegacy || x.id === ch.elixirId).map(elixOpt);
  const curElix = ch.elixirId && ctx.elixirs.has(ch.elixirId) ? elixOpt(ctx.elixirs.get(ch.elixirId)) : null;
  elixBox.append(h('div', { class: ch.enableElixir ? '' : 'disabled-section' },
    pickerButton(curElix, anchor => openPopover(anchor, elixOptions, ch.elixirId, id => { flash = 'elix'; changed(c => { c.elixirId = id; }); }), 'elix')));
  elixBox.append(h('h3', { style: 'margin-top:16px' }, T.consumables), toggle('enableConsumables', T.useConsumables));
  const consList = h('div', { class: ch.enableConsumables ? '' : 'disabled-section' });
  for (const x of ctx.consumables.values()) {
    const on = ch.consumables.includes(x.id);
    consList.append(h('label', { class: 'opt' }, h('input', { type: 'checkbox', checked: on, onchange: e => changed(c => {
      c.consumables = c.consumables.filter(id => id !== x.id);
      if (e.target.checked) {
        // potions of the same kind don't stack
        if (x.exclusive != null) c.consumables = c.consumables.filter(id => ctx.consumables.get(id).exclusive !== x.exclusive);
        c.consumables.push(x.id);
      }
    }) }), img(x.imageId), h('div', null, h('div', { class: 't' }, x.name), h('div', { class: 's' }, bonusesText(x.bonuses)))));
  }
  elixBox.append(consList);

  // buffs
  const buffBox = h('div', { class: 'box' }, h('h3', null, T.buffs), toggle('enableBuffs', T.useBuffs));
  const avail = ctx.availableBuffs(ch);
  const sections = [
    [T.buffsClass, avail.filter(b => b.classId != null)],
    [T.buffsGear, avail.filter(b => b.cardId != null || b.stampId != null)],
    [T.buffsGuild, avail.filter(b => b.guildTalentId != null)],
    [T.buffsCommon, avail.filter(b => b.classId == null && b.cardId == null && b.stampId == null && b.guildTalentId == null && !b.isNegate)],
    [T.buffsNeg, avail.filter(b => b.classId == null && b.cardId == null && b.stampId == null && b.isNegate)],
  ];
  const buffWrap = h('div', { class: ch.enableBuffs ? '' : 'disabled-section' });
  for (const [title, list] of sections) {
    if (!list.length) continue;
    buffWrap.append(h('h4', null, title));
    for (const b of list) {
      const stacks = ch.buffs[b.id] || 0;
      const setStacks = n => changed(c => {
        if (n > 0 && b.group != null) for (const o of ctx.buffs.values()) if (o.group === b.group && o.id !== b.id) delete c.buffs[o.id];
        if (n > 0) c.buffs[b.id] = clamp(n, 1, b.maxStack); else delete c.buffs[b.id];
      });
      const stk = b.maxStack > 1 ? h('div', { class: 'stk' }, h('input', { class: 'inp', type: 'number', min: 0, max: b.maxStack, value: stacks, title: T.stacks, onchange: e => setStacks(+e.target.value || 0) })) : h('div');
      buffWrap.append(h('div', { class: 'opt' },
        h('input', { type: 'checkbox', checked: stacks > 0, onchange: e => setStacks(e.target.checked ? (b.maxStack > 1 ? b.maxStack : 1) : 0) }),
        img(b.imageId),
        h('div', null, h('div', { class: 't' }, b.name), h('div', { class: 's' }, bonusesText(b.bonuses, Math.max(1, stacks)))),
        stk));
    }
  }
  buffBox.append(buffWrap);
  grid.append(h('div', { class: 'eff-col' }, auraBox, elixBox), h('div', { class: 'eff-col' }, buffBox));
  el.append(grid);
}

function renderCollection(el) {
  el.append(h('div', { class: 'tal-head' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ch.enableCollecting, onchange: e => changed(c => { c.enableCollecting = e.target.checked; }) }), T.useCollection)));
  const wrap = h('div', { class: ch.enableCollecting ? '' : 'disabled-section' });
  for (const g of ctx.collectedGroups) {
    const items = [...ctx.collected.values()].filter(c => c.groupId === g.Id && c.inVersion && (c.genderId == null || c.genderId === ch.genderId)).sort((a, b) => a.orderIndex - b.orderIndex);
    if (!items.length) continue;
    const ids = items.map(i => i.id);
    const n = ids.filter(id => ch.collected.includes(id)).length;
    wrap.append(h('div', { class: 'box' },
      h('div', { class: 'tal-head', style: 'margin-bottom:6px' }, h('h3', { style: 'margin:0;flex:1' }, `${g.Name} `, h('span', { class: 'hint' }, `${n} / ${items.length}`)),
        h('button', { class: 'btn small', onclick: () => changed(c => { c.collected = [...new Set([...c.collected, ...ids])]; }) }, T.all),
        h('button', { class: 'btn small', onclick: () => changed(c => { c.collected = c.collected.filter(id => !ids.includes(id)); }) }, T.clear)),
      h('div', { class: 'coll' }, items.map(it => h('label', { class: 'opt', tip: it.bonuses.length ? () => `<b>${esc(it.name)}</b>\n<span class="g">${it.bonuses.map(bonusText).map(esc).join('\n')}</span>` : null },
        h('input', { type: 'checkbox', checked: ch.collected.includes(it.id), onchange: e => changed(c => { c.collected = c.collected.filter(id => id !== it.id); if (e.target.checked) c.collected.push(it.id); }) }),
        img(it.imageId), h('div', null, h('div', { class: 't' }, it.name), it.bonuses.length ? h('div', { class: 's' }, it.bonuses.map(bonusText).join(', ')) : null))))));
  }
  el.append(wrap);
}

// ---------- right: results ----------
function statSection(s, cls) {
  const id = s.id, ST = ctx.StatType;
  if (s.type === ST.Primary || [7, 8, 9].includes(id)) return 'attributes';
  if ([10, 75, 11, 15, 16, 13, 80, 37, 21].includes(id)) return 'offense';
  if ([1, 12, 76, 77, 14, 48, 59].includes(id)) return 'defenseSec';
  if (s.type === ST.Energy || s.type === ST.PassiveRestore || s.type === ST.RestorePerHit || s.type === ST.RestorePerKill || [78, 79, 60].includes(id)) return 'regen';
  if (s.type === ST.DamageBy) return 'dmgElem';
  if (s.type === ST.DamageTo && s.elementId != null) return 'dmgMonElem';
  if (s.type === ST.DamageTo) return 'dmgRace';
  if (s.type === ST.Resist && s.elementId != null) return 'resElem';
  if (s.type === ST.Resist) return 'resRace';
  return 'misc';
}
function descNote(s, r) {
  const d = r.descriptions.get(s.id);
  if (d == null) return null;
  if (s.id === ctx.ids.DEFENSE) return fmtT(T.absorbs, { v: fmtNum(d, 1) });
  if (s.descFormulaId === 20 || s.id === 15) return fmtT(T.realCrit, { v: fmtNum(d, 2) });
  if (s.descFormulaId === 11) return fmtT(T.reduces, { v: fmtNum(d, 1) });
  return null;
}
function delta(s, v, base) {
  if (!base) return null;
  const b = base.get(s.id) ?? s.defaultValue;
  const d = v - b;
  if (Math.abs(d) < 1e-6) return null;
  const digits = s.roundDigits ?? (Math.abs(d - Math.round(d)) < 1e-9 ? 0 : 2);
  return h('span', { class: 'd ' + (d > 0 ? 'up' : 'down') }, (d > 0 ? '+' : '−') + fmtNum(Math.abs(d), digits));
}
function statTip(s, r) {
  const v = r.stats.get(s.id);
  const d = r.descriptions.get(s.id);
  let txt = `<b>${esc(s.name)}</b>`;
  if (s.descTemplate) {
    const shown = d != null ? fmtNum(d, 2) : fmtNum(v, 2);
    txt += '\n' + esc(s.descTemplate.replace(/\[[^\]]*\]/g, '').replace(/\{0\}/g, shown).replace(/\r/g, '').trim());
  }
  const src = r.bonuses.filter(b => ctx.bonusTypes.get(b.typeId)?.stats.some(x => x.statId === s.id));
  if (src.length) txt += `\n\n<span class="m">${esc(T.sourceTitle)}:</span>\n` + src.slice(0, 18).map(b => `<span class="g">${esc(bonusText(b))}</span> <span class="m">— ${esc(sourceLabel(b.source))}</span>`).join('\n') + (src.length > 18 ? `\n<span class="m">… +${src.length - 18}</span>` : '');
  return txt;
}
const openSections = new Set(store.get('openSections', ['attributes', 'offense', 'defenseSec']));
let resTab = store.get('resTab', 'main');
function renderRight() {
  const el = $('right'); const scroll = el.scrollTop; el.innerHTML = '';
  const r = lastResult || recalc();
  const base = baseline || previous;
  const cls = ctx.classes.get(ch.classId);
  const S = id => ctx.stats.get(id);
  const val = id => r.stats.get(id) ?? 0;

  el.append(h('div', { class: 'res-head' }, h('h3', null, T.results),
    h('button', { class: 'btn small' + (baseline ? ' primary' : ''), onclick: () => { baseline = baseline ? null : new Map(r.stats); renderRight(); } }, baseline ? '📌 ' + T.unpin : '📌 ' + T.pin)));
  if (base) el.append(h('div', { class: 'baseline' }, baseline ? T.pinned : T.changed));

  // parchment window like the in-game character sheet
  const row = (id, opts = {}) => {
    const s = S(id); if (!s || !r.stats.has(id)) return null;
    const v = val(id);
    const note = opts.note !== undefined ? opts.note : descNote(s, r);
    return h('div', { class: 'srow' + (opts.strong ? ' strong' : ''), tip: () => statTip(s, r) },
      h('span', { class: 'sn' }, opts.label || s.name),
      h('span', { class: 'sv' }, fmtStat(s, v), delta(s, v, base), note ? h('small', null, note) : null));
  };
  const head = text => h('div', { class: 'shead' }, text);
  const tabs = h('div', { class: 'sheet-tabs' },
    [['main', T.tabMain], ['extra', T.tabExtra]].map(([k, label]) => h('button', { class: 'stab' + (resTab === k ? ' on' : ''), onclick: () => { resTab = k; store.set('resTab', k); renderRight(); } }, label)));
  const body = h('div', { class: 'sheet-body' });

  if (resTab === 'main') {
    body.append(row(ctx.ids.HP), row(cls.energyStatId));
    body.append(head(T.params));
    const edit = ctx.editStatIds(ch.classId);
    edit.forEach(id => body.append(row(id)));
    // mastery bars: every 10 points of an attribute give a level
    const m = ctx.settings.levelMultiplicity;
    const freePts = ctx.freeStats(ch);
    const maxStat = ctx.settings.maxStatCount;
    // +/− next to each bar: spend points right here, like in the game (Shift = 10)
    const spend = (id, d, e) => {
      e.stopPropagation();
      const n = e.shiftKey ? 10 : 1;
      flash = 'mst:' + id;
      changed(c => {
        const cur = c.stats[id] || 1;
        c.stats[id] = d > 0 ? clamp(cur + Math.min(n, Math.max(0, ctx.freeStats(c))), 1, maxStat) : clamp(cur - n, 1, maxStat);
      });
    };
    body.append(h('div', { class: 'mastery' }, edit.map(id => {
      const s = S(id), v = Math.floor(val(id));
      const lvl = Math.floor(v / m), part = (v % m) / m;
      const own = ch.stats[id] || 1;
      return h('div', { class: 'mst' + J('mst:' + id), tip: () => `<b>${esc(s.progressName || s.name)}</b>\n${esc(s.name)}: ${v}\n<span class="m">${lvl} · ${v % m}/${m}</span>` },
        s.imageId ? h('img', { src: IMG(s.imageId), draggable: 'false' }) : h('div', { class: 'ph' }),
        h('div', { class: 'mst-main' }, h('div', { class: 'mst-name' }, s.progressName || s.name),
          h('div', { class: 'bar' }, lvl ? h('span', { class: 'lvl' }, lvl) : null, h('i', { style: `width:${Math.round(part * 100)}%` }))),
        h('div', { class: 'mst-btns' },
          h('button', { class: 'mst-plus', disabled: freePts <= 0 || own >= maxStat, onclick: e => spend(id, 1, e) }, '+'),
          h('button', { class: 'mst-minus', disabled: own <= 1, onclick: e => spend(id, -1, e) }, '−')));
    })));
    body.append(head(T.chars));
    [ctx.ids.ATTACK, 11, ctx.ids.DEFENSE, 13, 14, 15, 16].forEach(id => body.append(row(id)));
    body.append(head(T.calcHead));
    body.append(row(75, { strong: true }), row(76), row(77));
    const free = ctx.freeStats(ch);
    body.append(h('div', { class: 'sheet-foot' },
      h('button', { class: 'sheet-reset', onclick: () => changed(c => { for (const id of ctx.editStatIds(c.classId)) c.stats[id] = 1; }) }, T.resetStats),
      h('span', { style: 'margin-left:auto' }, T.unspent + ': '), h('b', { class: free < 0 ? 'neg' : '' }, free)));
  } else {
    const groups = ['attributes', 'offense', 'defenseSec', 'regen', 'dmgElem', 'dmgMonElem', 'dmgRace', 'resElem', 'resRace', 'misc'];
    const byGroup = new Map(groups.map(g => [g, []]));
    for (const [id] of r.stats) { const s = S(id); byGroup.get(statSection(s, cls)).push(s); }
    for (const g of groups) {
      const list = byGroup.get(g).sort((a, b) => (a.type === ctx.StatType.Primary ? -1 : 0) - (b.type === ctx.StatType.Primary ? -1 : 0) || a.orderIndex - b.orderIndex || a.id - b.id);
      if (!list.length) continue;
      const changedCount = base ? list.filter(s => Math.abs((r.stats.get(s.id) ?? 0) - (base.get(s.id) ?? s.defaultValue)) > 1e-6).length : 0;
      const det = h('details', { class: 'ssec', open: openSections.has(g) },
        h('summary', null, h('span', null, T[g]), changedCount ? h('span', { class: 'cnt' }, changedCount) : null),
        list.map(s => row(s.id)));
      det.addEventListener('toggle', () => { if (det.open) openSections.add(g); else openSections.delete(g); store.set('openSections', [...openSections]); });
      body.append(det);
    }
  }
  el.append(h('div', { class: 'sheet' }, tabs, body));
  const ver = window.RQC_VERSION || {};
  el.append(h('div', { class: 'note' }, T.updated + ': ' + (ver.date || '—') + (ver.version ? ' · v' + ver.version : '')));
  // author contact; click copies the Discord name
  el.append(h('div', { class: 'note contact', title: T.copyContact, onclick: () => navigator.clipboard.writeText('ondirty').then(() => toast(T.copied + ': ondirty')) },
    T.author + ': ', h('span', { class: 'discord' }, 'Discord ', h('b', null, 'ondirty'))));
  if (!window.RQC_WEB) el.append(h('div', { class: 'note' }, h('a', { class: 'site-link', href: SITE_URL, target: '_blank' }, T.siteLink)));
  el.scrollTop = scroll;
}

function renderAll() { renderTop(); renderLeft(); renderCenter(); renderRight(); }

// ---------- update banner (installed app only) ----------
// A downloaded update restarts the app by itself after a countdown. The build is saved on every change, so nothing
// is lost; the countdown waits while a dialog is open or the user is typing. "Later" leaves it for the next app start.
const UPD_DELAY = 10;
let updTimer = null, updLeft = UPD_DELAY, updPostponed = null;
function updBusy() {
  const a = document.activeElement;
  return !$('modal').hidden || !!document.querySelector('.confirm-wrap, .pop') || (a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.type !== 'range' && a.type !== 'checkbox');
}
function showUpdate(st) {
  let el = document.getElementById('updBanner');
  if (!st || (st.status !== 'downloading' && st.status !== 'ready')) { if (el) el.remove(); return; }
  if (!el) { el = h('div', { class: 'upd', id: 'updBanner' }); document.body.append(el); }
  el.innerHTML = '';
  if (st.status === 'downloading') {
    el.append(h('div', { class: 'upd-t' }, fmtT(T.updDownloading, { v: st.version || '' })),
      h('div', { class: 'upd-bar' }, h('i', { style: `width:${st.percent || 3}%` })));
    return;
  }
  const install = () => { clearInterval(updTimer); store.set('current', ch); window.rqcApp.installUpdate(); };
  const later = updPostponed === st.version;
  const sub = h('div', { class: 'upd-s' });
  el.append(h('div', { class: 'upd-t' }, fmtT(T.updReady, { v: st.version || '' })), sub,
    h('div', { class: 'upd-btns' },
      later ? null : h('button', { class: 'btn small', onclick: () => { updPostponed = st.version; clearInterval(updTimer); updTimer = null; showUpdate(st); } }, T.updPostpone),
      h('button', { class: 'btn primary small', onclick: install }, T.updNow)));
  if (later) { sub.textContent = T.updLater; return; }
  const tick = () => {
    if (updBusy()) { updLeft = UPD_DELAY; sub.textContent = T.updWaiting; return; }
    sub.textContent = fmtT(T.updIn, { s: updLeft });
    if (updLeft-- <= 0) install();
  };
  if (!updTimer) { updLeft = UPD_DELAY; updTimer = setInterval(tick, 1000); }
  tick();
}
if (window.rqcApp) { window.rqcApp.onUpdate(showUpdate); window.rqcApp.updateState().then(showUpdate); }
// after an update: say so once
if (window.rqcApp && window.RQC_VERSION) {
  const v = window.RQC_VERSION.version, was = store.get('lastVersion', null);
  if (was && was !== v) setTimeout(() => toast(fmtT(T.updDone, { v })), 800);
  store.set('lastVersion', v);
}

// ---------- the web version (installed app only): told once, then a link under the results ----------
const SITE_URL = 'https://rqcalc.com/';
function showSiteNotice() {
  if (window.RQC_WEB || store.get('siteNoticeSeen', false)) return;
  const close = () => { store.set('siteNoticeSeen', true); el.remove(); };
  const el = h('div', { class: 'upd site' },
    h('div', { class: 'upd-t' }, T.siteTitle),
    h('div', { class: 'upd-s' }, T.siteText),
    h('div', { class: 'upd-btns' },
      h('button', { class: 'btn small', onclick: close }, T.siteClose),
      h('a', { class: 'btn primary small', href: SITE_URL, target: '_blank', onclick: close }, T.siteOpen)));
  document.body.append(el);
}

// ---------- game texts in the chosen language ----------
// The game database is Russian; data/lang-*.js translate what the interface shows (stats, bonuses, classes, slots…).
// The engine keeps working with the database as is; only display fields of its objects change, the originals are kept.
const gameRu = new Map();
function applyGameLang() {
  const tr = (window.RQC_GAME_I18N || {})[lang] || {};
  const set = (obj, field, text) => {
    if (!obj) return;
    let orig = gameRu.get(obj);
    if (!orig) gameRu.set(obj, orig = {});
    if (!(field in orig)) orig[field] = obj[field];
    obj[field] = text ?? orig[field];
  };
  const names = (table, list, field = 'name', idKey = 'id') => { for (const o of list) set(o, field, tr[table]?.[o[idKey]]); };
  for (const s of ctx.stats.values()) {
    const t = tr.Stat?.[s.id] || {};
    set(s, 'name', t.Name); set(s, 'descTemplate', t.DescriptionTemplate); set(s, 'progressName', t.ProgressName);
  }
  names('BonusType', ctx.bonusTypes.values(), 'template');
  names('Class', ctx.classes.values());
  names('EquipmentSlot', ctx.slots.values());
  names('EquipmentType', ctx.eqTypes.values());
  names('TalentBranch', ctx.talentBranches.values());
  names('GuildTalentBranch', ctx.guildBranches);
  names('Aura', ctx.auras.values());
  names('Buff', ctx.buffs.values());
  names('Elixir', ctx.elixirs.values());
  names('Consumable', ctx.consumables.values());
  names('Gender', ctx.genders, 'Name', 'Id');
  names('State', ctx.states, 'Name', 'Id');
  names('Event', ctx.events, 'Name', 'Id');
  names('CollectedGroup', ctx.collectedGroups, 'Name', 'Id');
}
// bonus sources come from the engine in Russian ("Печать: …"): translate the label part
function sourceLabel(src) {
  const s = String(src || ''), map = T.srcNames || {};
  const i = s.indexOf(': ');
  return i < 0 ? map[s] || s : (map[s.slice(0, i)] || s.slice(0, i)) + s.slice(i);
}

applyGameLang();
recalc();
renderAll();
showSiteNotice();

// a build link (rqcalc.com/#b=…): open that build (asking first if there is a build of one's own), then clean the address
async function openLinkedBuild() {
  if (!/^#b=/.test(location.hash)) return;
  const b = await readBuildLink(location.hash);
  history.replaceState(null, '', location.pathname + location.search);
  if (!b) { toast(T.badLink); return; }
  const name = b.name || `${ctx.classes.get(b.ch.classId)?.name || ''} ${b.ch.level}`;
  if (store.get('current', null) && !await confirmBox(fmtT(T.linkAsk, { name }), { ok: T.load })) return;
  if (tab === 'bosses') switchTool('calc');
  loadBuild({ name: b.name, ch: b.ch });
  toast(T.linkOpened);
}
openLinkedBuild();
window.addEventListener('hashchange', openLinkedBuild);
