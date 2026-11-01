// Market scanner parser on real market screenshots (test/market/page-N.png → OCR → page-N.json).
// Run: node test/market.js
'use strict';
const assert = require('assert');
const path = require('path');
const { makeMatcher, parsePage } = require('../market-parse');
const match = makeMatcher(require('../data/market-items.js'));

const expected = {
  10: { names: Array(8).fill('Красный элум'), prices: [5, 5, 5, 7, 7, 8, 8, 8], page: '1/64' },
  11: { names: Array(8).fill('Ашкалотский кубик'), prices: [333, 440, 441, 443, 444, 445, 446, 450] },
  12: { names: ['Усики слепой жужи', 'Усики слепой жужи', 'Оранжевая конфетная обертка', 'Зеленая конфетная обертка', 'Янтарная смола', 'Красная конфетная обертка', 'Золотая фольга', 'Шкура кабана'], prices: [35, 39, 44, 44, 44, 44, 44, 50] },
  13: { names: ['Карта мага', ...Array(7).fill('Карта воителя')], prices: [9999, 9999, 9999, 9999, 9999, 28000, 28000, 28000] },
};

let failed = 0;
for (const [n, exp] of Object.entries(expected)) {
  const frame = require(path.join(__dirname, 'market', `page-${n}.json`));
  const res = parsePage(frame.lines, match);
  try {
    assert.ok(res.ok, res.reason);
    assert.deepStrictEqual(res.rows.map(r => r.name.replace(/ё/g, 'е')), exp.names);
    assert.deepStrictEqual(res.rows.map(r => r.price), exp.prices);
    if (exp.page) assert.strictEqual(res.page, exp.page);
    console.log(`page ${n}: ok (${res.rows.length} lots)`);
  } catch (e) {
    failed++;
    console.log(`page ${n}: FAIL\n  got: ${JSON.stringify(res.rows.map(r => r.name + ' ' + r.price))}\n  unknown: ${JSON.stringify(res.unknown)}\n  ${e.message.split('\n')[0]}`);
  }
}
// the real market can have the header far right of the prices, or no header at all in the scanned area
{
  const frame = JSON.parse(JSON.stringify(require(path.join(__dirname, "market", "page-12.json"))));
  const head = frame.lines.find(l => /Цена/.test(l.text)); head.x += 200; head.words.forEach(w => { w.x += 200; });
  const a = parsePage(frame.lines, match), b = parsePage(frame.lines.filter(l => l !== head), match);
  const ok = a.ok && b.ok && a.rows.length === 8 && b.rows.length === 8;
  if (!ok) failed++;
  console.log("header moved / missing:", ok ? "ok" : "FAIL " + JSON.stringify([a.rows.length, b.rows.length, a.reason, b.reason]));
}
process.exit(failed ? 1 : 0);
