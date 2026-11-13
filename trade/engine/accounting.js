// «Обмен» tool: the trade history — which trades really happened and for how much, from the backpack gold
// before and after the trade window (less gold = a purchase, more = a sale, the same = not counted).
// Ported from TradeCounterRQ by w-stus (github.com/w-stus/tradecounterRQ, src/TradeCounter.Core: TradeHistory.cs,
// OfferSnapshot.cs, HistoryReports.cs), used under its non-commercial license — see trade/LICENSE-TradeCounterRQ.txt.
'use strict';
const { Names } = require('./core');

const SETTLEMENT_MS = 5000; // after the window closes, the backpack gold has this long to change

// ---------- OfferSnapshot.cs: each row and each side's gold count once two readings in a row agree ----------
class Field {
  constructor() { this.candidate = undefined; this.agree = 0; this.value = undefined; }
  observe(v, same = (a, b) => a === b) {
    this.agree = this.candidate !== undefined && same(this.candidate, v) ? this.agree + 1 : 1;
    this.candidate = v;
    if (this.agree >= 2) this.value = v;
  }
}
const sameRow = (a, b) => a.index === b.index && a.occupancy === b.occupancy && (a.name || null) === (b.name || null) && (a.quantity ?? null) === (b.quantity ?? null);
class OfferSnapshot {
  constructor() { this.rows = new Map(); this.occupancy = new Map(); this.gold = { received: new Field(), given: new Field() }; }
  observe(offer, details, gold = true) {
    for (const side of ['received', 'given']) {
      if (gold && offer[side].gold != null && offer[side].gold >= 0) this.gold[side].observe(offer[side].gold);
      for (const row of offer[side].rows) {
        const key = side + row.index;
        this.occupancy.set(key, row.occupancy);
        if (!this.rows.has(key)) this.rows.set(key, new Field());
        if (details || row.occupancy === 'empty') this.rows.get(key).observe(row, sameRow);
      }
    }
  }
  read(uncertain = false) {
    const side = s => ({
      rows: [...this.occupancy.entries()].filter(([k]) => k.startsWith(s)).map(([k, occ]) => ({ k, occ, i: Number(k.slice(s.length)) })).sort((a, b) => a.i - b.i)
        .map(({ k, occ, i }) => {
          const v = this.rows.get(k).value || { index: i, occupancy: occ, name: null, quantity: null };
          // a changed offer whose items were not read again: keep only what is surely empty
          return uncertain && v.occupancy !== 'empty' ? { index: v.index, occupancy: v.occupancy, name: null, quantity: null } : v;
        }),
      gold: this.gold[s].value ?? null,
    });
    return { received: side('received'), given: side('given') };
  }
}

// ---------- TradeHistory.cs: the evidence state machine ----------
class TradeAccounting {
  constructor() { this.generation = null; this.lastAt = 0; this.suppressed = false; this.lastOutcome = null; this.notice = null; this.clear(); }
  clear() {
    this.id = null; this.initial = this.initialCandidate = this.ending = null; this.absentAt = null;
    this.initialAgree = this.endingAgree = this.absent = 0; this.contentRevision = null; this.snapshot = new OfferSnapshot();
    this.offerVersion = 0; this.contentUncertain = false; this.closureConfirmed = false; this.opened = 0;
  }
  interrupt(reason) {
    this.notice = this.id ? `notCounted:${reason}` : null;
    if (this.notice) this.lastOutcome = { at: Date.now(), code: this.notice };
    this.suppressed = this.suppressed || !!this.id;
    this.clear();
  }
  fail(reason) { this.notice = `notCounted:${reason}`; this.lastOutcome = { at: Date.now(), code: this.notice }; this.clear(); }
  /** frame: { at, generation, exchange: 'present'|'absent'|'unknown', offer, backpackGold, contentRevision, contentUncertain }
      → a completed trade or null; `notice` tells what happened with a trade that is not counted */
  observe(frame, catalog) {
    this.notice = null;
    if (this.generation !== frame.generation) {
      if (this.generation !== null) this.interrupt('captureBreak');
      this.generation = frame.generation; this.lastAt = 0;
    }
    if (frame.at <= this.lastAt) return null;
    this.lastAt = frame.at;
    if (this.suppressed) {
      // after lost continuity a clean «closed» first, not a balance taken in the middle of the old trade
      this.absent = frame.exchange === 'absent' ? this.absent + 1 : 0;
      if (this.absent >= 3) { this.suppressed = false; this.absent = 0; }
      return null;
    }
    if (frame.exchange === 'present') {
      if (this.closureConfirmed && this.id) this.fail('newTradeTooSoon');
      if (!this.id) { this.id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; this.opened = frame.at; }
      this.absent = 0; this.absentAt = null; this.ending = null; this.endingAgree = 0;
      if (this.initial == null) {
        this.initialAgree = frame.backpackGold != null && frame.backpackGold >= 0 && frame.backpackGold === this.initialCandidate ? this.initialAgree + 1 : 1;
        this.initialCandidate = frame.backpackGold;
        if (this.initialCandidate != null && this.initialCandidate >= 0 && this.initialAgree >= 2) this.initial = this.initialCandidate;
      }
      if (frame.offer) {
        if (this.contentRevision != null && this.contentRevision !== frame.contentRevision) { this.offerVersion++; this.snapshot = new OfferSnapshot(); }
        this.contentRevision = frame.contentRevision;
        this.contentUncertain = frame.contentUncertain;
        this.snapshot.observe(frame.offer, true);
      }
      return null;
    }
    if (!this.id) return null;
    if (frame.exchange === 'unknown') {
      this.absent = 0; this.endingAgree = 0;
      if (this.absentAt != null && frame.at - this.absentAt >= SETTLEMENT_MS) this.fail('closeOrBalance');
      return null;
    }
    if (this.absentAt == null) this.absentAt = frame.at;
    this.absent++;
    this.closureConfirmed = this.closureConfirmed || this.absent >= 3;
    if (frame.at - this.absentAt >= SETTLEMENT_MS) {
      if (this.initial == null) this.notice = 'notCounted:noInitial';
      else if (this.endingAgree < 3 || this.ending !== this.initial) this.notice = 'notCounted:noFinal';
      this.lastOutcome = { at: Date.now(), code: this.notice || 'notCounted:unchanged' };
      this.clear(); return null;
    }
    this.endingAgree = frame.backpackGold != null && frame.backpackGold >= 0 && frame.backpackGold === this.ending ? this.endingAgree + 1 : 1;
    this.ending = frame.backpackGold;
    if (this.ending == null) this.endingAgree = 0;
    if (!this.closureConfirmed || this.endingAgree < 3) return null;
    if (this.initial == null) { this.fail('noInitial'); return null; }
    if (this.ending === this.initial) return null; // the game may update the gold a moment later
    const offer = this.snapshot.read(this.contentUncertain);
    const reconciliation = offer.received.gold != null && offer.given.gold != null
      ? (offer.received.gold - offer.given.gold === this.ending - this.initial ? 'agreement' : 'mismatch') : 'unavailable';
    const result = {
      id: this.id, openedAt: this.opened, completedAt: this.absentAt, initialGold: this.initial, finalGold: this.ending,
      direction: this.ending < this.initial ? 'purchase' : 'sale', amount: Math.abs(this.initial - this.ending),
      rows: historicalRows(offer, catalog), offerGold: { received: offer.received.gold, given: offer.given.gold }, reconciliation,
    };
    this.lastOutcome = { at: Date.now(), code: result.direction, amount: result.amount, reconciliation };
    this.clear(); return result;
  }
}
function historicalRows(offer, catalog) {
  const rows = [];
  for (const side of ['received', 'given']) for (const row of offer[side].rows) {
    if (row.occupancy === 'empty') continue;
    const found = row.name ? catalog.resolve(row.name) : null, item = found ? found.item : null;
    let quantity = item && item.category !== 'regular' && row.occupancy === 'occupied' ? 1 : row.quantity;
    if (quantity != null && quantity <= 0) quantity = null;
    const issues = [];
    if (row.occupancy === 'uncertain') issues.push('uncertain');
    if (!row.name) issues.push('noName');
    if (quantity == null) issues.push('noQuantity');
    rows.push({ side, index: row.index, occupancy: row.occupancy, name: item ? item.name : row.name, read: row.name, quantity, category: item ? item.category : null, issues });
  }
  return rows;
}

// ---------- HistoryStore.LoadHistory + HistoryReports.cs: totals, days, item movement, one page of the journal ----------
const dayKey = (t, tzOffsetMin) => { const d = new Date(t - tzOffsetMin * 60000); return d.toISOString().slice(0, 10); };
/** trades: every saved trade; filter: { from, until (ms, until exclusive), direction: null|'purchase'|'sale', tzOffsetMin, page, pageSize } */
function report(trades, filter) {
  const list = trades.filter(t => t.completedAt >= filter.from && t.completedAt < filter.until && (!filter.direction || t.direction === filter.direction))
    .sort((a, b) => b.completedAt - a.completedAt || (a.id < b.id ? -1 : 1));
  const flow = () => ({ purchases: 0, sales: 0, spent: 0, received: 0 });
  const add = (f, t) => { if (t.direction === 'purchase') { f.purchases++; f.spent += t.amount; } else { f.sales++; f.received += t.amount; } };
  const total = flow(), days = new Map(), moves = new Map();
  for (const t of list) {
    add(total, t);
    const d = dayKey(t.completedAt, filter.tzOffsetMin || 0);
    if (!days.has(d)) days.set(d, flow());
    add(days.get(d), t);
    for (const r of t.rows) {
      const name = r.name || '?', key = r.side + '|' + Names.normalize(name);
      const m = moves.get(key) || { side: r.side, name, known: 0, unknownRows: 0 };
      // an unknown count never becomes 0 or 1: it is counted apart
      if (r.quantity != null && r.occupancy === 'occupied') m.known += r.quantity; else m.unknownRows++;
      moves.set(key, m);
    }
  }
  const page = Math.max(0, filter.page || 0), size = Math.min(200, Math.max(1, filter.pageSize || 100));
  return {
    total: { ...total, net: total.received - total.spent, count: total.purchases + total.sales },
    days: [...days.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, f]) => ({ day, ...f, net: f.received - f.spent })),
    items: [...moves.values()].sort((a, b) => (a.side === b.side ? a.name.localeCompare(b.name, 'ru') : a.side === 'received' ? -1 : 1)),
    trades: list.slice(page * size, (page + 1) * size), page, pageSize: size,
  };
}

module.exports = { TradeAccounting, OfferSnapshot, report, SETTLEMENT_MS };
