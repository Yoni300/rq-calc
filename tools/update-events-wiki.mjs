// Game events for «База»: the wiki's event pages (Категория:Игровые события) → data/base-events.js + banners in data/events/.
// Facts only: whether it still runs, the dates it ran, its banner, and what belongs to it (the wiki's «Событие» property:
// monsters, NPCs, locations, quests, gear, boxes, cards…). How it works is written by us in tools/event-notes.mjs.
// Run: node tools/update-events-wiki.mjs [--images]
import fs from 'node:fs';
import { api, categoryPages, imageUrls, download } from './wiki-fetch.mjs';
import { EVENT_NOTES } from './event-notes.mjs';

const OUT = new URL('../data/base-events.js', import.meta.url);
const IMG_DIR = new URL('../data/events/', import.meta.url);
const withImages = process.argv.includes('--images');

const pages = await categoryPages('Игровые события');
// events the category misses
for (const extra of ['Тайна Варлонского приюта']) {
  if (pages.some((p) => p.title === extra)) continue;
  const j = await api({ action: 'query', titles: extra, prop: 'revisions', rvprop: 'content', rvslots: 'main' });
  const p = Object.values(j.query.pages)[0];
  const text = p.revisions?.[0]?.slots?.main?.['*'];
  if (text) pages.push({ title: extra, text });
}

const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const monthOf = (w) => { w = w.toLowerCase(); if (/^ма[йя]$/.test(w)) return 4; return MONTHS.findIndex((m, i) => i !== 4 && w.startsWith(m)); };
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
// «20 октября - 10 ноября 2026 года», «9 декабря 2025 - 15 января 2026 года», «12 июля 2023 - 19 июля 2023 года»
function parseRange(s) {
  const m = s.match(/(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?\s*[-–—]\s*(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i);
  if (!m) return null;
  const m1 = monthOf(m[2]), m2 = monthOf(m[5]);
  if (m1 < 0 || m2 < 0) return null;
  const y2 = +m[6], y1 = m[3] ? +m[3] : (m1 > m2 ? y2 - 1 : y2);
  return { from: iso(y1, m1, +m[1]), to: iso(y2, m2, +m[4]) };
}

// what belongs to an event, by the wiki's category of each page
const GROUP = [
  ['monsters', /^Монстры/], ['npcs', /^НПС/], ['locs', /^Локации/], ['quests', /^Задания/], ['chains', /^Цепочки заданий/],
  ['mounts', /^(Ездовое животное|Питомец)/], ['gear', /^(Экипировка|Оружие)/], ['cards', /^Карты/], ['transmog', /^Преобразцы/],
  ['boxes', /^(Контейнеры|Сундуки)/], ['cons', /^(Расходники|Еда|Напитки|Зелья)/], ['trophies', /^Трофеи/],
];
const STRIP = { monsters: /^Монстр\s+/, quests: /^Задание\s+—\s+/, chains: /^Цепочка заданий\s+—\s+/ };
async function members(ev) {
  const out = {};
  const j = await api({ action: 'ask', query: `[[Событие::${ev}]]|?Категория|limit=500` });
  for (const [title, v] of Object.entries(j.query?.results || {})) {
    const cats = (v.printouts['Категория'] || []).map((x) => String(x.fulltext || x).replace(/^Категория:/, ''));
    const g = GROUP.find(([, re]) => cats.some((c) => re.test(c)));
    if (!g) continue;
    const name = STRIP[g[0]] ? title.replace(STRIP[g[0]], '') : title;
    (out[g[0]] ||= []).push(name);
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])].sort((a, b) => a.localeCompare(b, 'ru'));
  return out;
}

const events = [];
for (const p of pages) {
  const t = p.text;
  const banner = (t.match(/\[\[\s*file\s*:\s*(Баннер[^|\]]+)/i) || [])[1]?.trim() || null;
  const dates = [...t.matchAll(/\|\|([^|\n]*\d{4}[^|\n]*)\|\|/g)].map((m) => parseRange(m[1])).filter(Boolean)
    .sort((a, b) => b.from.localeCompare(a.from));
  const once = /проходил[оа]? один раз|больше не проводится|в настоящее время не проводится|сейчас не проводится/i.test(t);
  const intro = (t.match(/Игровое событие было введено ([^.\n<]+)/i) || [])[1]?.trim() || null; // «осенью 2012 года»
  events.push({
    name: p.title, banner, running: !once, since: intro, dates,
    ...(await members(p.title)),
    notes: EVENT_NOTES[p.title] || null,
  });
  console.log(p.title, '·', dates.length, 'dates ·', Object.entries(events.at(-1)).filter(([, v]) => Array.isArray(v) && typeof v[0] === 'string').map(([k, v]) => `${k} ${v.length}`).join(', '));
}
// still running first, the newest first
events.sort((a, b) => b.running - a.running || (b.dates[0]?.from || '').localeCompare(a.dates[0]?.from || ''));
for (const e of events) if (!e.notes) console.warn('no notes for', e.name);

// banners → data/events/<hash>.jpg: the newest art from the event's guide on Steam (800×450), else the wiki's banner.
// PNGs are saved as they come; then: node_modules\electron\dist\electron.exe tools/to-jpeg.cjs data/events
fs.mkdirSync(IMG_DIR, { recursive: true });
const steam = withImages ? await steamCovers(events.map((e) => e.name)) : {};
const files = events.filter((e) => e.banner && !steam[e.name]).map((e) => 'Файл:' + e.banner);
const urls = withImages ? await imageUrls(files, 800) : {};
// a stable file name per event (the order of the list may change)
const hash = (s) => { let x = 5381; for (const c of s) x = ((x * 33) ^ c.codePointAt(0)) >>> 0; return x.toString(16); };
for (const e of events) {
  const url = steam[e.name] || urls['Файл:' + e.banner];
  const had = fs.existsSync(new URL(hash(e.name) + '.jpg', IMG_DIR));
  if (url || had || e.banner) e.img = hash(e.name) + '.jpg';
  if (url) {
    for (const old of [hash(e.name) + '.jpg', hash(e.name) + '.png']) fs.rmSync(new URL(old, IMG_DIR), { force: true });
    fs.writeFileSync(new URL(hash(e.name) + (/\.png(\?|$)/i.test(url) ? '.png' : '.jpg'), IMG_DIR), await download(url));
  }
  if (steam[e.name]) e.imgFrom = 'steam';
  delete e.banner;
}

/** Event name → the cover picture of its newest guide/announcement on Steam (Russian). */
async function steamCovers(names) {
  const posts = [];
  for (let off = 0; off < 600; off += 100) {
    const r = await fetch(`https://store.steampowered.com/events/ajaxgetpartnereventspageable/?clan_accountid=0&appid=2962300&offset=${off}&count=100&l=russian`, { headers: { 'User-Agent': 'rq-tools' } });
    const j = await r.json();
    if (!j.events?.length) break;
    posts.push(...j.events);
  }
  const out = {};
  for (const name of names) {
    // «Праздник урожая» → /праздн\S*\s+урожа/ (any word ending: «Праздника урожая»)
    const re = new RegExp(name.toLowerCase().replace(/ё/g, 'е').split(/\s+/).map((w) => w.slice(0, Math.max(3, Math.min(6, w.length - 2))).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\S*\\s+'), 'i');
    const hits = posts.filter((p) => re.test(p.event_name.toLowerCase().replace(/ё/g, 'е')) && !/шкатулк|набор|сундук|итоги/i.test(p.event_name))
      .sort((a, b) => /гайд|ивент/i.test(b.event_name) - /гайд|ивент/i.test(a.event_name) || b.rtime32_start_time - a.rtime32_start_time);
    for (const p of hits) {
      let jd = {};
      try { jd = JSON.parse(p.jsondata || '{}'); } catch { /* none */ }
      const cap = (jd.localized_capsule_image || [])[8] || (jd.localized_capsule_image || [])[0];
      if (!cap) continue;
      out[name] = `https://clan.akamai.steamstatic.com/images/${BigInt(p.clan_steamid) - 103582791429521408n}/${cap}`;
      console.log('  steam cover:', name, '←', p.event_name);
      break;
    }
  }
  return out;
}
fs.writeFileSync(OUT, `// Game events (tools/update-events-wiki.mjs; how they work: tools/event-notes.mjs). Facts from royalquest.info.\n(function (d) { if (typeof module === 'object' && module.exports) module.exports = d; else window.RQ_BASE_EVENTS = d; })(${JSON.stringify(events)});\n`);
console.log(events.length, 'events →', OUT.pathname);
