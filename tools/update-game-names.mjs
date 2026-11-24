// Names of game things in other languages, for the whole app (app/game-names.js swaps them on screen).
// English: the game's own English texts. The Steam client ships localization/ru/combined.lng and localization/en/combined.lng
// (same keys, UTF-16); extract both from your own copy of the game into a folder and pass it with --lng. The pairs that the
// app needs are kept in source/game-names-en.json, so later runs work without the game files.
// Fixes and names the game lacks: tools/game-names-manual.mjs. Only English is made (the user chose no Ukrainian, 2026-11-24).
// Writes data/names-en.js and source/game-names-missing-en.txt (what is still Russian).
// Usage: node tools/update-game-names.mjs [--lng <folder with localization_ru_combined.lng + localization_en_combined.lng>]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import MANUAL from './game-names-manual.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
// the key both here and in app/game-names.js: letter case, ё/е and extra spaces do not matter
const key = s => String(s).toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
const CYR = /[А-Яа-яЁё]/;

// ---------- every Russian string the app can show ----------
const ctx = { window: {}, console };
ctx.self = ctx.window;
vm.createContext(ctx);
const files = ['rqdata', 'bosses', 'market-items', 'base-monsters', 'base-world', 'base-goods', 'base-events', 'base-sources', 'base-stations',
  'base-icons', 'base-ref', 'card-signs'];
for (const f of files) vm.runInContext(fs.readFileSync(path.join(root, 'data', f + '.js'), 'utf8'), ctx, { filename: f });
const shown = new Set();
const take = s => { if (typeof s === 'string' && CYR.test(s) && s.length <= 120 && !s.includes('{')) shown.add(s.trim()); };
(function walk(v) {
  if (typeof v === 'string') return take(v);
  if (!v || typeof v !== 'object') return;
  if (!Array.isArray(v) && 'ru' in v && 'en' in v) return; // already has its own translations
  for (const [k, x] of Object.entries(v)) { if (!Array.isArray(v)) take(k); walk(x); }
})(ctx.window);
// parts of combined strings («Знак КАРП, Гиблые болота») are looked up one by one on screen as well
const SEP = /\s·\s|,\s|:\s|\s—\s|\s–\s|\s\/\s|[()«»"]/;
for (const s of [...shown]) for (const p of s.split(SEP)) if (CYR.test(p) && p.trim() !== s) take(p);

// ---------- the game's English ----------
const cacheFile = path.join(root, 'source', 'game-names-en.json');
let pairs; // key(ru) → en
const lngDir = arg('--lng');
if (lngDir) {
  const load = f => {
    const m = new Map();
    for (const line of fs.readFileSync(path.join(lngDir, f), 'utf16le').replace(/^﻿/, '').split(/\r?\n/)) {
      const i = line.indexOf('=');
      if (i > 0 && !line.startsWith('//')) m.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
    }
    return m;
  };
  const ru = load('localization_ru_combined.lng'), en = load('localization_en_combined.lng');
  // one Russian text can have several English ones: a monster's name wins over an item's, a name over any other text
  const rank = k => /^mobdb_\d+_runame$/.test(k) ? 0 : /^npc_\d+_runame$/.test(k) ? 1 : /^location_\d+_runame$/.test(k) ? 2
    : /^itemdb_\d+_runame$/.test(k) ? 3 : /^quest_\d+_runame$/.test(k) ? 4 : /name/i.test(k) ? 5 : 6;
  const best = new Map();
  for (const [k, r] of ru) {
    const e = en.get(k);
    if (!e || CYR.test(e) || !CYR.test(r) || r.length > 120 || /[<>{}]/.test(r + e)) continue;
    const kk = key(r), rk = rank(k), cur = best.get(kk);
    if (!cur || rk < cur.rk) best.set(kk, { rk, votes: new Map([[e, 1]]) });
    else if (rk === cur.rk) cur.votes.set(e, (cur.votes.get(e) || 0) + 1);
  }
  const all = new Map([...best].map(([k, v]) => [k, [...v.votes].sort((a, b) => b[1] - a[1])[0][0]]));
  // spelling the game and the wiki differ in: hyphens, quotes
  const loose = s => key(s).replace(/[-‐]/g, ' ').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
  const byLoose = new Map();
  for (const [k, v] of all) if (!byLoose.has(loose(k))) byLoose.set(loose(k), v);
  const find = s => all.get(key(s)) ?? byLoose.get(loose(s));
  function resolve(s, depth = 0) {
    if (!CYR.test(s)) return s;
    const hit = find(s); if (hit) return hit;
    if (depth > 2) return null;
    let m;
    if ((m = s.match(/^Рецепт:\s*(.+)$/i))) { const r = resolve(m[1], depth + 1); return r && 'Recipe: ' + r; }
    if ((m = s.match(/^(.+?)\s*[xх×]\s*(\d+)$/))) { const r = resolve(m[1], depth + 1); return r && `${r} x${m[2]}`; }
    if ((m = s.match(/^(.+?)\s*\(([^()]+)\)$/))) { const a = resolve(m[1], depth + 1), b = resolve(m[2], depth + 1); return a && b && `${a} (${b})`; }
    if ((m = s.match(/^Монстр\s+(.+)$/))) return resolve(m[1], depth + 1);
    return null;
  }
  pairs = {};
  for (const s of shown) { const r = resolve(s); if (r) pairs[key(s)] = r; }
  fs.writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(Object.entries(pairs).sort(([a], [b]) => a.localeCompare(b, 'ru'))), null, 0).replace(/","/g, '",\n"') + '\n');
} else {
  pairs = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
}

// ---------- the files the app loads ----------
function write(lang, base) {
  const dict = { ...base };
  for (const [ru, tr] of Object.entries(MANUAL[lang] || {})) dict[key(ru)] = tr;
  const out = path.join(root, 'data', `names-${lang}.js`);
  const body = JSON.stringify(Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b, 'ru'))), null, 0).replace(/","/g, '",\n"');
  fs.writeFileSync(out, `// Generated by tools/update-game-names.mjs — don't edit (fixes go to tools/game-names-manual.mjs).\n`
    + `// Russian game name (lower case, ё = е) → ${lang === 'en' ? 'the game\'s English name' : 'Ukrainian'}. app/game-names.js loads it.\n`
    + `(window.RQC_GAME_NAMES = window.RQC_GAME_NAMES || {}).${lang} = ${body};\n`);
  // what is still Russian on screen after app/game-names.js has done its best, and the Russian words left in it, most
  // frequent first: translating those words in tools/game-names-manual.mjs fixes the most text
  const left = [...shown].map(s => [s, gn.gnTranslate(dict, s)]).filter(([, t]) => CYR.test(t));
  const runs = new Map();
  for (const [, t] of left) for (const w of t.match(/[А-Яа-яЁё][А-Яа-яЁё'’ -]*[А-Яа-яЁё]|[А-Яа-яЁё]/g)) runs.set(w, (runs.get(w) || 0) + 1);
  fs.writeFileSync(path.join(root, 'source', `game-names-missing-${lang}.txt`),
    `# ${left.length} of ${shown.size} texts still have Russian in them. The Russian left, how often:\n`
    + [...runs].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru')).map(([w, n]) => `${n}\t${w}`).join('\n') + '\n');
  console.log(`${lang}: ${Object.keys(dict).length} names → data/names-${lang}.js; ${left.length} of ${shown.size} texts still have Russian, ${runs.size} different pieces (source/game-names-missing-${lang}.txt)`);
}
// app/game-names.js's translation itself (its page part needs a document; a stand-in is enough here)
const gn = { document: { querySelector: () => null }, MutationObserver: class { observe() {} disconnect() {} }, window: {} };
vm.createContext(gn);
vm.runInContext(fs.readFileSync(path.join(root, 'app', 'game-names.js'), 'utf8') + ';this.gnTranslate = gnTranslate;', gn);
write('en', pairs);
