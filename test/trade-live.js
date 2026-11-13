// «Обмен» end to end: starts the fake game window (another process, test/trade-fake-game.js case 3: a trade that
// closes after 7 s while the backpack gold drops 1 000 000 → 985 000), turns the tool on and waits until the history
// has the purchase. Prints the states and saves pictures of the panel (trade open, then the history result).
// Run: electron test/trade-live.js <outDir>
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const OUT = process.argv.find((a, i) => i > 1 && !a.startsWith('-') && !a.endsWith('.js')) || path.join(require('os').tmpdir(), 'rq-trade-live');
fs.rmSync(path.join(OUT, 'profile'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'profile', 'trade'), { recursive: true });
app.setPath('userData', path.join(OUT, 'profile'));
fs.writeFileSync(path.join(OUT, 'profile', 'trade', 'settings.json'), JSON.stringify({ buySign: 1000, sellSign: 1100 }));
fs.writeFileSync(path.join(OUT, 'profile', 'trade', 'prices.json'), JSON.stringify({ items: { 'Шкура волка': { category: 'regular', buy: 40, sell: 50 } }, aliases: {} }));
const historyFile = path.join(OUT, 'profile', 'trade', 'history.jsonl');

app.whenReady().then(async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const game = spawn(process.execPath, [path.join(__dirname, 'trade-fake-game.js'), '3'], { env, stdio: 'ignore' });
  const trade = require('../trade');
  const t0 = Date.now(), sec = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  let lastLine = '';
  trade.start({ lang: 'ru', onChange: st => {
    const l = `on=${st.on} ready=${st.ready} game=${st.game} reading=${st.reading} issue=${st.issue} error=${st.error} outcome=${JSON.stringify(st.lastOutcome)}`;
    if (l !== lastLine) console.log(sec(), l); lastLine = l;
  } });
  const panel = () => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('overlay/index.html'));
  const shot = async name => { const p = panel(); if (p) fs.writeFileSync(path.join(OUT, name), (await p.webContents.capturePage()).toPNG()); };
  let saved = null, shotOpen = false;
  for (let i = 0; i < 40 && !saved; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (!shotOpen && trade.state().reading && i >= 3) { await shot('panel-open.png'); shotOpen = true; console.log(sec(), 'panel (trade open) saved'); }
    try { saved = fs.readFileSync(historyFile, 'utf8').trim(); } catch { /* not yet */ }
  }
  await new Promise(r => setTimeout(r, 1200));
  await shot('panel-result.png');
  const t = saved ? JSON.parse(saved.split('\n')[0]) : null;
  console.log('history:', t ? JSON.stringify({ direction: t.direction, amount: t.amount, initial: t.initialGold, final: t.finalGold, reconciliation: t.reconciliation, rows: t.rows.map(r => r.name + ' ×' + r.quantity) }) : 'nothing');
  const ok = t && t.direction === 'purchase' && t.amount === 15000 && t.initialGold === 1000000;
  console.log(ok ? 'LIVE OK' : 'LIVE FAILED');
  game.kill(); trade.stop();
  app.exit(ok ? 0 : 1);
});
