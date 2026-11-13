// «Обмен» tool: the background process (Electron utilityProcess) that reads game frames and values the trade.
// Messages in: init { assets, catalog, pricing }, catalog { catalog }, pricing { pricing }, frame { width, height, data, at }.
// Messages out: ready, state { … } after every frame, completed { trade } (a trade for the history), error.
// The reading loop follows TradeCounterRQ by w-stus (MainWindow.RunCapture): a reading counts once two frames agree,
// the window counts as closed after three frames without it; the history comes from TradeAccounting (accounting.js).
'use strict';
const path = require('path');
const { createReader } = require('./reader');
const { Catalog, valuate, TradeSession } = require('./core');
const { TradeAccounting } = require('./accounting');

const port = process.parentPort;
let cv = null, reader = null, catalog = new Catalog([]), pricing = {}, session = new TradeSession();
const tess = {};
let busy = false, pending = null, framePort = null;
const accounting = new TradeAccounting();
let generation = 0; // a new capture (game restarted, window changed) breaks the continuity a trade needs
// frames are pulled: the capture page sends one when asked, so a slow read never piles frames up
const askFrame = () => { if (framePort) framePort.postMessage({ type: 'next' }); };

// opencv.js finishes loading after require() (only once onRuntimeInitialized is set). It has a .then() that resolves
// to itself, so it must never be awaited or returned from an async function: it comes back inside an object.
async function loadCv() {
  const m = require('@techstark/opencv-js');
  if (!m.Mat) await new Promise((resolve, reject) => {
    m.onRuntimeInitialized = () => resolve();
    const t0 = Date.now(), poll = setInterval(() => { if (m.Mat) { clearInterval(poll); resolve(); } else if (Date.now() - t0 > 30000) { clearInterval(poll); reject(new Error('OpenCV did not load')); } }, 50);
  });
  return { cv: m };
}
// one Tesseract worker per kind, its calls one after another (the page mode is a worker setting)
async function makeOcr(assets, workerPath) {
  const T = require('tesseract.js');
  const opts = { langPath: path.join(assets, 'tessdata'), gzip: false, cacheMethod: 'none' };
  if (workerPath) opts.workerPath = workerPath; // packaged: the unpacked copy (a worker thread cannot start from app.asar)
  tess.text = { w: await T.createWorker('rus+eng', 1, opts), psm: null, q: Promise.resolve() };
  tess.digits = { w: await T.createWorker('eng', 1, opts), psm: null, q: Promise.resolve() };
  await tess.digits.w.setParameters({ tessedit_char_whitelist: '0123456789' });
  return (kind, psm, image) => {
    const t = tess[kind];
    const job = t.q.then(async () => {
      if (t.psm !== psm) { await t.w.setParameters({ tessedit_pageseg_mode: psm }); t.psm = psm; }
      const r = await t.w.recognize(image);
      return { text: r.data.text, confidence: r.data.confidence };
    });
    t.q = job.catch(() => {});
    return job;
  };
}

const isComplete = obs => { const v = valuate(obs, catalog, pricing, true); return v.received.complete && v.given.complete; };

async function process1(frame) {
  const t0 = Date.now(), at = frame.at || t0;
  let ev;
  try {
    // the backpack gold is needed while a trade is open and until its result is known
    ev = await reader.read(frame, at, accounting.id != null);
  } catch (err) {
    port.postMessage({ type: 'error', message: String(err && err.stack || err) });
    accounting.interrupt('readError');
    return;
  }
  const completed = accounting.observe({ at, generation, exchange: ev.exchange, offer: ev.offer, backpackGold: ev.backpackGold, contentRevision: ev.contentRevision, contentUncertain: ev.contentUncertain }, catalog);
  if (completed) port.postMessage({ type: 'completed', trade: completed });
  if (ev.exchange === 'unknown') session.suspend(); // the window is there but cannot be read (cut off, covered)
  else session.observe(ev.offer, isComplete);
  const o = session.observation;
  port.postMessage({
    type: 'state', at, ms: Date.now() - t0, issue: ev.issue, rect: ev.rect, backpackGold: ev.backpackGold,
    state: session.state, justOpened: session.justOpened, justClosed: session.justClosed,
    observation: o, value: o ? valuate(o, catalog, pricing, session.validated) : null,
    accounting: { open: accounting.id != null, initial: accounting.initial, notice: accounting.notice, lastOutcome: accounting.lastOutcome },
  });
}
// only the newest frame matters: a frame that came in while one was being read replaces the waiting one
async function pump() {
  if (busy || !pending) return;
  busy = true;
  const f = pending; pending = null;
  try { await process1(f); } finally { busy = false; if (pending) setImmediate(pump); else askFrame(); }
}

port.on('message', async e => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      catalog = new Catalog(m.catalog.items, m.catalog.aliases); pricing = m.pricing || {};
      ({ cv } = await loadCv());
      const ocr = await makeOcr(m.assets, m.workerPath);
      reader = createReader(cv, ocr, m.assets, name => { const r = catalog.resolve(name); return r ? r.item.name : null; });
      port.postMessage({ type: 'ready' });
    } else if (m.type === 'catalog') {
      catalog = new Catalog(m.catalog.items, m.catalog.aliases);
      if (session.observation) session.revalue(isComplete(session.observation));
    } else if (m.type === 'pricing') {
      pricing = m.pricing || {};
      if (session.observation) session.revalue(isComplete(session.observation));
    } else if (m.type === 'port') {
      if (framePort) framePort.close();
      framePort = e.ports[0];
      generation++;
      framePort.on('message', ev => { if (ev.data.type === 'frame' && reader) { pending = ev.data.frame; pump(); } });
      framePort.start();
      askFrame();
    } else if (m.type === 'reset') {
      session = new TradeSession();
    }
  } catch (err) {
    port.postMessage({ type: 'error', message: String(err && err.stack || err) });
  }
});
