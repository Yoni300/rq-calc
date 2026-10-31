// Fixes and additions on top of Anon's database (applied to data/rqdata.js after export).
// Skill buffs that raise stats were missing; values from the Royal Quest Wiki skill descriptions (65 lvl).
// Usage: node tools/patch-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const dataFile = path.join(root, 'data', 'rqdata.js');
delete require.cache[dataFile];
const D = require(dataFile);

// bonus type ids (see BonusType table)
const T = {
  CRIT_RATING: 12, ATK_SPEED_PCT: 11, DEF_PCT: 7, DEF: 2,
  RES_FIRE: 63, RES_WATER: 64, RES_EARTH: 65, RES_AIR: 66,
  DMG_FIRE: 46, DMG_WATER: 47, DMG_EARTH: 48, DMG_AIR: 49,
};
const CLASS = { CRUSADER: 2, HUNTER: 5, SNIPER: 6, WIZARD: 8, ROGUE: 11 };
const TALENT = { PACK_LEADER: 120, WILD_WEST: 122, FOUR_ELEMENTS: 192, PLANAR: 26 };

const patched = [];
const nextBuffId = () => Math.max(...D.Buff.map(b => b.Id)) + 1;
const nextTalentBonusId = () => Math.max(...D.TalentBonus.map(b => b.Id)) + 1;

function addBuff({ name, classId, level = 1, talentId = null, imageId = null, bonuses, talentBoosts = [] }) {
  if (D.Buff.some(b => b.Name === name && b.Class_Id === classId)) return; // already there
  const id = nextBuffId();
  D.Buff.push({ Id: id, Name: name, MaxStackCount: 1, Level: level, Class_Id: classId, ...(talentId ? { TalentCondition_Id: talentId } : {}), AutoEnabled: 0, IsNegate: 0, ...(imageId ? { Image_Id: imageId } : {}) });
  bonuses.forEach(([typeId, value], i) => D.BuffBonus.push({ Buff_Id: id, Type_Id: typeId, Value: value, OrderIndex: i }));
  // a talent that strengthens the buff: its bonus replaces the buff's bonus of the same type
  for (const [tId, typeId, value] of talentBoosts) D.TalentBonus.push({ Id: nextTalentBonusId(), Talent_Id: tId, Type_Id: typeId, Value: value, BuffCondition_Id: id });
  patched.push(`buff ${name}`);
}

// 1. «Вожак стаи» is the Hunter's talent ultimate, but the buff was bound to the Sniper class
const packLeader = D.Buff.find(b => b.Name === 'Вожак стаи');
if (packLeader && packLeader.Class_Id !== CLASS.HUNTER) { packLeader.Class_Id = CLASS.HUNTER; patched.push('Вожак стаи → Охотник'); }

// 2. Охотник — «Звериная ярость»: +30 crit rating and +30% attack speed for 8 s (30 lvl);
//    talent «Дикий-дикий вест» makes the bonuses 20% stronger (36).
addBuff({ name: 'Звериная ярость', classId: CLASS.HUNTER, level: 30, imageId: 1033,
  bonuses: [[T.CRIT_RATING, 30], [T.ATK_SPEED_PCT, 30]],
  talentBoosts: [[TALENT.WILD_WEST, T.CRIT_RATING, 36], [TALENT.WILD_WEST, T.ATK_SPEED_PCT, 36]] });

// 3. Крестоносец — «Планарный барьер»: allies inside the barrier get +40% defense
addBuff({ name: 'Планарный барьер', classId: CLASS.CRUSADER, imageId: 931, bonuses: [[T.DEF_PCT, 40]] });

// 4. Волшебник — «Кристалл четырёх стихий» (talent): near the crystal +5 resistance and +5% damage of fire/water/earth/air
addBuff({ name: 'Кристалл четырёх стихий', classId: CLASS.WIZARD, talentId: TALENT.FOUR_ELEMENTS, imageId: 1097,
  bonuses: [[T.RES_FIRE, 5], [T.RES_WATER, 5], [T.RES_EARTH, 5], [T.RES_AIR, 5], [T.DMG_FIRE, 5], [T.DMG_WATER, 5], [T.DMG_EARTH, 5], [T.DMG_AIR, 5]] });

// 5. Разбойник — «Костёр»: +2098 defense around the campfire (value for 65 lvl)
addBuff({ name: 'Костёр (65 ур.)', classId: CLASS.ROGUE, bonuses: [[T.DEF, 2098]] });

const js = `(function (d) { if (typeof module === 'object' && module.exports) module.exports = d; else window.RQDATA = d; })(${JSON.stringify(D)});\n`;
fs.writeFileSync(dataFile, js);
console.log(patched.length ? 'patched: ' + patched.join(', ') : 'nothing to patch');
