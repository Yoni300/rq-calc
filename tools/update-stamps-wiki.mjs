// Replaces stamp data in data/rqdata.js with the current list from the Royal Quest Wiki
// (royalquest.info, category "Магические печати"). Anon's database has outdated stamps.
// Usage: node tools/update-stamps-wiki.mjs [--offline]   (--offline reuses source/wiki-stamps.json)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dataFile = path.join(root, 'data', 'rqdata.js');
const cacheFile = path.join(root, 'source', 'wiki-stamps.json');
const API = 'https://royalquest.info/api.php';

// ---- 1. download wikitext of every stamp page ----
async function download() {
  const pages = [];
  let cont = {};
  for (let i = 0; i < 20; i++) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', generator: 'categorymembers', gcmtitle: 'Категория:Магические печати', gcmlimit: '50',
      prop: 'revisions', rvprop: 'content|timestamp', rvslots: 'main', ...cont,
    });
    const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': 'rq-calc stamp updater' } });
    const j = await res.json();
    for (const p of Object.values(j.query?.pages || {})) {
      pages.push({ title: p.title, ts: p.revisions?.[0]?.timestamp, text: p.revisions?.[0]?.slots?.main?.['*'] || '' });
    }
    if (!j.continue) break;
    cont = j.continue;
  }
  return pages;
}
const pages = process.argv.includes('--offline') ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : await download();
fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
fs.writeFileSync(cacheFile, JSON.stringify(pages, null, 1));

// ---- 2. mappings: wiki codes -> bonus types, wiki item names -> equipment types ----
const CODE_TO_TYPE = {
  'Атк': 1, 'Попад': 20, 'СИЛ': 14, 'УДЧ': 19, 'Энрг': 4, 'КритШанс%': 12, 'Деф%': 7, 'Мана%': 10, 'МРег%': 32, 'Атк%': 6,
  'Энрг%': 9, 'Бег%': 29, 'Даль': 22, 'ХПКилл': 43, 'ВЫН': 18, 'УстНеж': 72, 'Деф': 2, 'ИНТ': 16, 'МаксХП': 3, 'ЭффОжог': 33,
  'АСпд%': 11, 'ХРег': 24, 'ЛВК': 17, 'ТЧН': 15, 'УстВозд': 66, 'УстЗмл': 65, 'УстОгн': 63, 'УстХаос': 67, 'УстЯд': 68,
  'УронЗмл%': 48, 'ЭффУвр': 39, 'Уворот': 21, 'УстВода': 64, 'Мана': 5, 'ЭффДеф': 38, 'Эксп%': 139, 'Голд%': 27,
  'ЭнергШот': 41, 'МанаШот': 42, 'УронВозд%': 49, 'МанаКилл': 45, 'МаксХП%': 8, 'ЭффСлаб': 36, 'УронОгн%': 46,
  'УронВода%': 47, 'УстГум': 268, 'ЭнергКилл': 44, 'ЭРег': 25, 'УстЖив': 70, 'УстНас': 78, 'ХПШот': 40, 'УронЧуд%': 60,
  'КритСила%': 13, 'ЭффКров': 35, 'Эксп': 23, 'УстПвП': 69, 'ЭффОтрв': 276,
};
const ITEM_TO_TYPE = {
  'Головные уборы': 1, 'Аксессуары для лица': 2, 'Доспехи': 3, 'Перчатки': 4, 'Поножи': 5, 'Обувь': 6, 'Щиты': 7, 'Орбы': 8,
  'Артефакты': 9, 'Тотемы': 10, 'Кольца': 11, 'Амулеты': 12, 'Двуручные мечи': 21, 'Двуручные молоты': 22, 'Двуручные топоры': 23,
  'Катары': 24, 'Кинжалы': 25, 'Книги': 26, 'Копья': 27, 'Косы': 28, 'Луки': 29, 'Мечи': 30, 'Молоты': 31, 'Мортиры': 32,
  'Пистолеты': 33, 'Ружья': 34, 'Силовые браслеты': 35, 'Топоры': 36,
};
const COLOR = { 'З': 1, 'С': 2, 'Ф': 3, 'О': 4 }; // green, blue, violet, orange

// ---- 3. load current data ----
delete require.cache[dataFile];
const D = require(dataFile);
const norm = s => s.toLowerCase().replace(/ё/g, 'е').replace(/[-‑–]/g, ' ').replace(/\s+/g, ' ').trim();
const bonusTypes = new Map(D.BonusType.map(b => [b.Id, b]));
const classByName = new Map(D.Class.map(c => [norm(c.Name), c.Id]));
const settings = Object.fromEntries(D.Setting.map(s => [s.Key, s.Value]));
const qualityMax = +settings.QualityMaxLevel || 60;
// stamp value = (min + (max - min) / (qualityMax - 10) * (level - 10)) * quality  → quality = value / coef(level)
const coefAt = (type, level) => {
  if (type.StampQualityMinCoef == null) return null;
  const step = (type.StampQualityMaxCoef - type.StampQualityMinCoef) / (qualityMax - 10);
  return type.StampQualityMinCoef + step * Math.max(0, level - 10);
};

const oldStamps = new Map(D.Stamp.map(s => [norm(s.Name), s]));
let nextStampId = Math.max(...D.Stamp.map(s => s.Id)) + 1;
let nextVariantId = Math.max(...D.StampVariant.map(v => v.Id)) + 1;
const Stamp = [], StampVariant = [], StampVariantBonus = [], StampEquipment = [], StampClass = [];
const problems = [];
const seen = new Set();

for (const p of pages.sort((a, b) => a.title.localeCompare(b.title, 'ru'))) {
  const m = p.text.match(/\{\{\s*Магическая печать([\s\S]*?)\}\}/);
  if (!m) { problems.push(`no template: ${p.title}`); continue; }
  const fields = {};
  for (const part of m[1].split('|').map(s => s.trim()).filter(Boolean)) {
    const i = part.indexOf('=');
    if (i > 0) fields[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  const name = p.title.replace(/^Печать\s+/i, '').trim();
  const display = name.charAt(0).toUpperCase() + name.slice(1);
  const key = norm(display);
  if (seen.has(key)) continue;
  seen.add(key);
  const level = +fields['Уровень'] || 65;
  const old = oldStamps.get(key);
  const stampId = old ? old.Id : nextStampId++;
  Stamp.push({ Id: stampId, Name: old ? old.Name : display, IsLegacy: 0 });

  for (const [k, v] of Object.entries(fields)) {
    const mm = k.match(/^Предмет\d*$/);
    if (mm) { const t = ITEM_TO_TYPE[v]; if (t) StampEquipment.push({ Stamp_Id: stampId, Type_Id: t }); else problems.push(`${p.title}: unknown item "${v}"`); }
    if (/^Класс\d*$/.test(k) && v) { const c = classByName.get(norm(v)); if (c) StampClass.push({ Stamp_Id: stampId, Class_Id: c }); else problems.push(`${p.title}: unknown class "${v}"`); }
  }
  const oldVariants = old ? D.StampVariant.filter(v => v.Stamp_Id === old.Id) : [];
  for (const [letter, colorId] of Object.entries(COLOR)) {
    const bonuses = Object.entries(fields).filter(([k]) => new RegExp(`^${letter}\\d+$`).test(k)).sort((a, b) => parseInt(a[0].slice(1)) - parseInt(b[0].slice(1)));
    if (!bonuses.length) continue;
    const variantId = oldVariants.find(v => v.Color_Id === colorId)?.Id ?? nextVariantId++;
    StampVariant.push({ Id: variantId, Stamp_Id: stampId, Color_Id: colorId });
    bonuses.forEach(([, raw], order) => {
      const [code, valStr] = raw.split(':').map(s => s.trim());
      const typeId = CODE_TO_TYPE[code];
      const value = parseFloat((valStr || '').replace(',', '.'));
      if (!raw) return; // empty field on the wiki page
      if (!typeId || !isFinite(value)) { problems.push(`${p.title}: bad bonus "${raw}"`); return; }
      const coef = coefAt(bonusTypes.get(typeId), level);
      StampVariantBonus.push({ StampVariant_Id: variantId, Type_Id: typeId, Value: value, OrderIndex: order, QualityValue: coef ? Math.round(value / coef * 1e6) / 1e6 : value });
    });
  }
}

// stamps that the wiki no longer has stay in the data as legacy (old builds keep working, the list hides them)
for (const s of D.Stamp) {
  if (Stamp.some(x => x.Id === s.Id)) continue;
  Stamp.push({ ...s, IsLegacy: 1 });
  for (const v of D.StampVariant.filter(v => v.Stamp_Id === s.Id)) {
    StampVariant.push(v);
    StampVariantBonus.push(...D.StampVariantBonus.filter(b => b.StampVariant_Id === v.Id));
  }
  StampEquipment.push(...D.StampEquipment.filter(e => e.Stamp_Id === s.Id));
}

D.Stamp = Stamp.sort((a, b) => a.Id - b.Id);
D.StampVariant = StampVariant.sort((a, b) => a.Id - b.Id);
D.StampVariantBonus = StampVariantBonus;
D.StampEquipment = StampEquipment;
D.StampClass = StampClass;
D.StampSource = { wiki: 'royalquest.info', updated: new Date().toISOString().slice(0, 10), latestEdit: pages.map(p => p.ts).sort().pop() };

const js = `(function (d) { if (typeof module === 'object' && module.exports) module.exports = d; else window.RQDATA = d; })(${JSON.stringify(D)});\n`;
fs.writeFileSync(dataFile, js);
console.log(`wiki stamps: ${seen.size}, kept as legacy: ${D.Stamp.filter(s => s.IsLegacy).length}, variants: ${StampVariant.length}`);
if (problems.length) console.log('problems:\n  ' + problems.join('\n  '));
