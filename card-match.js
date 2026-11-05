// Finds a card name in OCR lines (card scanner). OCR mixes up look-alike letters (Latin «o» / Cyrillic «о», «3» / «з»)
// and sometimes splits a long name over two lines, so names are compared loosely and neighbouring lines are joined.
'use strict';

const LOOKALIKE = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', 3: 'з', 0: 'о', 6: 'б' };
const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[a-z0-9]/g, ch => LOOKALIKE[ch] || ch).replace(/[^a-zа-я]/g, '');

function lev(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** signs: { "Карта Воко": 190, … } → match(lines, cursor) → { name, signs, score, text } or null */
function makeMatcher(signs) {
  const cards = Object.entries(signs).map(([name, n]) => ({ name, signs: n, key: norm(name) }));
  function best(text) {
    const t = norm(text);
    // every card name has «карта» in it; «арт» still passes when OCR got the first letter wrong
    if (t.length < 6 || !/арт/.test(t)) return null;
    let top = null;
    for (const c of cards) {
      // the whole name inside the line («Карта Воко (3 шт.)») wins; a longer name beats a shorter one it contains
      let score = t.includes(c.key) ? 1 + c.key.length / 1000 : 1 - lev(t, c.key) / Math.max(t.length, c.key.length);
      if (!top || score > top.score) top = { ...c, score };
    }
    return top;
  }
  return function match(lines, cursor) {
    const cand = [];
    lines.forEach((l, i) => {
      cand.push(l);
      // a name wrapped onto the next line: the line right below, starting about the same place
      const n = lines[i + 1];
      if (n && Math.abs(n.x - l.x) < 40 && n.y - l.y > 0 && n.y - l.y < 2.2 * Math.max(10, (l.b || l.y + 16) - l.y)) cand.push({ ...l, text: l.text + ' ' + n.text, r: Math.max(l.r, n.r), b: n.b });
    });
    let found = null;
    for (const l of cand) {
      const m = best(l.text);
      if (!m || m.score < 0.8) continue;
      const cx = (l.x + l.r) / 2, cy = l.y;
      const dist = cursor ? Math.hypot(cx - cursor.x, cy - cursor.y) : 0;
      // a clearly better match wins; between equally good ones, the one nearer to the mouse
      if (!found || m.score > found.score + 0.05 || (Math.abs(m.score - found.score) <= 0.05 && dist < found.dist)) {
        found = { name: m.name, signs: m.signs, score: Math.round(m.score * 1000) / 1000, text: l.text, dist };
      }
    }
    return found;
  };
}

module.exports = { makeMatcher, norm, lev };
