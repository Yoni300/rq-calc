// A drawn trade window for the «Обмен» tests (not a real game frame): TradeCounterRQ's templates (title, «Отмена»,
// empty slots) plus names / counts / gold written with a font, on a bigger «screen».
'use strict';
const path = require('path');
const fs = require('fs');
const ASSETS = path.join(__dirname, '..', 'trade', 'assets');
const img = f => 'data:image/png;base64,' + fs.readFileSync(path.join(ASSETS, f)).toString('base64');

const CASES = [
  { scale: 1, received: [['Карта Воко', null], ['Шкура волка', 37], null, null, null], given: [['Сталь', 5], null, null, null, null], goldL: 0, goldR: 125000 },
  { scale: 1.25, received: [['Карта Огородного пугала', null], null, null, null, null], given: [null, null, null, null, null], goldL: 15000, goldR: 0 },
  { scale: 0.8, received: [null, null, null, null, null], given: [['Карта Алисы', null], ['Карта Воко', null], null, null, null], goldL: 2500000, goldR: 0 },
  // a whole purchase for the history: the backpack has 1 000 000, after the trade 985 000
  { scale: 1, received: [['Карта Воко', null], null, null, null, null], given: [null, null, null, null, null], goldL: 0, goldR: 15000,
    wallet: { x: 1000, y: 600, before: 1000000, after: 985000, closeAt: 7000 } },
];

function page(c) {
  const row = (side, i, it) => {
    const y = 114 + 60 * i, right = side === 'R';
    const ix = right ? 230 : 32, nx = right ? 284 : 89, nw = right ? 111 : 119;
    if (!it) return `<img src="${img(right ? `empty-icon-right-${Math.max(2, Math.min(4, i))}.png` : 'empty-icon-area.png')}" style="position:absolute;left:${ix}px;top:${y + 2}px">`;
    const [name, n] = it;
    return `<div style="position:absolute;left:${ix}px;top:${y + 2}px;width:45px;height:49px;background:linear-gradient(135deg,#7a4a1c,#c98a3a 60%,#3b2410)"></div>`
      + (n ? `<div style="position:absolute;left:${ix - 2}px;top:${y + 38}px;width:${45}px;height:16px;text-align:right;font:bold 11px Arial;color:#f2f2f2;line-height:16px">${n}</div>` : '')
      + `<div style="position:absolute;left:${nx + 2}px;top:${y + 6}px;width:${nw - 6}px;font:12px Tahoma;color:#e8e0c8;line-height:14px">${name}</div>`;
  };
  const gold = (x, v) => `<div style="position:absolute;left:${x}px;top:430px;width:130px;font:bold 12px Tahoma;color:#f4c430;text-align:right;line-height:16px">${v.toLocaleString('ru-RU').replace(/ /g, ' ')}</div>`;
  // the backpack gold block (TradeCounterRQ's wallet templates + a number); with `flow` the trade closes after
  // flow.closeAt ms and the backpack gold becomes flow.after
  const w = c.wallet;
  const spaced = v => v.toLocaleString('ru-RU').replace(/\s/g, ' ');
  const wallet = w ? `<div style="position:absolute;left:${w.x}px;top:${w.y}px;width:149px;height:32px;background:#141210">
    <img src="${img('wallet-anchor.png')}" style="position:absolute;left:0;top:0"><img src="${img('wallet-bottom.png')}" style="position:absolute;left:0;top:27px">
    <div id="bag" style="position:absolute;left:38px;top:6px;width:100px;font:bold 13px Tahoma;color:#efe3c2;line-height:18px">${spaced(w.before)}</div></div>` : '';
  const flow = w && w.closeAt ? `<script>setTimeout(() => { document.getElementById('trade').style.display = 'none'; document.getElementById('bag').textContent = ${JSON.stringify(spaced(w.after))}; }, ${w.closeAt});</script>` : '';
  return `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#1d1f22;width:1600px;height:900px;overflow:hidden">
  <div id="trade" style="position:absolute;left:300px;top:150px;width:430px;height:520px;transform:scale(${c.scale});transform-origin:0 0;background:#24201b">
    <img src="${img('trade-header.png')}" style="position:absolute;left:125px;top:14px">
    <img src="${img('trade-cancel-button.png')}" style="position:absolute;left:220px;top:483px">
    ${c.received.map((it, i) => row('L', i, it)).join('')}${c.given.map((it, i) => row('R', i, it)).join('')}
    ${gold(42, c.goldL)}${gold(239, c.goldR)}
  </div>${wallet}${flow}</body>`;
}

module.exports = { CASES, page, ASSETS };
