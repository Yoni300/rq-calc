// «Обмен» tool: reads the game's trade window from a frame — where it is, the five rows on each side
// (empty or not, item name, count) and the gold of each side.
// Ported from TradeCounterRQ by w-stus (github.com/w-stus/tradecounterRQ, src/TradeCounter.App/Screen/TradeReader.cs),
// used under its non-commercial license — see trade/LICENSE-TradeCounterRQ.txt. The geometry, thresholds and templates
// (trade/assets/*.png) are theirs; OpenCV / Tesseract are their JavaScript builds (opencv.js, tesseract.js).
// Changes: JavaScript; OCR results are cached by the exact pixels of the crop (the game draws a still window the same
// way every frame, so only a changed row is read again); a full search for the window runs at most once a second.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PSM = { SingleBlock: '6', SingleLine: '7', SingleWord: '8', SingleChar: '10', RawLine: '13' };

// ---------- a small PNG decoder (8-bit RGB / RGBA, not interlaced: the templates) → BGR Mat ----------
function readPng(file) {
  const b = fs.readFileSync(file);
  let o = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12] !== 0 || (ct !== 2 && ct !== 6)) throw new Error('unsupported PNG ' + file); }
    if (type === 'IDAT') idat.push(d);
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = ct === 6 ? 4 : 3, stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null, cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, up = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}

function createReader(cv, ocr, assets, resolveName, trace = null) {
  const tr = trace || (() => {});
  const Rect = (x, y, w, h) => new cv.Rect(x, y, w, h);
  // every Mat made inside `scope` is freed when it ends
  let arena = null;
  const keep = m => { if (arena) arena.push(m); return m; };
  const mat = () => keep(new cv.Mat());
  const scope = async fn => { const outer = arena; arena = []; try { return await fn(); } finally { for (const m of arena) m.delete(); arena = outer; } };
  const scopeSync = fn => { const outer = arena; arena = []; try { return fn(); } finally { for (const m of arena) m.delete(); arena = outer; } };
  // a copy, not clone(): in opencv.js a cloned ROI keeps the parent's row stride (its data reads as garbage)
  const crop = (m, r) => { const v = m.roi(r); const c = keep(new cv.Mat()); v.copyTo(c); v.delete(); return c; };
  const own = m => { const c = new cv.Mat(); m.copyTo(c); return c; };
  const resize = (src, w, h, interp = cv.INTER_LINEAR) => { const d = mat(); cv.resize(src, d, new cv.Size(w, h), 0, 0, interp); return d; };
  const scaleBy = (src, f, interp = cv.INTER_LINEAR) => { const d = mat(); cv.resize(src, d, new cv.Size(0, 0), f, f, interp); return d; };
  const gray = src => { const d = mat(); cv.cvtColor(src, d, cv.COLOR_BGR2GRAY); return d; };
  const matchScore = (image, template) => scopeSync(() => {
    if (template.cols > image.cols || template.rows > image.rows) return { score: 0, loc: { x: 0, y: 0 } };
    const r = mat(); cv.matchTemplate(image, template, r, cv.TM_CCOEFF_NORMED);
    const mm = cv.minMaxLoc(r);
    return { score: mm.maxVal, loc: mm.maxLoc };
  });
  // bounding box of the non-zero pixels of a CV_8UC1 Mat
  const nonZeroBox = m => {
    const d = m.data, w = m.cols, h = m.rows; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? { x: 0, y: 0, width: 0, height: 0 } : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  };
  const loadGray = name => {
    const p = readPng(path.join(assets, name));
    const m = new cv.Mat(p.h, p.w, p.bpp === 4 ? cv.CV_8UC4 : cv.CV_8UC3); m.data.set(p.data);
    const g = new cv.Mat(); cv.cvtColor(m, g, p.bpp === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_RGB2GRAY); m.delete();
    return g;
  };
  const header = loadGray('trade-header.png');
  const cancelButton = loadGray('trade-cancel-button.png');
  const emptyIcons = fs.readdirSync(assets).filter(f => /^empty-icon-.*\.png$/.test(f)).map(loadGray);

  // ---------- OCR with a cache: same pixels, same answer ----------
  const cache = new Map();
  const hashMat = (m, salt) => { let h = 2166136261 ^ salt.length; for (const ch of salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); const d = m.data; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return `${salt}|${m.cols}x${m.rows}|${h >>> 0}`; };
  const toPgm = m => Buffer.concat([Buffer.from(`P5\n${m.cols} ${m.rows}\n255\n`), Buffer.from(m.data)]);

  /** RecognizeRaw: { text, conf } (conf 0…1) */
  async function recognizeRaw(input, numeric, { gold = false, colorMask = false, threshold = null, psm = null, tightGold = false } = {}) {
    return scope(async () => {
      let g = gray(input);
      if (gold || colorMask) {
        const cm = keep(new cv.Mat(input.rows, input.cols, cv.CV_8UC1, new cv.Scalar(0)));
        const d = input.data, o = cm.data;
        if (gold) {
          // confirmation darkens the yellow glyphs: keep their whole strokes, leave out the green overlay by chroma
          for (let i = 0, j = 0; j < o.length; i += 3, j++) { const b = d[i], gg = d[i + 1], r = d[i + 2]; o[j] = r >= 85 && gg >= 80 && r >= gg * 0.6 && b < r * 0.95 ? 255 : 0; }
          const labels = mat(), stats = mat(), cents = mat();
          cv.connectedComponentsWithStats(cm, labels, stats, cents);
          const L = labels.data32S;
          for (let j = 0; j < o.length; j++) if (L[j] > 0 && stats.intAt(L[j], cv.CC_STAT_HEIGHT) < 6) o[j] = 0;
        } else {
          for (let i = 0, j = 0; j < o.length; i += 3, j++) o[j] = d[i + 1] >= 145 && d[i + 2] >= 150 ? 255 : 0;
        }
        g = cm;
      }
      if (cv.countNonZero(g) === 0) return { text: null, conf: 0 };
      const box = gold && tightGold ? nonZeroBox(g) : { x: 0, y: 0, width: g.cols, height: g.rows };
      const region = crop(g, Rect(box.x, box.y, box.width, box.height));
      const big = scaleBy(region, 4, cv.INTER_CUBIC);
      const bin = mat(); cv.threshold(big, bin, threshold ?? (gold || colorMask ? 120 : numeric ? 140 : 120), 255, cv.THRESH_BINARY_INV);
      const bordered = mat(); cv.copyMakeBorder(bin, bordered, 16, 16, 16, 16, cv.BORDER_CONSTANT, new cv.Scalar(255));
      const mode = psm ?? (numeric && !gold ? PSM.SingleLine : PSM.SingleBlock);
      const key = hashMat(bordered, `${numeric ? 'd' : 't'}${mode}`);
      if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
      const r = await ocr(numeric ? 'digits' : 'text', mode, toPgm(bordered));
      const text = String(r.text || '').replace(/\s+/g, ' ').trim();
      const v = { text: text || null, conf: (r.confidence || 0) / 100 };
      tr(`ocr ${numeric ? 'digits' : 'text'} psm=${mode} ${bordered.cols}x${bordered.rows} → ${JSON.stringify(v.text)} ${v.conf.toFixed(2)}`);
      cache.set(key, v); if (cache.size > 600) cache.delete(cache.keys().next().value);
      return v;
    });
  }
  const recognize = async (input, numeric, gold = false) => { const r = await recognizeRaw(input, numeric, { gold }); return r.conf >= (numeric ? 0.5 : 0.45) ? r.text : null; };
  const parseCount = s => (s != null && /^\d+$/.test(s) ? Number(s) : null);

  // ---------- where the window is ----------
  let cached = null, lastFullSearch = 0, lastScale = null;
  let lastIssue = null;
  function validateGeometry(g, r, requireAligned = false) {
    if (r.x < 0 || r.y < 0 || r.x + r.width > g.cols || r.y + r.height > g.rows) return false;
    return scopeSync(() => {
      const canonical = resize(crop(g, Rect(r.x, r.y, r.width, r.height)), 430, 520);
      const h = matchScore(crop(canonical, Rect(120, 10, 177, 32)), header);
      if (h.score < 0.72) return false;
      if (requireAligned && (h.loc.x !== 5 || h.loc.y !== 4)) return false;
      // «Отмена» stays the same through the countdown and every confirmation state
      return matchScore(crop(canonical, Rect(213, 477, 130, 29)), cancelButton).score >= 0.75;
    });
  }
  function tryScale(g, search, scale, bestScore) {
    return scopeSync(() => {
      const t = scaleBy(header, scale * 0.5, cv.INTER_AREA);
      if (t.cols > search.cols || t.rows > search.rows) return null;
      const m = matchScore(search, t);
      if (m.score < bestScore) return null;
      const full = scaleBy(header, scale);
      const rx = Math.max(0, m.loc.x * 2 - 4), ry = Math.max(0, m.loc.y * 2 - 4), rw = full.cols + 8, rh = full.rows + 8;
      if (rx + rw > g.cols || ry + rh > g.rows) return null;
      const refined = matchScore(crop(g, Rect(rx, ry, rw, rh)), full).loc;
      const ex = refined.x + rx, ey = refined.y + ry;
      const r = { x: Math.round(ex - 125 * scale), y: Math.round(ey - 14 * scale), width: Math.round(430 * scale), height: Math.round(520 * scale) };
      if (r.x < 0 || r.y < 0 || r.x + r.width > g.cols || r.y + r.height > g.rows) { lastIssue = 'cut'; return null; }
      if (!validateGeometry(g, r)) { lastIssue = 'geometry'; return null; }
      return { rect: r, scale, score: m.score };
    });
  }
  function locate(g, now) {
    if (cached && validateGeometry(g, cached.rect, true)) return cached;
    cached = null;
    return scopeSync(() => {
      const search = scaleBy(g, 0.5, cv.INTER_AREA);
      // the scale that worked last time first; the whole range (60 %…210 %) at most once a second
      if (lastScale != null) { const hit = tryScale(g, search, lastScale, 0.63); if (hit) return (cached = hit); }
      if (now - lastFullSearch < 1000) return null;
      lastFullSearch = now;
      let best = null, bestScore = 0.63;
      for (let step = 0; step <= 30; step++) {
        const hit = tryScale(g, search, 0.6 + step * 0.05, bestScore);
        if (hit) { best = hit; bestScore = hit.score; }
      }
      if (best) lastScale = best.scale;
      return (cached = best);
    });
  }

  // ---------- one row / one side ----------
  function classify(name, icon) {
    return scopeSync(() => {
      const bright = mat(); cv.threshold(gray(name), bright, 140, 255, cv.THRESH_BINARY);
      if (cv.countNonZero(bright) > 12) return 'occupied';
      const ig = gray(icon);
      let diff = Infinity;
      for (const t of emptyIcons) {
        const rt = resize(t, ig.cols, ig.rows), d = mat(); cv.absdiff(ig, rt, d);
        diff = Math.min(diff, cv.mean(d)[0]);
      }
      if (diff > 24) return 'occupied';
      // careful: content that is not clearly empty never silently becomes an empty row
      if (diff > 14) return 'uncertain';
      return 'empty';
    });
  }
  async function readName(input) {
    const primary = await recognize(input, false);
    if (!resolveName) return primary;
    if (primary && resolveName(primary)) return resolveName(primary);
    const candidates = new Set();
    for (const threshold of [90, 100, 140]) {
      const alt = await recognizeRaw(input, false, { threshold });
      const n = alt.conf >= 0.45 && alt.text ? resolveName(alt.text) : null;
      if (n) candidates.add(n);
    }
    return candidates.size === 1 ? [...candidates][0] : candidates.size > 1 ? null : primary;
  }
  async function readCounterGlyphs(input) {
    return scope(async () => {
      const rows = input.rows, cols = input.cols, d = input.data;
      const mask = keep(new cv.Mat(rows, cols, cv.CV_8UC1, new cv.Scalar(0))), o = mask.data;
      for (let i = 0, j = 0; j < o.length; i += 3, j++) {
        const lo = Math.min(d[i], d[i + 1], d[i + 2]), hi = Math.max(d[i], d[i + 1], d[i + 2]);
        if (lo > 130 && hi - lo < 40) o[j] = 255;
      }
      const labels = mat(), stats = mat(), cents = mat();
      const count = cv.connectedComponentsWithStats(mask, labels, stats, cents);
      const touchesTop = new Array(count).fill(false);
      for (let i = 1; i < count; i++) touchesTop[i] = stats.intAt(i, cv.CC_STAT_TOP) === 0;
      const L = labels.data32S;
      for (let j = 0; j < o.length; j++) if (touchesTop[L[j]]) o[j] = 0;
      // whole vertical bands, not components: an anti-aliased «5» can be several separate bright strokes
      const hasInk = x => { for (let y = 0; y < rows; y++) if (o[y * cols + x]) return true; return false; };
      let column = 0;
      while (column < cols) {
        if (!hasInk(column)) { column++; continue; }
        const start = column;
        while (column < cols && hasInk(column)) column++;
        let y0 = rows, y1 = -1;
        for (let y = 0; y < rows; y++) for (let x = start; x < column; x++) if (o[y * cols + x]) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const height = y1 - y0 + 1, bottom = y1 + 1;
        // small icon highlights go by glyph height, not by a fixed baseline
        if (height < Math.max(3, Math.floor(rows / 3)) || bottom < Math.floor(rows / 2))
          for (let y = 0; y < rows; y++) for (let x = start; x < column; x++) o[y * cols + x] = 0;
      }
      tr(`counter mask pixels=${cv.countNonZero(mask)}`);
      if (cv.countNonZero(mask) === 0) return { value: null, ambiguous: false };
      const box = nonZeroBox(mask);
      tr(`counter box=${JSON.stringify(box)} of ${cols}x${rows}`);
      if (box.x === 0 || box.x + box.width >= cols || box.y === 0 || box.y + box.height >= rows) return { value: null, ambiguous: true };
      const ex = Math.max(0, box.x - 1), ey = Math.max(0, box.y - 1);
      const expanded = Rect(ex, ey, Math.min(cols, box.x + box.width + 1) - ex, Math.min(rows, box.y + box.height + 1) - ey);
      const original = crop(input, expanded);
      const binary = mat(); cv.cvtColor(crop(mask, expanded), binary, cv.COLOR_GRAY2BGR);
      const candidates = new Set();
      for (const threshold of [90, 120, 140]) {
        const r = await recognizeRaw(original, true, { threshold });
        const n = parseCount(r.text);
        if (r.conf >= 0.5 && n > 0) candidates.add(n);
      }
      // the mask finds the glyphs but can eat anti-aliased strokes: the original pixels first, the mask only as a fallback
      if (!candidates.size) {
        const r = await recognizeRaw(binary, true);
        const n = parseCount(r.text);
        if (r.conf >= 0.5 && n > 0) candidates.add(n);
      }
      return { value: candidates.size === 1 ? [...candidates][0] : null, ambiguous: candidates.size > 1 };
    });
  }
  async function readGoldGroups(input) {
    // widely spaced thousands can have zero whole-line confidence: read each group, all of them must succeed
    const rows = input.rows, cols = input.cols, d = input.data;
    const ink = new Uint8Array(cols);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const i = (y * cols + x) * 3, b = d[i], g = d[i + 1], r = d[i + 2]; if (r >= 85 && g >= 80 && r >= g * 0.6 && b < r * 0.95) ink[x] = 1; }
    const columns = []; for (let x = 0; x < cols; x++) if (ink[x]) columns.push(x);
    if (!columns.length || columns[0] === 0 || columns[columns.length - 1] === cols - 1) return null;
    let text = '';
    for (let i = 0; i < columns.length;) {
      let end = i;
      while (end + 1 < columns.length && columns[end + 1] - columns[end] < 5) end++;
      const group = scopeSync(() => own(crop(input, Rect(columns[i] - 1, 0, columns[end] - columns[i] + 3, rows))));
      const candidates = new Set();
      try {
        for (const psm of [PSM.SingleWord, PSM.SingleChar, PSM.SingleLine]) {
          const r = await recognizeRaw(group, true, { gold: true, psm, tightGold: true });
          const digits = r.text ? r.text.replace(/ /g, '') : '';
          if (r.conf >= 0.5 && /^\d+$/.test(digits)) candidates.add(digits);
        }
      } finally { group.delete(); }
      if (candidates.size !== 1) return null;
      text += [...candidates][0];
      i = end + 1;
    }
    return text ? Number(text) : null;
  }
  async function readNumber(input, gold) {
    if (!gold) {
      const isolated = await readCounterGlyphs(input);
      if (isolated.ambiguous) return null;
      if (isolated.value != null) return isolated.value;
      // a visibly clipped first digit is never accepted
      const clipped = scopeSync(() => { const e = mat(); cv.threshold(gray(crop(input, Rect(0, 0, 2, input.rows))), e, 100, 255, cv.THRESH_BINARY); return cv.countNonZero(e) > 1; });
      if (clipped) return null;
    }
    const full = await recognizeRaw(input, true, { gold });
    const value = full.text ? full.text.replace(/ /g, '') : null;
    if (full.conf < 0.5) {
      if (gold) {
        const alts = new Set();
        for (const psm of [PSM.SingleWord, PSM.RawLine, PSM.SingleChar]) {
          const r = await recognizeRaw(input, true, { gold: true, psm, tightGold: true });
          const n = parseCount(r.text);
          if (r.conf >= 0.5 && n != null) alts.add(n);
        }
        return alts.size === 1 ? [...alts][0] : alts.size > 1 ? null : readGoldGroups(input);
      }
      if (value == null) return null;
      // a low-confidence whole read needs a confident read of the right edge that agrees with it
      const edge = scopeSync(() => own(crop(input, Rect(Math.max(0, input.cols - 26), 0, Math.min(22, input.cols), input.rows))));
      let second;
      try { second = await recognizeRaw(edge, true, { colorMask: true }); } finally { edge.delete(); }
      if (second.conf < 0.5 || (second.text || '').replace(/ /g, '') !== value) return null;
    }
    return parseCount(value);
  }
  async function readSide(frame, right) {
    const rows = [];
    for (let i = 0; i < 5; i++) {
      const y = 114 + 60 * i;
      const nameImage = crop(frame, Rect(right ? 284 : 89, y + 2, right ? 111 : 119, 49));
      const iconArea = crop(frame, Rect(right ? 230 : 32, y + 2, 45, 49));
      const occupancy = classify(nameImage, iconArea);
      let name = null, quantity = null;
      if (occupancy !== 'empty') {
        name = await readName(nameImage);
        quantity = await readNumber(crop(frame, Rect(right ? 228 : 30, y + 38, 50, 18)), false);
      }
      rows.push({ index: i, occupancy, name, quantity });
    }
    const gold = await readNumber(crop(frame, Rect(right ? 239 : 42, 429, 146, 18)), true);
    return { rows, gold };
  }

  // ---------- the trade history (HistoryReading.cs): the backpack gold and whether the offer changed ----------
  const walletAnchor = loadGray('wallet-anchor.png'), walletBottom = loadGray('wallet-bottom.png');
  let walletCache = null, walletScale = null, walletFullSearch = 0;
  function validateWallet(g, r) {
    if (r.x < 0 || r.y < 0 || r.x + r.width > g.cols || r.y + r.height > g.rows) return false;
    return scopeSync(() => {
      const n = resize(crop(g, Rect(r.x, r.y, r.width, r.height)), 149, 32);
      return matchScore(crop(n, Rect(0, 0, 32, 32)), walletAnchor).score >= 0.78 && matchScore(crop(n, Rect(0, 27, 149, 5)), walletBottom).score >= 0.72;
    });
  }
  function tryWallet(g, search, scale, best) {
    return scopeSync(() => {
      const small = scaleBy(walletAnchor, scale * 0.5, cv.INTER_AREA);
      if (small.cols > search.cols || small.rows > search.rows) return null;
      const m = matchScore(search, small);
      if (m.score < best) return null;
      const full = scaleBy(walletAnchor, scale);
      const bx = Math.max(0, m.loc.x * 2 - 3), by = Math.max(0, m.loc.y * 2 - 3), bw = full.cols + 6, bh = full.rows + 6;
      if (bx + bw > g.cols || by + bh > g.rows) return null;
      const off = matchScore(crop(g, Rect(bx, by, bw, bh)), full).loc;
      const r = { x: bx + off.x, y: by + off.y, width: Math.round(149 * scale), height: Math.round(32 * scale) };
      return validateWallet(g, r) ? { rect: r, scale, score: m.score } : null;
    });
  }
  function locateWallet(g, now) {
    if (walletCache && validateWallet(g, walletCache.rect)) return walletCache;
    walletCache = null;
    return scopeSync(() => {
      const search = scaleBy(g, 0.5, cv.INTER_AREA);
      if (walletScale != null) { const hit = tryWallet(g, search, walletScale, 0.78); if (hit) return (walletCache = hit); }
      // not in TradeCounterRQ: the whole scale range at most once a second (it is slow in JavaScript)
      if (now - walletFullSearch < 1000) return null;
      walletFullSearch = now;
      let best = 0.78;
      for (let step = 0; step <= 30; step++) { const hit = tryWallet(g, search, 0.6 + step * 0.05, best); if (hit) { walletCache = hit; best = hit.score; } }
      if (walletCache) walletScale = walletCache.scale;
      return walletCache;
    });
  }
  async function readBackpackGold(bgr, g, now) {
    const located = locateWallet(g, now);
    tr(`wallet ${located ? JSON.stringify(located.rect) : 'not found'}`);
    if (!located) return null;
    return scope(async () => {
      const r = located.rect;
      const number = crop(resize(crop(bgr, Rect(r.x, r.y, r.width, r.height)), 149, 32), Rect(34, 3, 108, 24));
      // the spaced number reads badly as a whole line: every ink group on its own, all of them must succeed
      const m = mat(); cv.threshold(gray(number), m, 90, 255, cv.THRESH_BINARY);
      const w = m.cols, h = m.rows, d = m.data, columns = [];
      for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) if (d[y * w + x]) { columns.push(x); break; } }
      if (!columns.length || columns[0] === 0 || columns[columns.length - 1] === w - 1) return null;
      let result = '';
      for (let start = 0; start < columns.length;) {
        let end = start;
        while (end + 1 < columns.length && columns[end + 1] - columns[end] < 5) end++;
        const left = columns[start] - 1;
        const group = crop(number, Rect(left, 0, Math.min(columns[end] - left + 2, w - left), h));
        const first = await recognizeRaw(group, true, { threshold: 90, psm: PSM.SingleWord });
        let text = first.conf >= 0.7 ? first.text : null;
        if (text == null) {
          const alts = new Set();
          for (const threshold of [90, 100, 120]) for (const psm of [PSM.SingleWord, PSM.SingleLine]) {
            const a = await recognizeRaw(group, true, { threshold, psm });
            if (a.conf >= 0.7 && a.text && /^\d+$/.test(a.text)) alts.add(a.text);
          }
          if (alts.size === 1) text = [...alts][0];
        }
        if (!text || !/^\d+$/.test(text)) return null;
        result += text;
        start = end + 1;
      }
      return result ? Number(result) : null;
    });
  }
  // the offer changed (an item put in or taken out): a 9×8 difference hash of each row, both sides
  let contentSignature = null, pendingSignature = null, signatureAgreement = 0, contentRevision = 0;
  const popcount = n => { n -= (n >>> 1) & 0x55555555; n = (n & 0x33333333) + ((n >>> 2) & 0x33333333); return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
  function updateContentRevision(canonicalGray) {
    const sig = scopeSync(() => {
      const out = [];
      for (const right of [false, true]) for (let row = 0; row < 5; row++) {
        // spatial differences ignore an even tint (the green confirmation): icon, count and name, not the border or buttons
        const small = resize(crop(canonicalGray, Rect(right ? 232 : 34, 118 + row * 60, 160, 44)), 9, 8, cv.INTER_AREA), d = small.data;
        let lo = 0, hi = 0;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (d[y * 9 + x] > d[y * 9 + x + 1] + 2) { const bit = y * 8 + x; if (bit < 32) lo |= 1 << bit; else hi |= 1 << (bit - 32); }
        out.push([lo >>> 0, hi >>> 0]);
      }
      return out;
    });
    const similar = (a, b) => a.every((p, i) => popcount(p[0] ^ b[i][0]) + popcount(p[1] ^ b[i][1]) < 12);
    if (!contentSignature) { contentSignature = sig; return; }
    if (similar(contentSignature, sig)) { pendingSignature = null; signatureAgreement = 0; return; }
    signatureAgreement = pendingSignature && similar(pendingSignature, sig) ? signatureAgreement + 1 : 1;
    pendingSignature = sig;
    if (signatureAgreement < 2) return;
    contentRevision++; contentSignature = sig; pendingSignature = null; signatureAgreement = 0;
  }

  /** frame: { width, height, data: RGBA } → { exchange: 'present'|'absent'|'unknown', offer: { received, given } | null, rect,
      issue, backpackGold, contentRevision, contentUncertain }. The backpack gold is read only when wantGold says so. */
  async function read(frame, now = Date.now(), wantGold = false) {
    lastIssue = null;
    return scope(async () => {
      const rgba = keep(new cv.Mat(frame.height, frame.width, cv.CV_8UC4)); rgba.data.set(frame.data);
      const bgr = mat(); cv.cvtColor(rgba, bgr, cv.COLOR_RGBA2BGR);
      const g = gray(bgr);
      const geometry = locate(g, now);
      let offer = null;
      if (geometry) {
        lastIssue = null;
        const r = geometry.rect;
        const normalized = resize(crop(bgr, Rect(r.x, r.y, r.width, r.height)), 430, 520);
        offer = { received: await readSide(normalized, false), given: await readSide(normalized, true) };
        updateContentRevision(gray(normalized));
      }
      // unknown is never «no trade»: the window may be there but cut off or covered
      const exchange = offer ? 'present' : lastIssue ? 'unknown' : 'absent';
      if (exchange === 'absent') { contentSignature = pendingSignature = null; signatureAgreement = 0; }
      const backpackGold = wantGold || offer ? await readBackpackGold(bgr, g, now) : null;
      return { exchange, offer, rect: geometry ? geometry.rect : null, issue: lastIssue, backpackGold, contentRevision, contentUncertain: !!pendingSignature };
    });
  }
  return { read, get lastIssue() { return lastIssue; }, clearCache: () => cache.clear() };
}

module.exports = { createReader, readPng, PSM };
