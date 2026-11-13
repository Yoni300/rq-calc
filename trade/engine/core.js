// «Обмен» tool: the trade model, the price catalog and the valuation.
// Ported from TradeCounterRQ by w-stus (github.com/w-stus/tradecounterRQ, src/TradeCounter.Core:
// Models.cs, Valuation.cs, TradeSession.cs), used under its non-commercial license — see trade/LICENSE-TradeCounterRQ.txt.
// Changes: JavaScript; the catalog also knows every item name of the game (cards with their signs from the wiki,
// the rest without a price) and, after the exact rules, snaps a slightly misread name to a known one.
'use strict';
const { norm, lev } = require('../../card-match');

// categories: 'regular' (a stack: count × price), 'card' (signs × the sign price), 'unique' (one per row, its own price)
const Names = {
  normalize: name => String(name || '').trim().replace(/\s+/g, ' ').toUpperCase(),
  layoutKey: name => String(name || '').trim().replace(/\s+/g, '').toUpperCase(),
};

/** items: [{ id, name, category, buy, sell, signs }]; aliases: { normalized OCR text: item id } */
class Catalog {
  constructor(items, aliases = {}) {
    this.items = items;
    this.byId = new Map(items.map(i => [i.id, i]));
    this.aliases = aliases;
    this.byNorm = new Map(); this.byLayout = new Map(); this.byLoose = new Map();
    const add = (map, key, id) => { if (!map.has(key)) map.set(key, new Set()); map.get(key).add(id); };
    for (const i of items) { add(this.byNorm, Names.normalize(i.name), i.id); add(this.byLayout, Names.layoutKey(i.name), i.id); add(this.byLoose, norm(i.name), i.id); }
    this.loose = [...this.byLoose.keys()];
  }
  /** → { item, fuzzy } or null; ambiguous names give null, never a guess between two items */
  resolve(name) {
    if (!name) return null;
    const key = Names.normalize(name);
    let ids = new Set(this.byNorm.get(key) || []);
    if (this.aliases[key] && this.byId.has(this.aliases[key])) ids.add(this.aliases[key]);
    if (!ids.size) {
      // the game can wrap in the middle of a word: only whitespace is ignored, every letter still has to match
      const layout = Names.layoutKey(name);
      ids = new Set(this.byLayout.get(layout) || []);
      for (const [a, id] of Object.entries(this.aliases)) if (Names.layoutKey(a) === layout && this.byId.has(id)) ids.add(id);
    }
    if (ids.size === 1) return { item: this.byId.get([...ids][0]), fuzzy: false };
    if (ids.size > 1) return null;
    // not in TradeCounterRQ: OCR look-alikes («o»/«о», «3»/«з») and one or two wrong letters in a long name
    const t = norm(name);
    if (t.length < 5) return null;
    const exact = this.byLoose.get(t);
    if (exact) return exact.size === 1 ? { item: this.byId.get([...exact][0]), fuzzy: true } : null;
    let best = null, second = Infinity;
    for (const k of this.loose) {
      if (Math.abs(k.length - t.length) > 3) continue;
      const d = lev(t, k);
      if (!best || d < best.d) { if (best) second = best.d; best = { k, d }; } else if (d < second) second = d;
    }
    // at most one mistake per 8 letters, and clearly better than the next name
    if (!best || best.d > Math.max(1, Math.floor(t.length / 8)) || second - best.d < 1) return null;
    const set = this.byLoose.get(best.k);
    return set.size === 1 ? { item: this.byId.get([...set][0]), fuzzy: true } : null;
  }
}

// ---------- valuation (Valuation.cs) ----------
const fmt = n => Number(n).toLocaleString('ru-RU');
function valueRow(row, catalog, pricing, received) {
  let name = row.name && row.name.trim() ? row.name : null;
  const error = (issue, item = null) => ({ index: row.index, name: item ? item.name : name, read: row.name, category: item ? item.category : null,
    quantity: item && item.category !== 'regular' ? 1 : row.quantity, formula: '', value: null, issue, itemId: item ? item.id : null });
  if (row.occupancy === 'uncertain') return error('uncertain');
  if (!name) return error('noName');
  const found = catalog.resolve(name);
  if (!found) return error('notInCatalog');
  const item = found.item;
  const price = item.category === 'card' ? (received ? pricing.buySign : pricing.sellSign) : (received ? item.buy : item.sell);
  const quantity = item.category === 'regular' ? row.quantity : 1;
  if (quantity == null || quantity < 1) return error('noQuantity', item);
  if (item.category === 'card' && !(item.signs >= 1)) return error('noSigns', item);
  if (!(price >= 1)) return error(item.category === 'card' ? (received ? 'noBuySign' : 'noSellSign') : (received ? 'noBuy' : 'noSell'), item);
  const units = item.category === 'card' ? item.signs : quantity;
  const value = units * price;
  if (!Number.isSafeInteger(value)) return error('overflow', item);
  return { index: row.index, name: item.name, read: row.name, fuzzy: found.fuzzy, category: item.category, quantity, signs: item.category === 'card' ? item.signs : null,
    price, formula: item.category === 'card' ? `${fmt(units)} зн. × ${fmt(price)}` : `${fmt(quantity)} × ${fmt(price)}`, value, issue: null, itemId: item.id };
}
function valueSide(side, catalog, pricing, received) {
  const rows = side.rows.filter(r => r.occupancy !== 'empty').map(r => valueRow(r, catalog, pricing, received));
  const issues = rows.filter(r => r.issue).map(r => ({ row: r.index, issue: r.issue }));
  if (side.rows.length !== 5) issues.push({ issue: 'rowsMissing' });
  if (side.gold == null || side.gold < 0) issues.push({ issue: 'noGold' });
  const subtotal = rows.reduce((n, r) => n + (r.value || 0), 0) + (side.gold >= 0 ? side.gold : 0);
  return { rows, gold: side.gold >= 0 ? side.gold : null, subtotal: Number.isSafeInteger(subtotal) ? subtotal : null, complete: issues.length === 0, issues };
}
function valuate(obs, catalog, pricing, current) {
  const received = valueSide(obs.received, catalog, pricing, true), given = valueSide(obs.given, catalog, pricing, false);
  const difference = current && received.complete && given.complete && received.subtotal != null && given.subtotal != null ? received.subtotal - given.subtotal : null;
  return { received, given, difference, current };
}

// ---------- the trade on screen (TradeSession.cs): fresh frames only, a reading counts once it repeats ----------
const fingerprint = obs => [obs.received, obs.given].map(s => s.rows.map(r => `${r.index}:${r.occupancy}:${Names.normalize(r.name || '')}:${r.quantity ?? ''}`).join('|') + `|gold:${s.gold ?? ''}`).join('|');
class TradeSession {
  constructor(stableFrames = 2, closureFrames = 3) { Object.assign(this, { stableFrames, closureFrames, fp: null, agreeing: 0, absent: 0, id: null, observation: null, state: 'waiting', justOpened: false, justClosed: false }); }
  get validated() { return this.state === 'complete' || this.state === 'partial'; }
  observe(obs, isComplete) {
    this.justOpened = this.justClosed = false;
    if (!obs) {
      this.agreeing = 0; this.fp = null;
      if (this.id) this.state = 'reading';
      if (++this.absent < this.closureFrames) return;
      this.justClosed = !!this.id;
      this.id = null; this.observation = null; this.state = 'waiting';
      return;
    }
    this.absent = 0;
    const next = fingerprint(obs);
    this.agreeing = next === this.fp ? this.agreeing + 1 : 1;
    this.fp = next; this.observation = obs; this.state = 'reading';
    if (this.agreeing < this.stableFrames) return;
    if (!this.id) { this.id = Date.now().toString(36); this.justOpened = true; }
    this.state = isComplete(obs) ? 'complete' : 'partial';
  }
  suspend() { this.justOpened = this.justClosed = false; this.agreeing = 0; this.absent = 0; this.fp = null; this.state = 'suspended'; }
  revalue(complete) { if (this.validated) this.state = complete ? 'complete' : 'partial'; }
}

module.exports = { Names, Catalog, valuate, TradeSession, fingerprint };
