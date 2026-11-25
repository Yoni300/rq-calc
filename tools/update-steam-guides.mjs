// The Steam Community guides for Royal Quest Online (app 2962300) → data/steam-guides.js + data/guides/<id>.<ext> (their
// preview pictures) for the «Гайды» tool (app/steam-guides.js). Only what Steam shows in its own guide list: title, author,
// picture, rating, categories, dates, the short description. The guide itself stays on Steam: the tool links to it.
// English titles and descriptions for the guides not written in English: tools/steam-guides-en.mjs.
// Usage: node tools/update-steam-guides.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EN from './steam-guides-en.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = 2962300;
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Steam answers 429 when asked too often: a long pause, then again. Pages are kept for a day in the system temp folder,
// so a run that stopped half way goes on where it was.
const cacheDir = path.join(os.tmpdir(), 'rq-steam-guides');
fs.mkdirSync(cacheDir, { recursive: true });
async function get(url, binary = false) {
  const cf = path.join(cacheDir, url.replace(/\W+/g, '_').slice(-150));
  if (!binary && fs.existsSync(cf) && Date.now() - fs.statSync(cf).mtimeMs < 86400e3) return fs.readFileSync(cf, 'utf8');
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.status === 429) throw Object.assign(new Error('429 ' + url), { slow: true });
      if (!r.ok) throw new Error(r.status + ' ' + url);
      if (binary) return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' };
      const t = await r.text();
      fs.writeFileSync(cf, t);
      await sleep(1500);
      return t;
    } catch (e) {
      if (k >= 6) throw e;
      const wait = e.slow ? 60000 * (k + 1) : 3000 * (k + 1);
      console.log(`\n  ${e.message}: waiting ${wait / 1000} s`);
      await sleep(wait);
    }
  }
}
const text = s => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const field = (html, cls) => { const m = html.match(new RegExp(`class="${cls}"[^>]*>([\\s\\S]*?)</div>`)); return m ? text(m[1]) : ''; };

// ---------- the list (best rated first, as Steam shows it) ----------
const list = [];
for (let p = 1; p <= 20; p++) {
  const html = await get(`https://steamcommunity.com/app/${APP}/guides/?browsefilter=toprated&l=english&p=${p}&numperpage=30`);
  const blocks = html.split('class="workshopItemCollectionContainer"').slice(1);
  for (const b of blocks) {
    const id = (b.match(/filedetails\/\?id=(\d+)/) || [])[1];
    if (!id || list.some(x => x.id === id)) continue;
    list.push({
      id,
      title: field(b, 'workshopItemTitle'),
      author: field(b, 'workshopItemAuthorName'),
      stars: +((b.match(/sharedfiles\/(\d)-star\.png/) || [])[1] || 0),
      pic: ((b.match(/class="workshopItemPreviewImage[^"]*" src="([^"]+)"/) || [])[1] || '').replace(/&amp;/g, '&'),
    });
  }
  if (blocks.length < 30) break;
}
console.log(list.length, 'guides in the list');

// ---------- each guide's page ----------
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
// «11 Jan, 2025 @ 4:04am», this year without the year: «3 Nov @ 2:00pm» (Steam's time, close enough for a date)
function steamDate(s) {
  const m = s.match(/(\d{1,2}) ([A-Z][a-z]{2})(?:, (\d{4}))? @/);
  return m ? Date.UTC(+(m[3] || new Date().getUTCFullYear()), MONTHS[m[2]], +m[1]) / 1000 : null;
}
// the tag blocks: «Category: …» and «Languages: …»
const tagsOf = (html, title) => {
  for (const m of html.matchAll(/class="workshopTags"[^>]*>([\s\S]*?)<\/div>/g)) {
    if (new RegExp(`workshopTagsTitle">\\s*${title}`).test(m[1])) return [...m[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map(x => text(x[1]));
  }
  return [];
};
const LANG = { Russian: 'ru', English: 'en', Polish: 'pl', 'Portuguese (Brazil)': 'pt', Portuguese: 'pt', German: 'de', Spanish: 'es', French: 'fr', Ukrainian: 'uk' };
const cats = {};
const items = [];
for (const g of list) {
  const en = await get(`https://steamcommunity.com/sharedfiles/filedetails/?id=${g.id}&l=english`);
  const dates = [...en.matchAll(/class="detailsStatRight"[^>]*>([^<]*)</g)].map(m => steamDate(text(m[1]))).filter(Boolean);
  const stats = text((en.match(/class="stats_table"[^>]*>([\s\S]*?)<\/table>/) || [])[1]);
  const num = re => { const m = stats.match(re); return m ? +m[1].replace(/,/g, '') : 0; };
  const ce = tagsOf(en, 'Categor');
  ce.forEach(c => { cats[c] ||= { en: c }; });
  const tagLang = tagsOf(en, 'Languages').map(l => LANG[l]).find(Boolean);
  items.push({
    ...g,
    desc: text((en.match(/class="guideTopDescription"[^>]*>([\s\S]*?)<div/) || [])[1]),
    cats: ce, tagLang,
    at: dates[0] || null, upd: dates[1] || null,
    visitors: num(/([\d,]+)\s+Unique Visitors/), favs: num(/([\d,]+)\s+Current Favorites/),
    votes: +((en.match(/class="numRatings"[^>]*>\s*([\d,]+)/) || [])[1] || '0').replace(/,/g, ''),
  });
  process.stdout.write('.');
}
console.log();

// ---------- the pictures (kept with the app: the page may not load Steam's picture server) ----------
const dir = path.join(root, 'data', 'guides');
fs.mkdirSync(dir, { recursive: true });
const keep = new Set();
for (const g of items) {
  const pic = g.pic;
  delete g.pic;
  if (!pic) continue;
  const old = fs.readdirSync(dir).find(f => f.startsWith(g.id + '.'));
  if (old) { g.img = old; keep.add(old); continue; }
  const { buf, type } = await get(pic, true);
  g.img = `${g.id}.${/png/.test(type) ? 'png' : /gif/.test(type) ? 'gif' : 'jpg'}`;
  fs.writeFileSync(path.join(dir, g.img), buf);
  keep.add(g.img);
  await sleep(300);
}
for (const f of fs.readdirSync(dir)) if (!keep.has(f)) fs.unlinkSync(path.join(dir, f)); // guides that are gone

// ---------- language, English text, category names ----------
// a guide without a readable title (only blank characters) is left out
for (let i = items.length - 1; i >= 0; i--) if (!/[\p{L}\p{N}]/u.test(items[i].title)) items.splice(i, 1);
for (const g of items) {
  // the author's language tag, else a guess by the alphabet; tools/steam-guides-en.mjs can say otherwise
  g.lang = EN[g.id]?.lang || g.tagLang || (/[А-Яа-яЁё]/.test(g.title + g.desc) ? 'ru' : 'en');
  delete g.tagLang;
  if (g.lang !== 'en' && EN[g.id]?.t) g.en = { t: EN[g.id].t, d: EN[g.id].d || '' };
}
// Steam's guide categories in Russian (as Steam's Russian pages call them) and Ukrainian (Steam has none)
const RU = { 'Achievements': 'Достижения', 'Characters': 'Персонажи', 'Classes': 'Классы', 'Co-op': 'Кооператив', 'Crafting': 'Ремесло',
  'Gameplay Basics': 'Основы игры', 'Loot': 'Награды', 'Maps or Levels': 'Карты или уровни', 'Multiplayer': 'Мультиплеер',
  'Secrets': 'Секреты', 'Trading': 'Обмен', 'Walkthroughs': 'Прохождения', 'Modding or Configuration': 'Моды или настройка',
  'Story or Lore': 'Сюжет', 'Translations': 'Переводы', 'Speedruns': 'Спидраны', 'Controls': 'Управление', 'Game Modes': 'Режимы игры',
  'Weapons': 'Оружие', 'Workshop': 'Мастерская' };
const UK = { 'Achievements': 'Досягнення', 'Characters': 'Персонажі', 'Classes': 'Класи', 'Co-op': 'Кооператив', 'Crafting': 'Ремесло',
  'Gameplay Basics': 'Основи гри', 'Loot': 'Нагороди', 'Maps or Levels': 'Карти й рівні', 'Multiplayer': 'Мультиплеєр',
  'Secrets': 'Секрети', 'Trading': 'Обмін', 'Walkthroughs': 'Проходження', 'Modding or Configuration': 'Моди й налаштування',
  'Story or Lore': 'Сюжет', 'Translations': 'Переклади', 'Speedruns': 'Спідрани', 'Controls': 'Керування', 'Game Modes': 'Режими гри',
  'Weapons': 'Зброя', 'Workshop': 'Майстерня' };
for (const c of Object.values(cats)) { c.ru = RU[c.en] || c.en; c.uk = UK[c.en] || c.ru; }
fs.writeFileSync(path.join(root, 'data', 'steam-guides.js'),
  '// Generated by tools/update-steam-guides.mjs from Steam Community — don\'t edit. The guides themselves stay on Steam.\n'
  + `window.RQ_GUIDES = ${JSON.stringify({ at: new Date().toISOString().slice(0, 10), cats, items }, null, 0).replace(/\},\{"id"/g, '},\n{"id"')};\n`);
const missing = items.filter(g => g.lang !== 'en' && !g.en);
console.log(`${items.length} guides, ${Object.keys(cats).length} categories → data/steam-guides.js; no English text yet: ${missing.length}`);
const unknown = Object.keys(cats).filter(c => !RU[c]);
if (unknown.length) console.log('categories without Russian / Ukrainian names:', unknown.join(', '));
