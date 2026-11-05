// Pictures for the names the chat gives: mobs (data/monsters) and loot (equipment / cards from rqdata → data/img,
// market loot → data/market-img, the wiki icon set → data/icons). Same lookup order as the Base tool (app/base.js).
// Returns paths relative to data/ («monsters/74.png»); each page puts its own way to data/ in front.
'use strict';
const path = require('path');

const bnorm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
// "Брюки ловца 1 слот", "Перчатки лучника 1СЛ", "Кинжал новичка ЭОГ" → the item itself
const bstrip = s => String(s || '').replace(/\s+\d+\s+слот(а|ов)?\s*$/i, '').replace(/\s*\d\s*сл\.?$/i, '').replace(/\s+к\.\s*\S+$/i, '')
  .replace(/\s+Э[А-ЯЁ]{1,2}\d?$/, '').replace(/\s*\(Класс [A-ZА-Я]\)$/, '').trim();

let X = null;
function index() {
  if (X) return X;
  const data = f => { try { return require(path.join(__dirname, '..', 'data', f)); } catch { return null; } };
  const mobs = new Map(), items = new Map(), icons = new Map();
  for (const m of data('base-monsters.js') || []) if (m.img && !mobs.has(bnorm(m.name))) mobs.set(bnorm(m.name), 'monsters/' + m.img);
  const T = data('rqdata.js') || {};
  for (const t of ['Equipment', 'Card']) for (const r of T[t] || []) if (r.Image_Id && !items.has(bnorm(r.Name))) items.set(bnorm(r.Name), 'img/' + r.Image_Id + '.png');
  for (const i of data('market-items.js') || []) if (!items.has(bnorm(i.name))) items.set(bnorm(i.name), 'market-img/' + i.id + '.png');
  for (const [name, file] of Object.entries(data('base-icons.js') || {})) icons.set(bnorm(name), 'icons/' + file);
  X = { mobs, items, icons };
  return X;
}

const mobIcon = name => index().mobs.get(bnorm(name)) || null;
function itemIcon(name) {
  const x = index(), k = bnorm(name), s = bnorm(bstrip(name));
  const recipe = /^рецепт/.test(k) ? [...x.icons].find(([n]) => n.startsWith('рецепт'))?.[1] : null; // recipes share the scroll picture
  return x.items.get(k) || x.items.get(s) || x.icons.get(k) || x.icons.get(s) || recipe || null;
}

module.exports = { mobIcon, itemIcon };
