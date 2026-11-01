// The «База» tool's monsters: facts from the Royal Quest Wiki (royalquest.info) monster templates — level, health,
// race, element, defence, experience, where they live (and respawn), what drops — → data/base-monsters.js.
// Only the template fields are taken (no article text). Portraits → data/monsters/<n>.png.
// Usage: node tools/update-base-wiki.mjs [--refresh] [--images]
//   --refresh downloads the monster pages again (else source/wiki-monsters.json, shared with update-bosses-wiki.mjs)
//   --images  downloads the portraits that are missing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { templateFields } from './wiki-fetch.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheFile = path.join(root, 'source', 'wiki-monsters.json');
const outFile = path.join(root, 'data', 'base-monsters.js');
const imgDir = path.join(root, 'data', 'monsters');
const API = 'https://royalquest.info/api.php';
const UA = { 'User-Agent': 'rq-calc base updater' };
// the wiki sometimes answers with an HTML error page: wait and try again
async function api(params) {
  for (let k = 0; ; k++) {
    const r = await fetch(API, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
    const t = await r.text();
    try { return JSON.parse(t); } catch { if (k >= 4) throw new Error('wiki: ' + r.status + ' ' + t.slice(0, 120)); await new Promise((res) => setTimeout(res, 2000 * (k + 1))); }
  }
}

async function download() {
  const pages = [];
  let cont = {};
  for (let i = 0; i < 100; i++) {
    const j = await api({ action: 'query', format: 'json', generator: 'categorymembers', gcmtitle: 'Категория:Монстры', gcmlimit: '50',
      prop: 'revisions', rvprop: 'content', rvslots: 'main', ...cont });
    for (const p of Object.values(j.query?.pages || {})) {
      const text = p.revisions?.[0]?.slots?.main?.['*'];
      if (text) pages.push({ title: p.title, text });
    }
    if (!j.continue) break;
    cont = j.continue;
  }
  return pages;
}

// the template's fields, split on top-level pipes (a line can hold several: «|Карта1=|Лока1=Марагорн»)
const fields = (text) => templateFields(text, 'Монстр');
const list = (f, key) => {
  const out = [];
  for (let n = 1; n <= 60; n++) { const v = f[key + n]; if (v) out.push(v); }
  return out;
};
const num = (v) => { const x = parseInt(String(v || '').replace(/\s/g, ''), 10); return Number.isFinite(x) ? x : null; };

const refresh = process.argv.includes('--refresh');
const pages = refresh || !fs.existsSync(cacheFile) ? await download() : JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
if (refresh) fs.writeFileSync(cacheFile, JSON.stringify(pages));

const monsters = [];
for (const p of pages) {
  const f = fields(p.text);
  if (!f || !p.title.startsWith('Монстр ')) continue;
  const name = p.title.replace(/^Монстр\s+/, '');
  const locs = [];
  for (let n = 1; n <= 20; n++) {
    const loc = f['Лока' + n];
    if (loc) locs.push({ loc, resp: num(f['Респ' + n]) });
  }
  const m = {
    name, level: num(f['Уровень']), hp: num(f['Жизни']), race: f['Раса'] || '', element: f['Элемент'] || '',
    defense: f['Защита'] || '', exp: num(f['Опыт']), mode: f['Режим'] || '', aggro: f['Агр'] === 'Да',
    type: f['Тип'] || '', group: f['Группа'] || '', event: f['Ивент'] || list(f, 'Ивент')[0] || '', quest: f['Квест'] || '',
    summoned: f['Призывается'] || '', locs,
    equip: list(f, 'Эквип'), cons: list(f, 'Расход'), drop: list(f, 'Дроп'), cards: list(f, 'Карта'),
    questDrop: list(f, 'КвестДроп'), recipes: list(f, 'Рецепт'), summon: list(f, 'Призыв'),
  };
  for (const k of Object.keys(m)) if (m[k] === '' || m[k] === null || (Array.isArray(m[k]) && !m[k].length) || m[k] === false) delete m[k];
  monsters.push(m);
}
monsters.sort((a, b) => (a.level ?? 999) - (b.level ?? 999) || a.name.localeCompare(b.name, 'ru'));

// portraits: "Портрет <name>.png", else "Монстр <name>.png"; a file per monster index (kept between runs by name)
fs.mkdirSync(imgDir, { recursive: true });
const mapFile = path.join(imgDir, 'index.json');
const imgOf = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : {}; // name -> file
if (process.argv.includes('--images')) {
  const want = monsters.filter((m) => !imgOf[m.name]);
  let next = Object.keys(imgOf).length;
  for (let i = 0; i < want.length; i += 25) { // 25 monsters = 50 titles, the API limit
    const chunk = want.slice(i, i + 25);
    const titles = chunk.flatMap((m) => [`Файл:Портрет ${m.name}.png`, `Файл:Монстр ${m.name}.png`]);
    const j = await api({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url', iiurlwidth: '96', titles: titles.join('|') });
    const norm = Object.fromEntries((j.query?.normalized || []).map((n) => [n.to, n.from]));
    const urls = {};
    for (const pg of Object.values(j.query?.pages || {})) {
      const ii = pg.imageinfo?.[0];
      if (ii) urls[norm[pg.title] || pg.title] = ii.thumburl || ii.url;
    }
    for (const m of chunk) {
      const url = urls[`Файл:Портрет ${m.name}.png`] || urls[`Файл:Монстр ${m.name}.png`];
      if (!url) continue;
      const buf = Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer());
      const file = `${next++}.png`;
      fs.writeFileSync(path.join(imgDir, file), buf);
      imgOf[m.name] = file;
    }
    process.stdout.write(`\r  portraits ${Math.min(i + 25, want.length)}/${want.length}`);
  }
  console.log('');
  fs.writeFileSync(mapFile, JSON.stringify(imgOf));
}
for (const m of monsters) if (imgOf[m.name]) m.img = imgOf[m.name];

fs.writeFileSync(outFile, '// Generated by tools/update-base-wiki.mjs from the Royal Quest Wiki (royalquest.info) monster templates — don\'t edit.\n'
  + '(function (d) { if (typeof module === \'object\' && module.exports) module.exports = d; else window.RQ_BASE_MONSTERS = d; })('
  + JSON.stringify(monsters) + ');\n');
console.log(`${monsters.length} monsters, ${monsters.filter((m) => m.img).length} with a portrait → data/base-monsters.js (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
