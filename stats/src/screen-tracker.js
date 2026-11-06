// Turns repeated screen readings of the chat into new chat lines.
//
// The chat shows the last ~10 lines. Every reading is compared with the lines already seen,
// and only lines that appeared below them count as new. Lines that are already known
// (chat did not move, the player scrolled up, or switched tabs and back) are not counted again.

const { parseText } = require('./parser');

const LOOKALIKE = { 'З': '3', 'з': '3', 'О': '0', 'о': '0', 'O': '0', 'o': '0', 'I': '1', 'l': '1', '|': '1', 'Б': '6', 'б': '6' };
const D = '[0-9ЗзОоOoIl|Бб]';
const fixDigits = (s) => s.replace(/[ЗзОоOoIl|Бб]/g, (c) => LOOKALIKE[c]);
const TIME_RE = /^\s*\[?\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\]?\s*/;
const NUM_AFTER = new RegExp('(нанесли|вам|опыта:?|Поднято|восстановили|достигли)\\s+(' + D + '[' + D.slice(1, -1) + '\\s]*?)(?=\\s*(?:урона|золота|здоровья|уровня|\\.|$))', 'gi');
const QTY = new RegExp('\\((' + D + '+)\\s*шт', 'gi');

// The time at the start of a chat line is often read in pieces: "21 : з 2 : 50 Росинка".
// Drop leading tokens made only of digits, colons and digit look-alikes (when there is a digit or colon among them).
const TIME_TOKEN = /^[\d:;.,'`"|\[\]ЗзОоOoIlБб-]+$/;
function stripTime(text) {
  const tokens = text.split(' ');
  let i = 0;
  while (i < tokens.length - 1 && TIME_TOKEN.test(tokens[i])) i++;
  const head = tokens.slice(0, i).join('');
  let rest = i > 0 && /[\d:]/.test(head) ? tokens.slice(i) : tokens;
  // Chat buttons and icons on the left are read as "K", "•", "«A": messages always start with a Russian word.
  let j = 0;
  while (j < rest.length - 1 && (!/[А-Яа-яЁё]/.test(rest[j]) || TIME_TOKEN.test(rest[j]))) j++;
  rest = rest.slice(j);
  return rest.join(' ');
}

// Words that always start a message; their position shows where message text begins.
const ANCHOR_WORD = /^(вы|получен|поднято)$/i;

// Fixes typical recognition mistakes, e.g. "опыта: З." -> "опыта: 3."
function cleanOcrText(text) {
  return stripTime(text.replace(TIME_RE, '').replace(/\s+/g, ' ').trim())
    .replace(NUM_AFTER, (m, word, n) => word + ' ' + fixDigits(n).trim())
    .replace(QTY, (m, n) => '(' + fixDigits(n) + 'шт');
}

const keyOf = (text) => text.toLowerCase().replace(/ё/g, 'е').replace(/[^0-9a-zа-я]/g, '');

// Same line read twice may differ in a letter or two (the game shows through the chat).
// Numbers must always match, otherwise "79 урона" and "78 урона" would merge.
const digitsOf = (s) => s.replace(/\D/g, '');
function same(a, b) {
  if (a === b) return true;
  if (a.length < 8 || b.length < 8 || digitsOf(a) !== digitsOf(b)) return false;
  const la = a.replace(/\d/g, ''), lb = b.replace(/\d/g, '');
  const allowed = la.length >= 20 ? 2 : 1;
  if (Math.abs(la.length - lb.length) > allowed) return false;
  return editDistance(la, lb, allowed) <= allowed;
}

function editDistance(a, b, cap) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}

// Share of rows that match when `rows` is laid over `hist` starting at `at`.
function overlapScore(hist, at, rows, m) {
  let ok = 0;
  for (let k = 0; k < m; k++) if (same(hist[at + k], rows[k].key)) ok++;
  return ok / m;
}

class ScreenTracker {
  constructor() {
    this.history = [];
    this.started = false;
    this.anchorX = []; // where message text starts (left of it: time and chat buttons)
    this.unread = new Set(); // new rows that did not read as a message (maybe garbled): a clean reading counts later
  }

  textX() {
    if (this.anchorX.length < 3) return null;
    const s = this.anchorX.slice().sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }

  // Joins the words of one visual row, leaving out everything left of the message text.
  rowText(parts) {
    const words = [];
    for (const p of parts) {
      if (Array.isArray(p.words) && p.words.length) words.push(...p.words);
      else words.push({ t: p.text, x: p.x });
    }
    words.sort((a, b) => a.x - b.x);
    const anchor = words.find((w) => ANCHOR_WORD.test(w.t));
    if (anchor) {
      this.anchorX.push(anchor.x);
      if (this.anchorX.length > 40) this.anchorX.shift();
    }
    const tx = this.textX();
    let use = words;
    if (tx !== null) {
      const right = words.filter((w) => w.x >= tx - 4);
      if (right.length) use = right;
    }
    return cleanOcrText(use.map((w) => w.t).join(' '));
  }

  // Groups recognised text pieces into visual rows, top to bottom, and joins wrapped lines.
  rows(frame) {
    const pieces = (frame.lines || []).filter((l) => l && l.text).slice().sort((a, b) => a.y - b.y || a.x - b.x);
    const grouped = [];
    for (const p of pieces) {
      const last = grouped[grouped.length - 1];
      if (last && Math.abs(p.y - last.y) <= 6) {
        last.parts.push(p);
        last.r = Math.max(last.r, p.r);
      } else {
        grouped.push({ y: p.y, r: p.r, parts: [p] });
      }
    }
    const rows = grouped
      .map((g) => ({ r: g.r, text: this.rowText(g.parts) }))
      .filter((row) => row.text.length > 0);

    const out = [];
    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      const next = rows[i + 1];
      const nearEdge = frame.w && row.r > frame.w - 30;
      if (nearEdge && next && parseText(next.text).type === 'other') {
        row = { r: next.r, text: row.text + ' ' + next.text };
        i++;
      }
      out.push({ text: row.text, key: keyOf(row.text) });
    }
    return out.filter((row) => row.key.length > 0);
  }

  // Lays the reading over the end of history row by row, like a diff: OCR may drop a row, garble one,
  // or catch a row it missed before. Rows below the last old row are new; a row between old rows
  // that history lacks was missed earlier and is new too (it goes into history in its place).
  // Returns { fresh, keep, tail } (history = history[0..keep) + tail) or null when it does not fit.
  diff(c) {
    const h = this.history;
    const H = Math.min(h.length, c.length + 10), base = h.length - H, C = c.length;
    const MATCH = 1, GARBLED = -1, DROPPED = -0.6, EXTRA = -1;
    // dp[i][j]: best score of history tail rows (any start .. i) against reading rows 0 .. j
    const dp = [], how = [];
    for (let i = 0; i <= H; i++) { dp.push(new Array(C + 1).fill(-Infinity)); how.push(new Array(C + 1).fill(null)); }
    for (let i = 0; i <= H; i++) { dp[i][0] = 0; how[i][0] = 'start'; }
    for (let j = 1; j <= C; j++) { dp[0][j] = dp[0][j - 1] + EXTRA; how[0][j] = 'lead'; }
    for (let i = 1; i <= H; i++) for (let j = 1; j <= C; j++) {
      const eq = same(h[base + i - 1], c[j - 1].key);
      const opts = [[dp[i - 1][j - 1] + (eq ? MATCH : GARBLED), eq ? 'match' : 'garbled'], [dp[i - 1][j] + DROPPED, 'dropped'], [dp[i][j - 1] + EXTRA, 'extra']];
      for (const [v, op] of opts) if (v > dp[i][j]) { dp[i][j] = v; how[i][j] = op; }
    }
    // the old part of the reading ends where the history tail is used up; the rest is new
    let p = 0;
    for (let j = 1; j <= C; j++) if (dp[H][j] > dp[H][p]) p = j;
    const ops = [];
    for (let i = H, j = p; i > 0 || j > 0;) {
      const op = how[i][j];
      if (op === 'start' || op === null || op === 'lead') break;
      ops.push([op, i, j]);
      if (op === 'match' || op === 'garbled') { i--; j--; } else if (op === 'dropped') i--; else j--;
    }
    ops.reverse();
    const matches = ops.filter(([op]) => op === 'match').length;
    const lastMatched = ops.some(([op, i]) => op === 'match' && i === H);
    if (matches < 2 && !(matches === 1 && C <= 2 && lastMatched)) return null;
    const first = ops.find(([op]) => op !== 'extra');
    const tail = [], fresh = [];
    let seenOld = false;
    for (const [op, i, j] of ops) {
      if (op === 'garbled' && this.unread.has(h[base + i - 1]) && parseText(c[j - 1].text).type !== 'other') {
        // first read with broken digits («32и6 урона»), now clean: count it this time
        seenOld = true; this.unread.delete(h[base + i - 1]); tail.push(c[j - 1].key); fresh.push(c[j - 1]);
      } else if (op === 'match' || op === 'garbled') { seenOld = true; tail.push(h[base + i - 1]); }
      else if (op === 'dropped') tail.push(h[base + i - 1]);
      else if (seenOld) { tail.push(c[j - 1].key); fresh.push(c[j - 1]); } // a row missed by earlier readings
    }
    for (const row of c.slice(p)) { tail.push(row.key); fresh.push(row); }
    return { fresh, keep: base + first[1] - 1, tail };
  }

  // Returns rows from `c` that were not seen before, or null when the reading cannot be matched.
  align(c) {
    const h = this.history;
    const good = (score, m) => (m >= 3 ? score >= 0.6 : score === 1);

    // Usual case: the top of the reading continues the end of history; rows below it are new.
    // A long overlap with one misread row beats a short perfect one: in a fight the same hit
    // («Вы нанесли 3226 урона…») repeats, and a short match would count old rows again.
    let best = null;
    for (let m = Math.min(c.length, h.length); m >= 1; m--) {
      const score = overlapScore(h, h.length - m, c, m);
      const ok = Math.round(score * m), value = ok - 2 * (m - ok);
      if (good(score, m) && (!best || value > best.value)) best = { m, value };
    }
    if (best) return c.slice(best.m);
    // Scrolled up or switched tabs and back: the whole reading is somewhere in recent history.
    const from = Math.max(0, h.length - 400);
    for (let at = h.length - c.length; at >= from; at--) {
      if (good(overlapScore(h, at, c, c.length), c.length)) return [];
    }
    return null;
  }

  // Reading did not match history at all: count only rows that were not seen recently.
  unmatched(c) {
    const recent = this.history.slice(-60);
    const fresh = [];
    for (const row of c) {
      const i = recent.findIndex((k) => k !== null && same(k, row.key));
      if (i >= 0) recent[i] = null; else fresh.push(row);
    }
    return fresh;
  }

  // frame: { t, w, lines: [{ text, x, y, r }] } -> new events
  push(frame) {
    const rows = this.rows(frame);
    if (!rows.length) return [];
    if (!this.started) {
      // Lines already on screen at start are old: remember them, do not count them.
      this.history = rows.map((r) => r.key);
      this.started = true;
      return [];
    }
    let fresh;
    const d = this.diff(rows);
    if (d) {
      fresh = d.fresh;
      this.history = this.history.slice(0, d.keep).concat(d.tail);
    } else {
      fresh = this.align(rows);
      if (fresh === null) fresh = this.unmatched(rows);
      this.history.push(...fresh.map((r) => r.key));
    }
    if (this.history.length > 600) this.history.splice(0, this.history.length - 600);

    const events = [];
    for (const row of fresh) {
      const ev = parseText(row.text);
      if (ev.type === 'other') {
        this.unread.add(row.key);
        if (this.unread.size > 200) this.unread.delete(this.unread.values().next().value);
        continue;
      }
      ev.time = frame.t;
      ev.text = row.text;
      ev.src = 'screen';
      events.push(ev);
    }
    return events;
  }
}

module.exports = { ScreenTracker, cleanOcrText };
