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

// 5a. «Зеркальный шар», «Штандарт тьмы» and «Знамя света» stack in the game, but Anon's database put them
// in one group, so turning one on turned the others off
for (const b of D.Buff) {
  if (['Зеркальный шар', 'Штандарт тьмы'].includes(b.Name) || b.Name.startsWith('Знамя света')) {
    if (b.Group != null) { delete b.Group; patched.push(`${b.Name}: складається з іншими`); }
  }
}

// 6. Collection trophies have no pictures in the database: give each a fitting icon of a pet, mount,
//    book, potion or item that is already in data/img (picked by the trophy's theme).
const TROPHY_ICONS = {
  'День победы': 57, 'Анатомия Гиома': 679, 'Секреты Древней улитки': 1704, 'Механика Железных жуж': 1680,
  'Злобоглазу в глаз': 1674, 'Укрощённый Ирекс': 1886, 'Не дубовый Жёлудь': 1711, 'Кабан мясистый': 770,
  'Дрова из Кленовых энтов': 684, 'Пугалом не испугаешь': 1707, 'Соната лунатиков': 1700, 'Мерцание Жуж': 1862,
  'Травля Мохоедок': 1694, 'Небесный сбор с Остролитки': 60, 'Кто такие Песчанные Харриеры': 1882,
  'Как устроены сопелки': 678, 'Полезное из Хлыстовика': 674, 'Задымление': 1175, 'За автографом к Алисе': 487,
  'Кристаллоидов на крошку': 1685, 'Усмирение Малого пожирателя яда': 1976, 'Иссушение Малого пожирателя воды': 1703,
  'Грызть Гранит Истины': 1675, 'Знакомство с Орками Шахтёрами': 852, 'Саламандра на десерт': 1697,
  'Стихийное бедствие': 1097, 'Трансмутация оружия': 1679, 'Трансмутация экипировки': 1954, 'Морфология': 673,
  'Энтомология': 670, 'Зоология': 676, 'Расщепитель': 1673, 'Рудокоп': 1906, 'Металлург': 766, 'Портной': 699,
  'Кондитер': 56, 'Самогонщик': 59, 'Аптекарь': 2056, 'Буря в пустыне': 1695, 'Дары болот': 1678,
  'Суровый набор': 1690, 'Пепелище': 1698, 'Предания ночного леса': 1696, 'Нечисть не просочится': 1682,
  'Луговой сбор': 55, 'Снежная пора': 1688, 'Осенняя пора': 1676, 'Яркое настроение': 1705,
  'Сердцу не прикажешь': 155, 'За небесными покупками': 225, 'Военное дело не хитрое': 1844,
  'И кто тут БОСС?': 1687, 'Они сражались за Морру': 550, 'Тайны пирамид': 669, 'Кто в домике живёт': 1672,
};
let trophyIcons = 0;
for (const t of D.Trophy || []) {
  const img = TROPHY_ICONS[t.Name];
  if (img != null && fs.existsSync(path.join(root, 'data', 'img', img + '.png')) && t.Image_Id !== img) { t.Image_Id = img; trophyIcons++; }
}
if (trophyIcons) patched.push(`іконки трофеїв: ${trophyIcons}`);
const missing = (D.Trophy || []).filter(t => t.Image_Id == null).map(t => t.Name);
if (missing.length) console.warn('trophies without an icon:', missing.join(', '));

const js = `(function (d) { if (typeof module === 'object' && module.exports) module.exports = d; else window.RQDATA = d; })(${JSON.stringify(D)});\n`;
fs.writeFileSync(dataFile, js);
console.log(patched.length ? 'patched: ' + patched.join(', ') : 'nothing to patch');
