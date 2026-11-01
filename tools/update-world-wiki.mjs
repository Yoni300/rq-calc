// The «База» world: locations with their map and markers, NPCs and quests — facts from the Royal Quest Wiki
// (royalquest.info) templates {{ИзображениеЛокации}}, {{НПС}}, {{Задание}} → data/base-world.js.
// Only facts are taken: names, types, coordinates, levels, who gives a quest and to whom, what to kill or bring,
// rewards, what a vendor sells and for how much. Quest descriptions, dialogues and NPC descriptions are NOT copied.
// Usage: node tools/update-world-wiki.mjs [--refresh] [--images]
//   --refresh downloads the pages again (else source/wiki-locations.json, wiki-npcs.json, wiki-quests.json)
//   --images  downloads missing maps (800 px, → data/maps/*.png, then tools/to-jpeg.cjs) and NPC portraits (data/npcs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryPages, templateFields, numbered, imageUrls, download } from './wiki-fetch.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (n) => path.join(root, 'source', n);
const refresh = process.argv.includes('--refresh');
async function pages(file, ...cats) {
  if (!refresh && fs.existsSync(src(file))) return JSON.parse(fs.readFileSync(src(file), 'utf8'));
  const p = await categoryPages(...cats);
  fs.writeFileSync(src(file), JSON.stringify(p));
  return p;
}
const locPages = await pages('wiki-locations.json', 'Локации');
const npcPages = await pages('wiki-npcs.json', 'НПС', 'КвестовыеНПС', 'ПрочиеНПС', 'Торговцы');
const questPages = await pages('wiki-quests.json', 'Задания');

const num = (v) => { const x = parseInt(String(v || '').replace(/[\s ]/g, ''), 10); return Number.isFinite(x) ? x : null; };
const counted = (f, key) => numbered(f, key).map((n, i) => ({ n, c: num(f[`${key}${i + 1}Шт`]) || 1 }));
const prune = (o) => { for (const k of Object.keys(o)) if (o[k] == null || o[k] === '' || (Array.isArray(o[k]) && !o[k].length)) delete o[k]; return o; };

// ---- locations: type, levels, the map frame and its markers --------------------------------------------------------------
const locs = [];
for (const p of locPages) {
  const f = templateFields(p.text, 'ИзображениеЛокации');
  if (!f) continue;
  const marks = [];
  for (let i = 1; i <= 80; i++) {
    const n = f['Имя' + i];
    if (!n) continue;
    marks.push({ n, t: f['Тип' + i] || '', x: num(f['X' + i]), y: num(f['Y' + i]) });
  }
  locs.push(prune({
    name: p.title, type: [f['ТипЛокации'], ...numbered(f, 'ТипЛокации')].filter(Boolean),
    lv: [num(f['Уровень']), num(f['Уровень2'])].filter((v) => v != null), event: f['Ивент'] || '',
    size: num(f['Размер']) || 800, off: num(f['Смещение']) || 0, marks,
  }));
}
locs.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

// ---- NPCs: where they stand, race, event, what they sell ------------------------------------------------------------------
const npcs = [];
for (const p of npcPages) {
  const f = templateFields(p.text, 'НПС') || {};
  const shop = numbered(f, 'Вещь').map((n, i) => ({ n, p: f[`Цена${i + 1}`] || '' }));
  npcs.push(prune({ name: p.title, locs: numbered(f, 'Лока'), race: f['Раса'] || '', event: f['Ивент'] || '', infanta: !!f['Инфанта'] || undefined,
    kind: p.cat === 'Торговцы' ? 'seller' : p.cat === 'КвестовыеНПС' ? 'quest' : '', shop }));
}
npcs.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

// ---- quests: who, to whom, chain, what to do, rewards (no description or dialogue) ----------------------------------------
const quests = [];
for (const p of questPages) {
  const f = templateFields(p.text, 'Задание');
  if (!f) continue;
  const reward = [...(f['Награда'] ? [{ n: f['Награда'], c: num(f['НаградаШт']) || 1 }] : []), ...counted(f, 'Награда')];
  quests.push(prune({
    name: p.title.replace(/^Задание\s*[—-]\s*/, ''), level: num(f['Уровень']), from: f['Кто'] || '', to: f['Кому'] || '',
    type: f['Тип'] || '', event: f['Ивент'] || '', chain: f['Цепочка'] || '', num: num(f['Номер']),
    prev: [f['Предыдущее'], ...numbered(f, 'Предыдущее')].filter(Boolean), cls: [f['Класс'], ...numbered(f, 'Класс')].filter(Boolean),
    loc: [f['Локация'], ...numbered(f, 'Локация')].filter(Boolean), gold: num(f['Золото']), exp: num(f['Опыт']),
    kill: counted(f, 'КвестМоб'), need: counted(f, 'КвестЛут'), use: counted(f, 'Использовать'),
    bring: [f['Отнести'], ...numbered(f, 'Отнести')].filter(Boolean), reward, choice: counted(f, 'Выбор'),
  }));
}
quests.sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name, 'ru'));

// ---- recipes: the result, the chance, the resources ---------------------------------------------------------------------
const recipePages = await pages('wiki-recipes.json', 'Рецепты');
const recipes = [];
for (const p of recipePages) {
  const f = templateFields(p.text, 'Рецепт');
  if (!f) continue;
  recipes.push(prune({ name: p.title, result: f['Результат'] || '', count: num(f['РезультатШт']), chance: num(f['Шанс']),
    res: numbered(f, 'Ресурс').map((n, i) => ({ n, c: num(f[`Штук${i + 1}`]) || 1 })), from: f['Выдаёт'] || '' }));
}
recipes.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

// ---- where resources come from: gathering points, ore veins, fishing spots ---------------------------------------------
const nodePages = [...await pages('wiki-resources.json', 'Ресурсы'), ...await pages('wiki-nodes.json', 'Рудные месторождения', 'Рыбные угодья', 'Станки')];
const nodes = [];
for (const p of nodePages) {
  const r = templateFields(p.text, 'Ресурс');
  if (r) {
    nodes.push(prune({ name: p.title.replace(/\s*\(ресурс\)$/, ''), kind: p.cat === 'Рудные месторождения' ? 'ore' : 'gather',
      drops: numbered(r, 'Дроп').map((n, i) => prune({ n, ev: r[`ИвентДроп${i + 1}`] || '' })), locs: numbered(r, 'Лока') }));
    continue;
  }
  const fsh = templateFields(p.text, 'Рыбное угодье');
  if (fsh) nodes.push(prune({ name: p.title, kind: 'fish', bait: numbered(fsh, 'Наживка'), drops: counted(fsh, 'Улов').map(({ n, c }) => prune({ n, c: c > 1 ? c : null })) }));
}
nodes.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
// fishing spots stand on the maps as markers: their location is the map they are on
for (const l of locs) for (const m of l.marks || []) if (m.t === 'Рыбалка') { const n = nodes.find((x) => x.name === m.n); if (n) (n.locs ||= []).includes(l.name) || n.locs.push(l.name); }

// ---- images: maps (800 px) and NPC portraits, kept between runs by name -------------------------------------------------
const mapsDir = path.join(root, 'data', 'maps'), npcDir = path.join(root, 'data', 'npcs');
fs.mkdirSync(mapsDir, { recursive: true }); fs.mkdirSync(npcDir, { recursive: true });
const idx = (dir) => { const f = path.join(dir, 'index.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; };
const mapOf = idx(mapsDir), npcImg = idx(npcDir);
if (process.argv.includes('--images')) {
  const wantMaps = locs.filter((l) => !mapOf[l.name]);
  const mu = await imageUrls(wantMaps.map((l) => `Файл:Локация ${l.name}.png`), 800);
  let k = Object.keys(mapOf).length;
  for (const l of wantMaps) {
    const u = mu[`Файл:Локация ${l.name}.png`];
    if (!u) continue;
    const file = `${k++}`;
    fs.writeFileSync(path.join(mapsDir, file + '.png'), await download(u));
    mapOf[l.name] = file + '.jpg';
    process.stdout.write(`\r  maps ${k}`);
  }
  console.log('');
  const wantNpc = npcs.filter((n) => !npcImg[n.name]);
  const nu = await imageUrls(wantNpc.map((n) => `Файл:Портрет ${n.name}.png`), 96);
  let j = Object.keys(npcImg).length;
  for (const n of wantNpc) {
    const u = nu[`Файл:Портрет ${n.name}.png`];
    if (!u) continue;
    const file = `${j++}.png`;
    fs.writeFileSync(path.join(npcDir, file), await download(u));
    npcImg[n.name] = file;
  }
  fs.writeFileSync(path.join(mapsDir, 'index.json'), JSON.stringify(mapOf));
  fs.writeFileSync(path.join(npcDir, 'index.json'), JSON.stringify(npcImg));
  console.log('  now convert the maps: electron tools/to-jpeg.cjs data/maps 78');
}
for (const l of locs) if (mapOf[l.name]) l.map = mapOf[l.name];
for (const n of npcs) if (npcImg[n.name]) n.img = npcImg[n.name];

const out = path.join(root, 'data', 'base-world.js');
fs.writeFileSync(out, '// Generated by tools/update-world-wiki.mjs from the Royal Quest Wiki (royalquest.info) templates — facts only, don\'t edit.\n'
  + '(function (d) { if (typeof module === \'object\' && module.exports) module.exports = d; else window.RQ_BASE_WORLD = d; })('
  + JSON.stringify({ locs, npcs, quests, recipes, nodes }) + ');\n');
console.log(`${locs.length} locations (${locs.filter((l) => l.map).length} maps), ${npcs.length} NPCs (${npcs.filter((n) => n.img).length} portraits), ${quests.length} quests, ${recipes.length} recipes, ${nodes.length} resource points → data/base-world.js (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
