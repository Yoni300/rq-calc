// «Обмен» history (trade/engine/accounting.js) on made-up frames: a purchase, a sale, a cancelled trade,
// unreadable backpack gold, a capture break, and the report. Run: node test/trade-accounting-test.js
'use strict';
const { TradeAccounting, report } = require('../trade/engine/accounting');
const { Catalog } = require('../trade/engine/core');

const catalog = new Catalog([{ id: 'Карта Воко', name: 'Карта Воко', category: 'card', signs: 190 }, { id: 'Сталь', name: 'Сталь', category: 'regular' }]);
const rows = (items) => [0, 1, 2, 3, 4].map(i => items[i] ? { index: i, occupancy: 'occupied', name: items[i][0], quantity: items[i][1] } : { index: i, occupancy: 'empty', name: null, quantity: null });
const offer = (recv, give, goldR = 0, goldG = 0) => ({ received: { rows: rows(recv), gold: goldR }, given: { rows: rows(give), gold: goldG } });

let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };

// frames every 250 ms: `open` frames with the trade window, then `closed` frames without it
function run(acc, { open = 6, closed = 30, before, after, of, gen = 1, t0 = 1e6, unknownAfter = 0 }) {
  let t = t0, done = null;
  for (let i = 0; i < open; i++) { t += 250; done = acc.observe({ at: t, generation: gen, exchange: 'present', offer: of, backpackGold: typeof before === 'function' ? before(i) : before, contentRevision: 0, contentUncertain: false }, catalog) || done; }
  for (let i = 0; i < unknownAfter; i++) { t += 250; done = acc.observe({ at: t, generation: gen, exchange: 'unknown', offer: null, backpackGold: after, contentRevision: 0, contentUncertain: false }, catalog) || done; }
  for (let i = 0; i < closed && !done; i++) { t += 250; done = acc.observe({ at: t, generation: gen, exchange: 'absent', offer: null, backpackGold: typeof after === 'function' ? after(i) : after, contentRevision: 0, contentUncertain: false }, catalog) || done; }
  return { done, t };
}

{ // a purchase: 1 000 000 → 875 000, the card on my side, 125 000 gold given
  const acc = new TradeAccounting();
  const { done } = run(acc, { before: 1000000, after: 875000, of: offer([['Карта Воко', null]], [], 0, 125000) });
  check('purchase counted', done && done.direction === 'purchase' && done.amount === 125000, JSON.stringify(done && { d: done.direction, a: done.amount, rec: done.reconciliation }));
  check('purchase reconciled', done && done.reconciliation === 'agreement');
  check('purchase rows', done && done.rows.length === 1 && done.rows[0].name === 'Карта Воко' && done.rows[0].quantity === 1);
}
{ // a sale where the game updates the gold a second later
  const acc = new TradeAccounting();
  const { done } = run(acc, { before: 500000, after: i => (i < 4 ? 500000 : 560000), of: offer([], [['Сталь', 5]], 60000, 0) });
  check('late gold update → sale', done && done.direction === 'sale' && done.amount === 60000);
}
{ // cancelled: the gold does not change
  const acc = new TradeAccounting();
  const { done } = run(acc, { before: 700, after: 700, of: offer([], []) });
  check('cancelled not counted', !done && acc.lastOutcome && acc.lastOutcome.code === 'notCounted:unchanged', acc.lastOutcome && acc.lastOutcome.code);
}
{ // the backpack is closed: no initial balance
  const acc = new TradeAccounting();
  const { done } = run(acc, { before: null, after: 900, of: offer([], []) });
  check('no initial balance', !done && acc.lastOutcome && acc.lastOutcome.code === 'notCounted:noInitial', acc.lastOutcome && acc.lastOutcome.code);
}
{ // a single different reading of the initial balance never becomes the balance (needs two equal readings)
  const acc = new TradeAccounting();
  const { done } = run(acc, { open: 6, before: i => (i === 0 ? 999 : 1000), after: 400, of: offer([], []) });
  check('initial confirmed by two frames', done && done.initialGold === 1000 && done.amount === 600);
}
{ // the capture broke in the middle: not counted, and the next trade needs a clean close first
  const acc = new TradeAccounting();
  run(acc, { open: 4, closed: 0, before: 1000, after: 1000, of: offer([], []), gen: 1 });
  acc.observe({ at: 2e6, generation: 2, exchange: 'present', offer: offer([], []), backpackGold: 1000, contentRevision: 0, contentUncertain: false }, catalog);
  check('capture break → not counted', acc.lastOutcome && acc.lastOutcome.code === 'notCounted:captureBreak', acc.lastOutcome && acc.lastOutcome.code);
}

{ // report: two trades on two days
  const day = 86400000, base = Date.UTC(2026, 10, 10, 12);
  const trades = [
    { id: 'a', completedAt: base, direction: 'purchase', amount: 100, rows: [{ side: 'received', name: 'Карта Воко', quantity: 1, occupancy: 'occupied' }] },
    { id: 'b', completedAt: base + day, direction: 'sale', amount: 300, rows: [{ side: 'given', name: 'Сталь', quantity: 5, occupancy: 'occupied' }, { side: 'given', name: 'Сталь', quantity: null, occupancy: 'occupied' }] },
  ];
  const r = report(trades, { from: base - day, until: base + 2 * day, tzOffsetMin: 0 });
  check('report totals', r.total.purchases === 1 && r.total.sales === 1 && r.total.spent === 100 && r.total.received === 300 && r.total.net === 200, JSON.stringify(r.total));
  check('report days', r.days.length === 2 && r.days[0].day === '2026-11-11');
  const steel = r.items.find(m => m.name === 'Сталь');
  check('unknown count kept apart', steel && steel.known === 5 && steel.unknownRows === 1, JSON.stringify(steel));
  check('direction filter', report(trades, { from: 0, until: base + 9 * day, direction: 'sale' }).trades.length === 1);
}
console.log(fails ? `FAILED: ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
