// Pictures for the names the chat gives: mobs (data/monsters) and loot (equipment / cards from rqdata → data/img,
// market loot → data/market-img, the wiki icon set → data/icons). Same lookup order as the Base tool (app/base.js).
// Returns paths relative to data/ («monsters/74.png»); each page puts its own way to data/ in front.
'use strict';
const path = require('path');
const { lev } = require('../card-match'); // edit distance that forgives letters OCR mixes up

const bnorm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
// "Брюки ловца 1 слот", "Перчатки лучника 1СЛ", "Кинжал новичка ЭОГ" → the item itself
const bstrip = s => String(s || '').replace(/\s+\d+\s+слот(а|ов)?\s*$/i, '').replace(/\s*\d\s*сл\.?$/i, '').replace(/\s+к\.\s*\S+$/i, '')
  .replace(/\s+Э[А-ЯЁ]{1,2}\d?$/, '').replace(/\s*\(Класс [A-ZА-Я]\)$/, '').trim();

let X = null;
function index() {
  if (X) return X;
  const data = f => { try { return require(path.join(__dirname, '..', 'data', f)); } catch { return null; } };
  const mobs = new Map(), items = new Map(), icons = new Map();
  const mobNames = new Map(), itemNames = new Map(); // normalized → the name as the game writes it
  for (const m of data('base-monsters.js') || []) {
    if (!mobNames.has(bnorm(m.name))) mobNames.set(bnorm(m.name), m.name);
    if (m.img && !mobs.has(bnorm(m.name))) mobs.set(bnorm(m.name), 'monsters/' + m.img);
  }
  const T = data('rqdata.js') || {};
  for (const t of ['Equipment', 'Card']) for (const r of T[t] || []) {
    if (!itemNames.has(bnorm(r.Name))) itemNames.set(bnorm(r.Name), r.Name);
    if (r.Image_Id && !items.has(bnorm(r.Name))) items.set(bnorm(r.Name), 'img/' + r.Image_Id + '.png');
  }
  for (const i of data('market-items.js') || []) { if (!itemNames.has(bnorm(i.name))) itemNames.set(bnorm(i.name), i.name); if (!items.has(bnorm(i.name))) items.set(bnorm(i.name), 'market-img/' + i.id + '.png'); }
  for (const g of data('base-goods.js') || []) if (g.name && !itemNames.has(bnorm(g.name))) itemNames.set(bnorm(g.name), g.name);
  for (const [name, file] of Object.entries(data('base-icons.js') || {})) { icons.set(bnorm(name), 'icons/' + file); if (!itemNames.has(bnorm(name))) itemNames.set(bnorm(name), name); }
  X = { mobs, items, icons, mobNames, itemNames };
  return X;
}

const mobIcon = name => index().mobs.get(bnorm(name)) || null;
function itemIcon(name) {
  const x = index(), k = bnorm(name), s = bnorm(bstrip(name));
  const recipe = /^рецепт/.test(k) ? [...x.icons].find(([n]) => n.startsWith('рецепт'))?.[1] : null; // recipes share the scroll picture
  return x.items.get(k) || x.items.get(s) || x.icons.get(k) || x.icons.get(s) || recipe || null;
}

// the closest known name: { name, score } (score 1 = the same), compared without spaces and «ё»
function nearest(names, text) {
  const k = bnorm(text).replace(/ /g, '');
  let best = null;
  for (const [key, name] of names) {
    const kk = key.replace(/ /g, '');
    if (Math.abs(kk.length - k.length) > Math.max(2, k.length * 0.35)) continue;
    const score = 1 - lev(k, kk) / Math.max(k.length, kk.length);
    if (!best || score > best.score) best = { name, score };
  }
  return best;
}
// Names read from the screen are often a little off («Сухои лисг»), sometimes garbage («иулои»).
// Items: snapped to a known item, or left out (the chat history file brings the exact line a bit later).
// Mobs: snapped when close, else kept as read. The chat files are exact and are never changed.
function fixScreenEvent(e) {
  const x = index();
  if (e.type === 'item') {
    if (x.itemNames.has(bnorm(e.name)) || x.itemNames.has(bnorm(bstrip(e.name)))) return e;
    const m = nearest(x.itemNames, e.name);
    if (m && m.score >= 0.7) return { ...e, name: m.name };
    // a known name with junk after it («Сухой лист жалюј 1.2Ох5б»): the longest known name the line starts with
    const k = bnorm(e.name);
    let pre = null;
    for (const [key, name] of x.itemNames) if (key.length >= 4 && k.startsWith(key + ' ') && (!pre || key.length > pre.key.length)) pre = { key, name };
    return pre ? { ...e, name: pre.name } : null;
  }
  if (e.type === 'kill') {
    if (x.mobNames.has(bnorm(e.mob))) return e;
    const m = nearest(x.mobNames, e.mob);
    return m && m.score >= 0.75 ? { ...e, mob: m.name } : e;
  }
  return e;
}

module.exports = { mobIcon, itemIcon, fixScreenEvent };
