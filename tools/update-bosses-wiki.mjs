// Boss list for the boss timer: bosses with a respawn time from the Royal Quest Wiki (royalquest.info,
// category "Монстры", template fields Тип=Босс, ЛокаN / РеспN in minutes) → data/bosses.js.
// Usage: node tools/update-bosses-wiki.mjs [--offline]   (--offline reuses source/wiki-monsters.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheFile = path.join(root, 'source', 'wiki-monsters.json');
const outFile = path.join(root, 'data', 'bosses.js');
const API = 'https://royalquest.info/api.php';

async function download() {
  const pages = [];
  let cont = {};
  for (let i = 0; i < 100; i++) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', generator: 'categorymembers', gcmtitle: 'Категория:Монстры', gcmlimit: '50',
      prop: 'revisions', rvprop: 'content', rvslots: 'main', ...cont,
    });
    const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': 'rq-calc boss updater' } });
    const j = await res.json();
    for (const p of Object.values(j.query?.pages || {})) {
      const text = p.revisions?.[0]?.slots?.main?.['*'];
      if (text) pages.push({ title: p.title, text });
    }
    if (!j.continue) break;
    cont = j.continue;
  }
  return pages;
}

function fields(text) {
  const f = {};
  // «||Респ1=120»: some wiki pages have a doubled pipe; [ \t], not \s: an empty field must not swallow the next line
  for (const m of text.matchAll(/^\|+[ \t]*([^=\n]+?)[ \t]*=[ \t]*(.*)$/gm)) f[m[1]] = m[2].trim();
  return f;
}

const pages = process.argv.includes('--offline')
  ? JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
  : await download();
if (!process.argv.includes('--offline')) fs.writeFileSync(cacheFile, JSON.stringify(pages));

// bosses the wiki gives no respawn for. Зибо: one boss that appears in one of the five northern locations, so one timer;
// the interval is not published, about 6 hours by players' reports (approx = shown with «≈», the player can correct it)
const MANUAL = {
  'Зибо': [{ loc: 'Север: Северный Кабук, Пустошь ветров, Алатика, Хабул, Морозная Длань', resp: 360, approx: true }],
};
const bosses = [];
for (const p of pages) {
  const f = fields(p.text);
  if (!/^(босс|элита)$/i.test(f['Тип'] || '')) continue;
  const name = p.title.replace(/^Монстр\s+/, '');
  const spots = [];
  for (let n = 1; n <= 10; n++) {
    const loc = f['Лока' + n], resp = parseInt(f['Респ' + n], 10);
    if (loc && resp > 0) spots.push({ loc: loc.replace(/\[\[|\]\]/g, ''), resp });
  }
  if (!spots.length && MANUAL[name]) spots.push(...MANUAL[name]);
  if (!spots.length) continue;
  bosses.push({ name, level: parseInt(f['Уровень'], 10) || 0, type: f['Тип'], spots });
}
// not a monster, so not in the pages above. Занка (wiki: page «Занка», update 1.2.103) comes back 8 h 5 min after Пружинка is
// killed and stays until the springs are collected: hold = the timer does not start over by itself
bosses.push({ name: 'Занка', level: 0, type: 'НПС', after: 'Пружинка', hold: true, spots: [{ loc: 'Макдар', resp: 485 }] });
bosses.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'ru'));

// icons: the wiki's "Портрет <name>.png" (small portrait), otherwise "Монстр <name>.png" → data/bosses/<n>.png
const imgDir = path.join(root, 'data', 'bosses');
fs.mkdirSync(imgDir, { recursive: true });
async function imageUrls(files) {
  const urls = {};
  for (let i = 0; i < files.length; i += 40) {
    const params = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url', titles: files.slice(i, i + 40).join('|') });
    const j = await (await fetch(`${API}?${params}`, { headers: { 'User-Agent': 'rq-calc boss updater' } })).json();
    const norm = Object.fromEntries((j.query?.normalized || []).map(n => [n.to, n.from]));
    for (const p of Object.values(j.query?.pages || {})) {
      const url = p.imageinfo?.[0]?.url;
      if (url) urls[norm[p.title] || p.title] = url;
    }
  }
  return urls;
}
// a boss keeps its picture file when the list changes; a new boss takes the next free number
// (--offline still fetches a picture that is missing, so a boss added to the list gets its portrait)
let oldImg = {};
try {
  const old = JSON.parse(fs.readFileSync(outFile, 'utf8').match(/RQ_BOSSES = (\[[\s\S]*\]);/)[1]);
  oldImg = Object.fromEntries(old.filter(b => b.img).map(b => [b.name, b.img]));
} catch { /* no list yet */ }
let freeImg = Math.max(-1, ...Object.values(oldImg).map(f => parseInt(f, 10))) + 1;
const imgFile = new Map(bosses.map(b => [b, oldImg[b.name] || `${freeImg++}.png`]));
const toFetch = process.argv.includes('--offline') ? bosses.filter(b => !fs.existsSync(path.join(imgDir, imgFile.get(b)))) : bosses;
if (toFetch.length) {
  const want = toFetch.flatMap(b => [`Файл:Портрет ${b.name}.png`, `Файл:Монстр ${b.name}.png`]);
  const urls = await imageUrls(want);
  for (const b of toFetch) {
    const url = urls[`Файл:Портрет ${b.name}.png`] || urls[`Файл:Монстр ${b.name}.png`];
    if (!url) { console.log('  no picture:', b.name); continue; }
    const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': 'rq-calc boss updater' } })).arrayBuffer());
    fs.writeFileSync(path.join(imgDir, imgFile.get(b)), buf);
  }
}
for (const b of bosses) if (fs.existsSync(path.join(imgDir, imgFile.get(b)))) b.img = imgFile.get(b);
fs.writeFileSync(outFile, '// Generated by tools/update-bosses-wiki.mjs from royalquest.info. resp = respawn in minutes.\n'
  + 'window.RQ_BOSSES = ' + JSON.stringify(bosses, null, 0).replace(/\},\{"name"/g, '},\n{"name"') + ';\n');
console.log(`${pages.length} monster pages, ${bosses.length} bosses with respawn → data/bosses.js`);
