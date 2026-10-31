// Quick check: builds a sample character and prints the calculated stats.
const RQDATA = require('../data/rqdata.js');
const { createContext } = require('../src/engine.js');

const ctx = createContext(RQDATA);
if (ctx.formulaWarnings.length) console.log('warnings:', ctx.formulaWarnings);

function show(title, ch) {
  const r = ctx.calc(ch);
  console.log(`\n== ${title}`);
  const rows = [...r.stats].map(([id, v]) => [ctx.stats.get(id), v]).sort((a, b) => a[0].orderIndex - b[0].orderIndex || a[0].id - b[0].id);
  for (const [s, v] of rows) {
    const d = r.descriptions.has(s.id) ? `  (${+r.descriptions.get(s.id).toFixed(2)})` : '';
    console.log(`${String(s.id).padStart(3)} ${s.name.padEnd(40)} ${+v.toFixed(3)}${d}`);
  }
  return r;
}

const base = ctx.defaultCharacter();
show('Мечник 1 lvl, без снаряжения', base);

// Крестоносец 65 lvl with some gear
const ch = ctx.defaultCharacter();
ch.classId = 2; ch.level = 65;
for (const id of ctx.editStatIds(2)) ch.stats[id] = 1;
ch.stats[4] = 100; ch.stats[8] = 100; ch.stats[7] = 57; // Сила, Выносливость, Ловкость
console.log('free stats:', ctx.freeStats(ch));
const pick = (key) => ctx.itemsForSlot(ch, key)[0];
for (const key of ['21:0', '3:0', '1:0', '4:0', '5:0', '6:0', '7:0', '11:0', '11:1', '12:0']) {
  const item = pick(key);
  if (!item) continue;
  ch.equipment[key] = { itemId: item.id, upgrade: Math.min(10, ctx.maxUpgrade(item)), cards: [] };
  console.log(key, '->', item.name, 'lvl', item.level);
}
const r = show('Крестоносец 65', ch);
console.log('weapon:', r.weaponInfo);
