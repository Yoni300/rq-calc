// Compares this engine with the original RQ Calc libraries on random valid characters.
// Usage: node test/compare.js <oracle.exe> <rqdata.sqlite> <workdir> [count] [seed]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const RQDATA = require('../data/rqdata.js');
const { createContext } = require('../src/engine.js');

const [oracle, dbPath, workDir, countArg, seedArg] = process.argv.slice(2);
const COUNT = +(countArg || 200);
let seed = +(seedArg || 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];
const chance = p => rnd() < p;

const ctx = createContext(RQDATA);

function randomCharacter() {
  const ch = ctx.defaultCharacter();
  const cls = pick([...ctx.classes.values()]);
  ch.classId = cls.id;
  ch.level = ri(cls.minLevel, cls.maxLevel);
  ch.genderId = pick(ctx.genders).Id;
  ch.stateId = chance(0.8) ? 1 : 2;
  if (chance(0.15) && ctx.events.length) ch.eventId = pick(ctx.events).Id;
  ch.lostControl = chance(0.1);
  ch.stats = {};
  for (const id of ctx.editStatIds(cls.id)) ch.stats[id] = 1;
  let free = ctx.freeStats(ch);
  const ids = ctx.editStatIds(cls.id);
  while (free > 0) {
    const id = pick(ids);
    if (ch.stats[id] >= ctx.settings.maxStatCount) { if (ids.every(i => ch.stats[i] >= ctx.settings.maxStatCount)) break; continue; }
    const add = Math.min(free, ri(1, 10), ctx.settings.maxStatCount - ch.stats[id]);
    ch.stats[id] += add; free -= add;
    if (chance(0.03)) break;
  }
  // talents: fill branch rows from the top
  ch.talents = [];
  let points = ctx.talentPoints(ch);
  for (const br of ctx.classBranches(cls.id)) {
    const rows = [...new Set(br.talents.map(t => t.h))].sort((a, b) => a - b);
    for (const h of rows) {
      if (points <= 0 || chance(0.25)) break;
      ch.talents.push(pick(br.talents.filter(t => t.h === h)).id); points--;
    }
  }
  // equipment
  ch.equipment = {};
  for (const key of ctx.slotKeys()) {
    if (chance(0.15)) continue;
    const items = ctx.itemsForSlot(ch, key);
    if (!items.length) continue;
    const item = pick(items.slice(0, 40));
    const slot = ctx.slots.get(ctx.eqTypes.get(item.typeId).slotId);
    const e = { itemId: item.id, upgrade: 0, cards: [] };
    if (slot.isWeapon != null) {
      e.upgrade = ri(0, ctx.maxUpgrade(item));
      if (chance(0.7)) { const st = ctx.stampsForItem(item, cls.id); if (st.length) e.stampVariantId = pick(pick(st).variants).id; }
      const n = ctx.cardCount(item);
      for (let i = 0; i < n; i++) {
        if (i === 0 && item.primaryCardId) { e.cards.push(item.primaryCardId); continue; }
        const cs = ctx.cardsForItem(item, i);
        e.cards.push(cs.length && chance(0.7) ? pick(cs).id : null);
      }
      while (e.cards.length && e.cards[e.cards.length - 1] == null) e.cards.pop();
    }
    if (item.bonuses.some(b => b.activate != null) && chance(0.3)) e.active = false;
    ch.equipment[key] = e;
  }
  const auras = ctx.classAuras(cls.id, ch.level);
  ch.auraId = auras.length && chance(0.7) ? pick(auras).id : null;
  ch.enableAura = chance(0.9); ch.enableTalents = chance(0.9); ch.enableBuffs = chance(0.9);
  ch.enableElixir = chance(0.9); ch.enableConsumables = chance(0.9); ch.enableCollecting = chance(0.9);
  ch.buffs = {};
  for (const b of ctx.availableBuffs(ch)) if (chance(0.3)) ch.buffs[b.id] = ri(1, b.maxStack);
  ch.elixirId = chance(0.5) ? pick([...ctx.elixirs.keys()]) : null;
  ch.consumables = [...ctx.consumables.keys()].filter(() => chance(0.2));
  ch.collected = [...ctx.collected.values()].filter(c => c.inVersion && (c.genderId == null || c.genderId === ch.genderId) && chance(0.3)).map(c => c.id);
  return ch;
}

const chars = Array.from({ length: COUNT }, randomCharacter);
// the oracle wants absent fields instead of nulls
const forOracle = chars.map(c => { const o = { ...c }; for (const k of ['eventId', 'auraId', 'elixirId']) if (o[k] == null) delete o[k]; return o; });
fs.mkdirSync(workDir, { recursive: true });
const inFile = path.join(workDir, 'chars.json'), outFile = path.join(workDir, 'oracle.json');
fs.writeFileSync(inFile, JSON.stringify(forOracle));
execFileSync(oracle, [inFile, outFile, dbPath], { cwd: path.dirname(oracle), stdio: 'inherit' });
const expected = JSON.parse(fs.readFileSync(outFile, 'utf8').replace(/^﻿/, ''));

let bad = 0, invalid = 0, checked = 0;
const diffsByStat = {};
chars.forEach((ch, i) => {
  const exp = expected[i];
  if (!exp.ok) { invalid++; if (invalid <= 5) console.log(`#${i} oracle rejected: ${exp.error}`); return; }
  checked++;
  const got = ctx.calc(ch);
  const problems = [];
  const cmp = (kind, id, e, g) => {
    const tol = 1e-6 * Math.max(1, Math.abs(e));
    if (g == null || Math.abs(e - g) > tol) problems.push(`${kind} ${id} ${ctx.stats.get(+id).name}: expected ${e}, got ${g}`);
  };
  for (const [id, v] of Object.entries(exp.stats)) cmp('stat', id, +v, got.stats.get(+id));
  for (const [id, v] of Object.entries(exp.desc)) cmp('desc', id, +v, got.descriptions.get(+id));
  for (const id of got.stats.keys()) if (!(id in exp.stats)) problems.push(`extra stat ${id}`);
  if (problems.length) {
    bad++;
    problems.forEach(p => { const k = p.split(':')[0]; diffsByStat[k] = (diffsByStat[k] || 0) + 1; });
    if (bad <= 4) { console.log(`\n#${i} class ${ch.classId} lvl ${ch.level}`); problems.slice(0, 8).forEach(p => console.log('  ' + p)); fs.writeFileSync(path.join(workDir, `bad-${i}.json`), JSON.stringify(ch, null, 1)); }
  }
});
console.log(`\nchecked ${checked}, mismatched ${bad}, rejected by oracle ${invalid}`);
if (bad) console.log(diffsByStat);
process.exitCode = bad || invalid ? 1 : 0;
