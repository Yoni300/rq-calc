// «Справочник» of the Base: game mechanics that are not monsters, places or items — the experience table, elements,
// upgrade chances, daily rewards, guilds, achievements… Tables and numbers come from royalquest.info; the explanations
// are our own short points (tools/ref-notes.mjs), the wiki's article text is not copied.
// Usage: node tools/update-ref-wiki.mjs   → data/base-ref.js
//
// A section: { id, group, name, wiki, notes: { ru, uk }, tables: [{ title, head, rows, pct }] , dyn }
// A cell: text | { i: [names of things in the base], t: text } | { l: [{ n, c }] } | { v: value, s: small note, hl: 1 }.
// Names and titles that we wrote are { ru, uk, en } objects; what the wiki gives stays a Russian string.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, categoryPages, templateFields, clean, numbered } from './wiki-fetch.mjs';
import { REF_GROUPS, REF_NOTES, ITEM_NOTES, SHOP_GROUPS } from './ref-notes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const warn = m => console.log('  ! ' + m);
const pageText = async title => {
  const j = await api({ action: 'parse', prop: 'wikitext', page: title });
  if (!j.parse) throw new Error('wiki page not found: ' + title);
  return j.parse.wikitext['*'];
};

// ---------- wiki tables ----------
// split «a || b || c» on the separator, not inside [[…]] or {{…}}
function splitTop(s, sep) {
  const out = []; let d = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === '[[' || two === '{{') { d++; cur += two; i++; continue; }
    if (two === ']]' || two === '}}') { d--; cur += two; i++; continue; }
    if (d === 0 && two === sep) { out.push(cur); cur = ''; i++; continue; }
    cur += s[i];
  }
  out.push(cur);
  return out;
}
// «style="…" | text» → attributes and text (the first single pipe outside links, when the left part looks like attributes)
function cellOf(part, head) {
  let d = 0;
  for (let i = 0; i < part.length; i++) {
    const two = part.slice(i, i + 2);
    if (two === '[[' || two === '{{') { d++; i++; continue; }
    if (two === ']]' || two === '}}') { d--; i++; continue; }
    if (d === 0 && part[i] === '|') {
      const left = part.slice(0, i);
      if (/=/.test(left) && !/\[\[|\{\{/.test(left)) return { head, attrs: left.trim(), raw: part.slice(i + 1) };
      break;
    }
  }
  return { head, attrs: '', raw: part };
}
/** Every table of a page, nested ones too, in the order they open: [{ rows: [[{ head, attrs, raw }]] }]. */
function parseTables(text) {
  const out = [], stack = [];
  let cell = null;
  for (const line of text.split('\n')) {
    const l = line.trim();
    if (l.startsWith('{|')) { const t = { rows: [], row: null }; stack.push(t); out.push(t); cell = null; continue; }
    const t = stack[stack.length - 1];
    if (!t) continue;
    if (l.startsWith('|}')) { stack.pop(); cell = null; continue; }
    if (l.startsWith('|-')) { t.row = null; cell = null; continue; }
    if (l.startsWith('|+')) continue;
    if (l.startsWith('!') || l.startsWith('|')) {
      const head = l[0] === '!';
      if (!t.row) t.rows.push(t.row = []);
      for (const part of splitTop(l.slice(1), head ? '!!' : '||').flatMap(p => (head ? splitTop(p, '||') : [p]))) { cell = cellOf(part, head); t.row.push(cell); }
      continue;
    }
    if (cell) cell.raw += '\n' + l;
  }
  return out;
}
const FILE = /\[\[\s*(?:Файл|File|Изображение|Image)\s*:\s*([^|\]]+?)\s*((?:\|[^\]]*)?)\]\]/gi;
/** A cell's wiki text → a value: things shown with a picture become { i: [names] }; `byFile` names them after the picture. */
function val(raw, { byFile = false } = {}) {
  const items = [];
  let s = String(raw).replace(/<br\s*\/?>/gi, ' ').replace(FILE, (m, file, rest) => {
    const link = /\|\s*link\s*=\s*([^|\]]*)/i.exec(rest);
    if (byFile) items.push(file.replace(/\.(png|jpe?g|gif)$/i, '').replace(/_/g, ' ').trim());
    else if (link && link[1].trim()) items.push(link[1].trim());
    return ' ';
  }).replace(/\{\{[^{}]*\}\}/g, ' ');
  const one = /^\s*\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*$/.exec(s);
  if (one && !items.length) return { i: [one[1].trim()] };
  s = clean(s).replace(/\s+/g, ' ').trim();
  if (items.length) return !s || items.includes(s) ? { i: items } : { i: items, t: s };
  return s;
}
const textOf = c => (typeof c === 'string' ? c : c.t || (c.i || []).join(' '));
const headOf = t => (t.rows.find(r => r.some(c => c.head)) || []).map(c => textOf(val(c.raw)));
const bodyOf = (t, opt) => t.rows.filter(r => r.length && r.every(c => !c.head)).map(r => r.map(c => val(c.raw, opt)));
const tableWith = (tables, word) => { const t = tables.find(x => x.rows.some(r => r.some(c => c.head && c.raw.includes(word)))); if (!t) throw new Error('table not found: ' + word); return t; };
const sectionOf = (text, title) => { const m = new RegExp('^==+\\s*' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*==+\\s*$', 'm').exec(text); if (!m) throw new Error('section not found: ' + title); const rest = text.slice(m.index + m[0].length); const end = rest.search(/^==[^=]/m); return end < 0 ? rest : rest.slice(0, end); };
const num = s => String(s).replace(/\s+/g, ' ').trim();

// ---------- sections ----------
async function exp() {
  const tables = parseTables(await pageText('Таблица опыта'));
  const lv = bodyOf(tableWith(tables, 'Необходимый Опыт')).filter(r => r.length === 3 && /^\d+$/.test(r[0])).map(r => r.map(num));
  const cut = bodyOf(tableWith(tables, 'Разница в уровнях')).filter(r => r.length === 2).map(r => r.map(num));
  if (lv.length < 60) warn('exp: only ' + lv.length + ' levels');
  return [
    { title: { ru: 'Опыт по уровням', uk: 'Досвід за рівнями', en: 'Experience by level' }, head: [{ ru: 'Уровень', uk: 'Рівень', en: 'Level' }, { ru: 'Нужно опыта', uk: 'Треба досвіду', en: 'Exp needed' }, { ru: 'Всего опыта', uk: 'Усього досвіду', en: 'Total exp' }], rows: lv },
    { title: { ru: 'Опыт за монстра при разнице в уровнях', uk: 'Досвід за монстра при різниці в рівнях', en: 'Exp for a monster by level difference' }, head: [{ ru: 'Разница в уровнях', uk: 'Різниця в рівнях', en: 'Level difference' }, { ru: 'Опыт', uk: 'Досвід', en: 'Exp' }], rows: cut },
  ];
}
async function rest() {
  const rows = bodyOf(tableWith(parseTables(await pageText('Очки отдыха')), 'Очки отдыха')).filter(r => r.length === 3).map(r => r.map(num));
  return [{ head: [{ ru: 'Уровень', uk: 'Рівень', en: 'Level' }, { ru: 'Очки отдыха', uk: 'Очки відпочинку', en: 'Rest points' }, { ru: 'Доля опыта уровня', uk: 'Частка досвіду рівня', en: 'Share of the level' }], rows }];
}
async function elements() {
  const t = parseTables(await pageText('Элементы'))[0];
  const out = [];
  let cur = null;
  for (const r of t.rows) {
    if (r.some(c => c.head)) continue;
    const cells = r.map(c => ({ v: textOf(val(c.raw)), hl: /background/.test(c.attrs) }));
    const lvl = /^Уровень\s*(\d)/.exec(cells[0].v);
    if (lvl) { out.push(cur = { title: { ru: `Монстр с элементом ${lvl[1]} уровня`, uk: `Монстр з елементом ${lvl[1]} рівня`, en: `A monster with a level ${lvl[1]} element` }, pct: true, head: [{ ru: 'Защита монстра ↓ · атака →', uk: 'Захист монстра ↓ · атака →', en: 'Monster defence ↓ · attack →' }, ...cells.slice(1).map(c => c.v)], rows: [] }); continue; }
    if (cur && cells.length === cur.head.length) cur.rows.push(cells.map((c, i) => (i && c.hl ? { v: c.v, hl: 1 } : c.v)));
  }
  if (out.length !== 3 || out.some(x => x.rows.length !== 7)) warn('elements: unexpected shape ' + out.map(x => x.rows.length));
  return out;
}
async function trials() {
  const t = tableWith(parseTables(await pageText('Испытания')), 'Обломков древности');
  const rows = t.rows.filter(r => r.length === 6 && r.every(c => !c.head)).map(r => r.map((c, i) => val(c.raw, { byFile: i === 3 })));
  return [{ head: [{ ru: 'Подземелье', uk: 'Підземелля', en: 'Dungeon' }, { ru: 'Уровень', uk: 'Рівень', en: 'Level' }, { ru: 'Вход', uk: 'Вхід', en: 'Entrance' }, { ru: 'Питомец', uk: 'Вихованець', en: 'Pet' }, { ru: 'Тотемы', uk: 'Тотеми', en: 'Totems' }, { ru: 'Обломков древности', uk: 'Обломков древности', en: 'Ancient fragments' }], rows }];
}
async function daily() {
  const rows = [];
  let cur = null;
  for (const l of (await pageText('Ежедневные награды')).split('\n')) {
    const day = /\|\s*День\s*(\d+)\s*$/.exec(l);
    if (day) { rows.push(cur = { day: day[1], cells: [] }); continue; }
    const c = /^\{\{ЯчейкаЕжедневнаяНаграда\|([^|}]*)\|([^|}]*)\}\}/.exec(l.trim());
    if (c && cur) cur.cells.push(c[1].trim() ? { n: c[1].trim(), c: +c[2] || 1 } : null);
  }
  if (!rows.length) warn('daily rewards: no days found');
  return [{ head: [{ ru: 'День', uk: 'День', en: 'Day' }, { ru: 'Одна случайная награда', uk: 'Одна випадкова нагорода', en: 'One random reward' }, { ru: 'С премиумом', uk: 'З преміумом', en: 'With premium' }],
    rows: rows.map(r => [r.day, { l: r.cells.slice(0, 5).filter(Boolean) }, { l: r.cells.slice(5).filter(Boolean) }]) }];
}
const itemRows = (t, src) => t.rows.filter(r => r.every(c => !c.head)).map(r => {
  const name = r.map(c => val(c.raw)).find(v => v && v.i)?.i[0];
  if (!name) return null;
  if (!ITEM_NOTES[name]) warn(`${src}: no note for «${name}» (tools/ref-notes.mjs → ITEM_NOTES)`);
  return [{ i: [name] }, ITEM_NOTES[name] || ''];
}).filter(Boolean);
const ITEM_HEAD = [{ ru: 'Предмет', uk: 'Предмет', en: 'Item' }, { ru: 'Что делает', uk: 'Що робить', en: 'What it does' }];
async function upgrade() {
  const text = await pageText('Заточка');
  const out = [];
  const bonus = bodyOf(parseTables(sectionOf(text, 'Общее описание'))[0]).filter(r => r.length === 4).map(r => [num(r[0]), num(r[1]), num(r[3])]);
  out.push({ title: { ru: 'Что даёт заточка', uk: 'Що дає заточка', en: 'What an upgrade gives' }, head: [{ ru: 'Заточка', uk: 'Заточка', en: 'Upgrade' }, { ru: 'Защита экипировки', uk: 'Захист екіпіровки', en: 'Armour defence' }, { ru: 'Атака оружия', uk: 'Атака зброї', en: 'Weapon attack' }], rows: bonus });
  const items = parseTables(sectionOf(text, 'Предметы, используемые для заточки'));
  out.push({ title: { ru: 'Чем точат', uk: 'Чим точать', en: 'Upgrade items' }, head: ITEM_HEAD, rows: items.flatMap(t => itemRows(t, 'upgrade')) });
  const kinds = new Set([...text.matchAll(/Заточка_([^.\]|]+)\.png/g)].map(m => m[1]));
  for (const k of kinds) if (k !== 'успех' && k !== 'слом') warn('upgrade: unknown outcome picture «' + k + '»');
  for (const [heading, title] of [
    ['Шансы заточки одежды', { ru: 'Шансы: одежда', uk: 'Шанси: одяг', en: 'Chances: armour' }],
    ['Шансы заточки одноручных видов оружия, щитов и орбов', { ru: 'Шансы: одноручное оружие, щиты и орбы', uk: 'Шанси: одноручна зброя, щити й орби', en: 'Chances: one-handed weapons, shields and orbs' }],
    ['Шансы заточки двуручных видов оружия', { ru: 'Шансы: двуручное оружие', uk: 'Шанси: дворучна зброя', en: 'Chances: two-handed weapons' }],
  ]) {
    const t = parseTables(sectionOf(text, heading))[0];
    const stones = [...new Set(t.rows.flat().filter(c => c.head).map(c => val(c.raw)).filter(v => v && v.i).map(v => v.i[0]))];
    if (stones.length !== 5) warn(`upgrade «${heading}»: ${stones.length} stones`);
    const data = new Map();
    let lvl = null;
    for (const r of t.rows) {
      if (r.some(c => c.head)) continue;
      const cells = r.filter(c => !(/width=1px/.test(c.attrs + c.raw) && !val(c.raw)));
      const lv = cells.find(c => /^\+\d+$/.test(textOf(val(c.raw))));
      if (lv) lvl = textOf(val(lv.raw));
      const kind = cells.some(c => c.raw.includes('Заточка_успех')) ? 'ok' : cells.some(c => c.raw.includes('Заточка_слом')) ? 'br' : null;
      if (!lvl || !kind) continue;
      const vals = cells.map(c => textOf(val(c.raw))).filter(v => /^([<>~]?\s*\d+([.,]\d+)?%|—|-|–)$/.test(v));
      if (vals.length !== 15) { warn(`upgrade «${heading}» ${lvl} ${kind}: ${vals.length} values`); continue; }
      if (!data.has(lvl)) data.set(lvl, {});
      data.get(lvl)[kind] = vals;
    }
    ['C', 'B', 'A'].forEach((g, gi) => out.push({
      title: { ru: `${title.ru} — грейд ${g}`, uk: `${title.uk} — грейд ${g}`, en: `${title.en} — grade ${g}` }, chance: true,
      head: [{ ru: 'Заточка', uk: 'Заточка', en: 'Upgrade' }, ...stones.map(s => ({ i: [s] }))],
      rows: [...data].map(([lv, d]) => [lv, ...stones.map((_, si) => { const ok = (d.ok || [])[gi * 5 + si] ?? '', br = (d.br || [])[gi * 5 + si] ?? ''; return /\d/.test(br) ? { v: ok, s: br } : ok; })]),
    }));
  }
  const eleven = bodyOf(parseTables(sectionOf(text, 'Заточка предметов на +11'))[0]).map(r => r.filter(v => v !== '')).filter(r => r.length === 2).map(r => r.map(num));
  out.push({ title: { ru: 'Заточка на +11', uk: 'Заточка на +11', en: 'Upgrading to +11' }, head: [{ ru: 'Заточка второго предмета', uk: 'Заточка другого предмета', en: 'Upgrade of the second item' }, { ru: 'Шанс', uk: 'Шанс', en: 'Chance' }], rows: eleven });
  return out;
}
async function stamping() {
  const t = parseTables(sectionOf(await pageText('Наложение печатей'), 'Предметы, используемые при наложении печати'))[0];
  return [{ title: { ru: 'Чем ставят печать', uk: 'Чим ставлять печатку', en: 'Stamp items' }, head: ITEM_HEAD, rows: itemRows(t, 'stamping') }];
}
async function transfer() {
  const t = parseTables(sectionOf(await pageText('Перенос заточки и печатей'), 'Ресурсы, используемые при переносе'))[0];
  const rows = bodyOf(t).map(r => { const name = r.find(v => v && v.i)?.i[0], yn = r.filter(v => typeof v === 'string' && /^(Да|Нет)$/.test(v)); return name && yn.length === 3 ? [{ i: [name] }, ...yn] : null; }).filter(Boolean);
  if (!rows.length) warn('transfer: no resources');
  return [{ title: { ru: 'Что нужно для переноса', uk: 'Що потрібно для перенесення', en: 'What a move takes' }, head: [{ ru: 'Ресурс', uk: 'Ресурс', en: 'Resource' }, { ru: 'Только заточка', uk: 'Тільки заточка', en: 'Upgrade only' }, { ru: 'Только печать', uk: 'Тільки печатка', en: 'Stamp only' }, { ru: 'Заточка и печать', uk: 'Заточка і печатка', en: 'Both' }], rows }];
}
async function guilds() {
  const rows = bodyOf(tableWith(parseTables(await pageText('Таблица опыта гильдии')), 'Необходимый Опыт')).filter(r => r.length === 3 && /^\d+$/.test(r[0])).map(r => r.map(num));
  return [{ title: { ru: 'Опыт гильдии по уровням', uk: 'Досвід гільдії за рівнями', en: 'Guild experience by level' }, head: [{ ru: 'Уровень', uk: 'Рівень', en: 'Level' }, { ru: 'Нужно опыта', uk: 'Треба досвіду', en: 'Exp needed' }, { ru: 'Всего опыта', uk: 'Усього досвіду', en: 'Total exp' }], rows }];
}
async function servers() {
  const rows = [];
  let open = true, cur = null;
  for (const l of (await pageText('Серверы')).split('\n')) {
    if (/^==\s*Действующие/.test(l)) open = true;
    else if (/^==\s*Закрытые/.test(l)) open = false;
    const h3 = /^===\s*(.+?)\s*===/.exec(l);
    if (h3) { rows.push(cur = { name: clean(h3[1]).replace(/\s*\(закрыт\)\s*/i, ''), open, facts: [] }); continue; }
    if (/^==[^=]/.test(l)) { cur = null; continue; }
    if (cur && l.startsWith('*')) cur.facts.push(clean(l.replace(/^\*+\s*/, '')).replace(/\s+/g, ' ').replace(/[;.]\s*$/, ''));
  }
  if (!rows.some(r => r.open)) warn('servers: no open server found');
  return [{ head: [{ ru: 'Сервер', uk: 'Сервер', en: 'Server' }, { ru: 'Состояние', uk: 'Стан', en: 'State' }, { ru: 'Сведения', uk: 'Відомості', en: 'Facts' }],
    rows: rows.map(r => [r.name, r.open ? { v: { ru: 'работает', uk: 'працює', en: 'open' }, hl: 1 } : { ru: 'закрыт', uk: 'закритий', en: 'closed' }, r.facts.join('; ')]) }];
}
async function pvp() {
  const rows = [];
  let group = '';
  for (const l of (await pageText('PvP')).split('\n')) {
    if (!l.startsWith('*')) continue;
    const sub = l.startsWith('*:'), body = l.replace(/^\*:?\s*/, '');
    const link = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*(?:[—–-]\s*(.*))?$/.exec(body.trim());
    if (!sub && !link) { group = clean(body).replace(/:\s*$/, ''); continue; }
    if (!sub) group = '';
    if (link) rows.push([group, { i: [link[1].trim()] }, clean(link[2] || '')]);
  }
  if (rows.length < 10) warn('pvp: only ' + rows.length + ' locations');
  return [{ head: [{ ru: 'Где', uk: 'Де', en: 'Where' }, { ru: 'Локация', uk: 'Локація', en: 'Location' }, { ru: 'Уровень', uk: 'Рівень', en: 'Level' }], rows }];
}
async function achievements() {
  const by = new Map();
  for (const p of await categoryPages('Достижения')) {
    const f = templateFields(p.text, 'Достижение');
    if (!f) continue;
    const titles = [...numbered(f, 'Титул', 9), f['ТитулЖ']].filter(Boolean);
    const cat = f['Категория'] || '—';
    if (!by.has(cat)) by.set(cat, []);
    by.get(cat).push({ n: +f['Номер'] || 0, row: [p.title.replace(/^Достижение\s*[—-]\s*/, ''), f['Описание'] || numbered(f, 'Условие', 9).join('; '), f['Очки'] || '', [...new Set(titles)].join(' / ')] });
  }
  if (!by.size) warn('achievements: none found');
  return [...by].sort((a, b) => Math.min(...a[1].map(x => x.n)) - Math.min(...b[1].map(x => x.n))).map(([cat, list]) => ({
    title: `${cat} · ${list.length}`, fold: true,
    head: [{ ru: 'Достижение', uk: 'Досягнення', en: 'Achievement' }, { ru: 'Условие', uk: 'Умова', en: 'Condition' }, { ru: 'Очки', uk: 'Очки', en: 'Points' }, { ru: 'Титул', uk: 'Титул', en: 'Title' }],
    rows: list.sort((a, b) => a.n - b.n).map(x => x.row) }));
}
async function collections() {
  const rows = [];
  for (const p of await categoryPages('Коллекции')) {
    const f = templateFields(p.text, 'Коллекция');
    const items = f ? numbered(f, 'Предмет') : [];
    if (items.length) rows.push([p.title, { l: items.map(n => ({ n })) }]);
  }
  if (!rows.length) warn('collections: none found');
  rows.sort((a, b) => a[0].localeCompare(b[0], 'ru'));
  return [{ head: [{ ru: 'Коллекция', uk: 'Колекція', en: 'Collection' }, { ru: 'Предметы', uk: 'Предмети', en: 'Items' }], rows }];
}
async function seasons() {
  const list = [];
  for (const p of await categoryPages('Сезонные приключения')) {
    const f = templateFields(p.text, 'Сезонное приключение');
    if (!f || !f['НачалоГод']) continue;
    const d = k => `${f[k + 'Дата'].padStart(2, '0')}.${f[k + 'Месяц'].padStart(2, '0')}.20${f[k + 'Год']}`;
    const ev = f['Ивент'] || f['Событие'] || '';
    list.push({ key: `20${f['НачалоГод']}-${f['НачалоМесяц'].padStart(2, '0')}-${f['НачалоДата'].padStart(2, '0')}`,
      row: [p.title.replace(/^Сезонное приключение\s*[—-]\s*/, '').replace(/\s*\([^)]*\d{2}[^)]*\)\s*$/, ''), `${d('Начало')} – ${d('Конец')}`, ev ? { i: [ev] } : ''] });
  }
  if (!list.length) warn('seasons: none found');
  return [{ head: [{ ru: 'Приключение', uk: 'Пригода', en: 'Adventure' }, { ru: 'Даты', uk: 'Дати', en: 'Dates' }, { ru: 'Игровое событие', uk: 'Ігрова подія', en: 'Game event' }], rows: list.sort((a, b) => b.key.localeCompare(a.key)).map(x => x.row) }];
}
async function shop() {
  const f = templateFields(await pageText('Премиум магазин'), 'Премиум магазин');
  if (!f) { warn('shop: template not found'); return []; }
  const known = new Set(Object.entries(SHOP_GROUPS).flatMap(([k, [p]]) => [k, p]));
  for (const k of Object.keys(f)) { const pre = k.replace(/\d+$/, ''); if (!known.has(pre)) warn('shop: unknown field «' + k + '» (tools/ref-notes.mjs → SHOP_GROUPS)'); }
  return Object.entries(SHOP_GROUPS).map(([pre, [price, title]]) => {
    const rows = [];
    for (let n = 1; n <= 80; n++) {
      const v = f[pre + n];
      if (!v) continue;
      const m = /^(.*?)\s+x(\d+)$/.exec(v);
      rows.push([{ l: [m ? { n: m[1], c: +m[2] } : { n: v }] }, f[price + n] || '']);
    }
    return { title, head: [{ ru: 'Товар', uk: 'Товар', en: 'Item' }, { ru: 'Цена', uk: 'Ціна', en: 'Price' }], rows };
  }).filter(t => t.rows.length);
}

// id → [group, wiki page for the «on the wiki» link, how to build the tables (none: the notes are the whole page)]
const SECTIONS = {
  exp: ['char', 'Таблица опыта', exp],
  rest: ['char', 'Очки отдыха', rest],
  daily: ['char', 'Ежедневные награды', daily],
  dailyQuests: ['char', 'Ежедневные задания', null], // the table is made in the app from the quests of the base
  elements: ['fight', 'Элементы', elements],
  pvp: ['fight', 'PvP', pvp],
  upgrade: ['gear', 'Заточка', upgrade],
  stamping: ['gear', 'Наложение печатей', stamping],
  cards: ['gear', 'Вставка и извлечение карт', null],
  transfer: ['gear', 'Перенос заточки и печатей', transfer],
  trials: ['world', 'Испытания', trials],
  seasons: ['world', 'Сезонные приключения', seasons],
  servers: ['world', 'Серверы', servers],
  guilds: ['guild', 'Гильдии', guilds],
  achievements: ['misc', 'Достижения', achievements],
  collections: ['misc', 'Коллекции', collections],
  shop: ['misc', 'Премиум магазин', shop],
};

const out = [];
for (const [id, [group, wiki, build]] of Object.entries(SECTIONS)) {
  const n = REF_NOTES[id];
  if (!n) throw new Error('no notes for section ' + id);
  const tables = build ? await build() : [];
  const sec = { id, group: REF_GROUPS[group], name: n.name, wiki, notes: { ru: n.ru, uk: n.uk }, tables };
  if (id === 'dailyQuests') sec.dyn = 'dailyQuests';
  out.push(sec);
  console.log(`${id.padEnd(13)} ${tables.length} table(s), ${tables.reduce((s, t) => s + t.rows.length, 0)} rows`);
  for (const t of tables) if (!t.rows.length) warn(`${id}: an empty table`);
}
const file = path.join(root, 'data', 'base-ref.js');
fs.writeFileSync(file, `// «Справочник» of the Base (tools/update-ref-wiki.mjs; the explanations: tools/ref-notes.mjs). Tables and numbers from royalquest.info.
(function (d) { if (typeof module === 'object' && module.exports) module.exports = d; else window.RQ_BASE_REF = d; })(${JSON.stringify(out)});
`);
console.log('written', file, Math.round(fs.statSync(file).size / 1024) + ' KB');
