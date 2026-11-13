// «Обмен» reader on a drawn trade window (not a real game frame): the window is put together from TradeCounterRQ's
// templates (title, «Отмена», empty slots) plus names / counts / gold written with a font, placed into a bigger
// «screen» at a few UI scales. Checks that the window is found and the rows, counts and gold are read.
// Run: electron test/trade-reader-test.js [outDir]   (outDir gets the drawn frames as PNG)
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'trade', 'assets');
const OUT = process.argv.find((a, i) => i > 1 && !a.startsWith('-') && !a.endsWith('.js'));

const { CASES, page } = require('./trade-fake-page');

app.whenReady().then(async () => {
  let fails = 0;
  try {
    let cv = require('@techstark/opencv-js'); if (cv instanceof Promise) cv = await cv; else if (!cv.Mat) await new Promise(r => { cv.onRuntimeInitialized = r; });
    const T = require('tesseract.js');
    const opts = { langPath: path.join(ASSETS, 'tessdata'), gzip: false, cacheMethod: 'none' };
    const workers = { text: await T.createWorker('rus+eng', 1, opts), digits: await T.createWorker('eng', 1, opts) };
    await workers.digits.setParameters({ tessedit_char_whitelist: '0123456789' });
    const ocr = async (kind, psm, image) => { await workers[kind].setParameters({ tessedit_pageseg_mode: psm }); const r = await workers[kind].recognize(image); return { text: r.data.text, confidence: r.data.confidence }; };
    const { createReader } = require('../trade/engine/reader');
    const { Catalog, valuate } = require('../trade/engine/core');
    const signs = require('../data/card-signs.js');
    const catalog = new Catalog([...Object.entries(signs).map(([name, s], i) => ({ id: 'c' + i, name, category: 'card', signs: s })),
      { id: 'w', name: 'Шкура волка', category: 'regular', buy: 40, sell: 50 }, { id: 's', name: 'Сталь', category: 'regular', buy: 900, sell: 1000 }]);
    const reader = createReader(cv, ocr, ASSETS, n => { const r = catalog.resolve(n); return r ? r.item.name : null; }, process.env.TRADE_TRACE ? m => console.log('    · ' + m) : null);
    const win = new BrowserWindow({ show: false, width: 1600, height: 900, useContentSize: true, webPreferences: { offscreen: true } });
    for (const [k, c] of CASES.entries()) {
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page(c)));
      await new Promise(r => setTimeout(r, 300));
      const shot = await win.webContents.capturePage();
      const size = shot.getSize(), bgra = shot.toBitmap();
      if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `trade-fake-${k}.png`), shot.toPNG()); }
      const rgba = Buffer.from(bgra); for (let i = 0; i < rgba.length; i += 4) { const b = rgba[i]; rgba[i] = rgba[i + 2]; rgba[i + 2] = b; }
      let t = Date.now();
      const ev = await reader.read({ width: size.width, height: size.height, data: rgba }, Date.now() + k * 5000, true);
      const obs = ev.offer && { ...ev.offer, rect: ev.rect };
      if (c.wallet) console.log(`  backpack gold: ${ev.backpackGold} (want ${c.wallet.before})`);
      const ms1 = Date.now() - t; t = Date.now();
      await reader.read({ width: size.width, height: size.height, data: rgba }, Date.now() + k * 5000);
      const ms2 = Date.now() - t;
      if (!obs) { console.log(`case ${k} (scale ${c.scale}): window NOT found (${reader.lastIssue})`); fails++; continue; }
      const got = side => side.rows.map(r => r.occupancy === 'empty' ? null : [r.name, r.quantity]);
      const want = side => side.map(it => it && [it[0], it[1]]);
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const exp = { L: want(c.received).map(x => x && [x[0], x[1] ?? null]), R: want(c.given).map(x => x && [x[0], x[1] ?? null]) };
      const okL = same(got(obs.received), exp.L), okR = same(got(obs.given), exp.R), okG = obs.received.gold === c.goldL && obs.given.gold === c.goldR;
      if (!okL || !okR || !okG) fails++;
      console.log(`case ${k} (scale ${c.scale}): rect ${JSON.stringify(obs.rect)} first ${ms1} ms, again ${ms2} ms`);
      console.log('  received', okL ? 'OK' : 'DIFF', JSON.stringify(got(obs.received)), okL ? '' : 'want ' + JSON.stringify(exp.L));
      console.log('  given   ', okR ? 'OK' : 'DIFF', JSON.stringify(got(obs.given)), okR ? '' : 'want ' + JSON.stringify(exp.R));
      console.log('  gold    ', okG ? 'OK' : 'DIFF', obs.received.gold, obs.given.gold, okG ? '' : `want ${c.goldL} ${c.goldR}`);
      const v = valuate(obs, catalog, { buySign: 1000, sellSign: 1100 }, true);
      console.log('  value   ', v.received.subtotal, v.given.subtotal, 'diff', v.difference, v.received.issues.concat(v.given.issues).map(i => i.issue).join(','));
    }
    for (const w of Object.values(workers)) await w.terminate();
  } catch (err) { console.error(err); fails++; }
  console.log(fails ? `FAILED: ${fails}` : 'ALL OK');
  app.exit(fails ? 1 : 0);
});
