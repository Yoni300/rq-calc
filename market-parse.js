// Market scanner: turns OCR lines of the in-game market table into { item, price } rows.
// Layout (RU client): header "Предмет | Ур. | Цена за штуку", one lot per row (icon, name in 1–2 lines, level, price),
// footer "1/64 … Всего предметов 508". Quantity on the icon is ignored. Names are matched against data/market-items.js.
'use strict';

const LATIN = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в' };
function norm(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е')
    .replace(/[a-z]/g, ch => LATIN[ch] || ch)            // OCR mixes look-alike Latin letters into Russian words
    .replace(/[^а-яa-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// catalog → matcher: exact normalized name, else the single closest name within a small edit distance
function makeMatcher(items) {
  const exact = new Map();
  for (const it of items) { const k = norm(it.name); if (!exact.has(k)) exact.set(k, it); }
  const keys = [...exact.keys()];
  return name => {
    const n = norm(name);
    if (n.length < 3) return null;
    if (exact.has(n)) return exact.get(n);
    const max = Math.max(1, Math.floor(n.length * 0.15));
    let best = null, bestD = max + 1, second = max + 1;
    for (const k of keys) {
      const d = lev(n, k, max);
      if (d < bestD) { second = bestD; bestD = d; best = k; } else if (d < second) second = d;
    }
    return best && bestD <= max && second > bestD ? exact.get(best) : null;
  };
}

const has = (l, re) => re.test(norm(l.text));
const PAGE_RE = /^\d{1,3}\s*\/\s*\d{1,3}$/; // the page counter "1/64"
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

// lines: [{ text, x, y, r, words: [{ t, x }] }] in one coordinate space.
// The header is optional (the table area may be cut right below it) and column positions differ between market tabs,
// so the price column is found from the numbers themselves: the busiest column of numbers right of the names.
function parsePage(lines, match) {
  const head = lines.find(l => has(l, /цена за шту/));
  const foot = lines.find(l => PAGE_RE.test(l.text.trim()) || has(l, /^вс\S{2,3} предмет/));
  const top = head ? head.y + 8 : -Infinity, bottom = foot ? foot.y - 5 : Infinity;
  const inside = l => l.y > top && l.y < bottom;

  // numbers: a line whose words after the coin icon ("О", "о", "•") are all digits — "9 999" is two words
  const nums = [];
  for (const l of lines) {
    if (!inside(l)) continue;
    const ws = l.words && l.words.length ? l.words : [{ t: l.text, x: l.x }];
    const k = ws.findIndex(w => /\d/.test(w.t));
    if (k < 0) continue;
    const digits = ws.slice(k).map(w => w.t).join(' ').trim();
    if (!/^\d{1,3}( \d{3})+$|^\d+$/.test(digits)) continue;
    nums.push({ y: l.y, x: ws[k].x, price: +digits.replace(/ /g, '') });
  }
  const names = lines.filter(l => inside(l) && /[а-яё]{2,}/i.test(l.text) && !has(l, /^(предмет|ур|цена за штуку|v цена за штуку)$/));
  if (!names.length || !nums.length) return { ok: false, reason: !names.length ? 'no-names' : 'no-prices' };
  const nameX = Math.min(...names.map(n => n.x));
  // price column: numbers right of the names (quantities on the icons are left of them), grouped by x; the
  // rightmost column that has at least half as many numbers as the busiest one (a level column can sit in between)
  const cols = [];
  for (const n of nums.filter(n => n.x > nameX + 60)) {
    const c = cols.find(c => Math.abs(c.x - n.x) <= 30);
    if (c) c.items.push(n); else cols.push({ x: n.x, items: [n] });
  }
  if (!cols.length) return { ok: false, reason: 'no-prices' };
  const most = Math.max(...cols.map(c => c.items.length));
  const col = cols.filter(c => c.items.length * 2 >= most).sort((a, b) => b.x - a.x)[0];
  const prices = col.items.filter(p => p.price > 0).sort((a, b) => a.y - b.y);
  const pitch = prices.length > 1 ? median(prices.slice(1).map((p, i) => p.y - prices[i].y)) : 60;
  const nameCol = names.filter(n => n.x < col.x - 20);

  const rows = [], unknown = [];
  for (const p of prices) {
    const parts = nameCol.filter(n => n.y >= p.y - pitch * 0.3 && n.y <= p.y + pitch * 0.45).sort((a, b) => a.y - b.y);
    if (!parts.length) continue;
    const name = parts.map(n => n.text.trim()).join(' ');
    const item = match(name);
    if (item) rows.push({ id: item.id, name: item.name, price: p.price });
    else unknown.push(name);
  }
  const pageLine = lines.find(l => PAGE_RE.test(l.text.trim()));
  return { ok: true, rows, unknown, page: pageLine ? pageLine.text.replace(/\s/g, '') : null };
}

module.exports = { norm, lev, makeMatcher, parsePage };
