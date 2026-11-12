// Royal Quest stat engine.
// A JavaScript port of the calculation logic from "RQ Calc" by Anon (C#), driven by the same database.
// Works in the browser (window.RQEngine) and in Node (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RQEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Evaluation order inside one stat layer (same as the original).
  const LAYER_STEP = 10, SUM_OFFSET = 0, MUL_OFFSET = 2, DYN_OFFSET = 4, DEP_OFFSET = 8;
  const StatType = { Primary: -5, Energy: -4, RestorePerKill: -3, RestorePerHit: -2, PassiveRestore: -1, Other: 0, DamageBy: 1, Resist: 2, DamageTo: 3 };

  // ---------- number helpers (the original uses C# decimal) ----------
  const clean = x => Math.round(x * 1e9) / 1e9; // drop binary float noise before ceil/trunc
  const dceil = x => Math.ceil(clean(x));
  const dtrunc = x => Math.trunc(clean(x));
  const idiv = (a, b) => Math.trunc(a / b);
  // C# Math.Round: banker's rounding (midpoint to even)
  function bankRound(x, digits = 0) {
    const m = Math.pow(10, digits);
    const v = clean(x * m);
    const f = Math.floor(v);
    const r = Math.abs(v - f - 0.5) < 1e-9 ? (f % 2 === 0 ? f : f + 1) : Math.round(v);
    return r / m;
  }

  // ---------- formulas ----------
  // Hand-ported C# lambdas from the Formula table. Keys are the exact source text,
  // so if the database changes a formula we fall back to a generic translation.
  const critCurve = (rating, level) => 1 - Math.pow(0.999, rating * (-0.6491 * level + 60.1007));
  const KNOWN_FORMULAS = {
    '(v, m) => (v / m) * 15 + v * 2': (v, m) => idiv(v, m) * 15 + v * 2,
    '(v, m) => (v / m) * 2.5m + v / 4.0m': (v, m) => idiv(v, m) * 2.5 + v / 4,
    '(v, m) => (v / m) * 4': (v, m) => idiv(v, m) * 4,
    '(v, m) => (v / m) + v / 3.0m': (v, m) => idiv(v, m) + v / 3,
    '(v, m) => (v / m) * 15': (v, m) => idiv(v, m) * 15,
    '(v, m) => (v / m) * 30': (v, m) => idiv(v, m) * 30,
    '(v, hpv) => v * hpv': (v, hpv) => v * hpv,
    'v => (v * 2) / 1000.0m': v => (v * 2) / 1000,
    'v => (v * 3) / 1000.0m': v => (v * 3) / 1000,
    'v => v / (v / 100 + 1)': v => v / (v / 100 + 1),
    'v => v - 100': v => v - 100,
    '(defense, armorBL) => 100 * (1 - 1 / (1 + defense / armorBL))': (d, a) => 100 * (1 - 1 / (1 + d / a)),
    '(attack, attackSpeed, critChance, critDmg, weaponInfo, level) => attack * (attackSpeed / 100) * (1 - (decimal)((1 - Math.Pow(0.999, (double)critChance * (-0.6491 * level + 60.1007))) * 0.6) + (decimal)((1 - Math.Pow(0.999, (double)critChance * (-0.6491 * level + 60.1007))) * 0.6) * critDmg / 100) * (weaponInfo == null ? 1 : weaponInfo.AttackSpeed);':
      (attack, attackSpeed, crit, critDmg, wi, level) => {
        const p = critCurve(crit, level) * 0.6;
        return attack * (attackSpeed / 100) * (1 - p + p * critDmg / 100) * (wi == null ? 1 : wi.AttackSpeed);
      },
    '(coeff, armorBL) => Math.Round(coeff * armorBL)': (c, a) => bankRound(c * a),
    '(hp, defResist) => hp / (1 - defResist / 100)': (hp, r) => hp / (1 - r / 100),
    '(ehp, pvpResist) => ehp / (1 - pvpResist / 100)': (ehp, r) => ehp / (1 - r / 100),
    '(level, rating) => (decimal)((1 - Math.Pow(0.999, (double)rating * (-0.6491 * level + 60.1007))) * 60)': (level, rating) => critCurve(rating, level) * 60,
  };

  function translateFormula(src) {
    const m = src.match(/^\s*\(?([\w\s,]*)\)?\s*=>\s*([\s\S]+?);?\s*$/);
    if (!m) throw new Error('Cannot parse formula: ' + src);
    const params = m[1].split(',').map(s => s.trim()).filter(Boolean);
    const body = m[2]
      .replace(/\((decimal|double|float|int)\)/g, '')
      .replace(/(\d+(?:\.\d+)?)[mMdD]\b/g, '$1')
      .replace(/Math\.Pow/g, 'Math.pow').replace(/Math\.Round/g, '__round').replace(/Math\.Ceiling/g, 'Math.ceil')
      .replace(/Math\.Floor/g, 'Math.floor').replace(/Math\.Max/g, 'Math.max').replace(/Math\.Min/g, 'Math.min')
      .replace(/Math\.Abs/g, 'Math.abs').replace(/Math\.Truncate/g, 'Math.trunc');
    // eslint-disable-next-line no-new-func
    const fn = new Function('__round', ...params, 'return (' + body + ');');
    return (...args) => fn(bankRound, ...args);
  }

  function MathHelper(settings) {
    const coeff = level => Math.exp(0.05 * level);
    return {
      armorByLevel: (level, maxLevel) => 10040 * coeff(level) / coeff(maxLevel),
      attackByLevel: level => 340 * coeff(level) - 7,
      stampValue(baseValue, internalLevel, minCoef, maxCoef, minLevel, maxLevel) {
        const step = (maxCoef - minCoef) / (maxLevel - minLevel);
        const lv = Math.max(0, internalLevel - minLevel);
        const raw = clean((minCoef + step * lv) * baseValue);
        const up = Math.ceil(raw);
        return up - raw < 0.98 ? up : Math.trunc(raw);
      },
    };
  }

  // ---------- context ----------
  function createContext(T) {
    const byId = (rows) => { const m = new Map(); for (const r of rows || []) m.set(r.Id, r); return m; };
    const group = (rows, key) => { const m = new Map(); for (const r of rows || []) { const k = r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
    const g = (m, k) => m.get(k) || [];

    const settingsRaw = Object.fromEntries((T.Setting || []).map(s => [s.Key, s.Value]));
    const settings = {
      weaponCardCount: +settingsRaw.WeaponCardCount, equipmentCardCount: +settingsRaw.EquipmentCardCount,
      levelMultiplicity: +settingsRaw.LevelMultiplicity, talentLevelMultiplicity: +settingsRaw.TalentLevelMultiplicity,
      statsPerLevel: +settingsRaw.StatsPerLevel, maxStatCount: +settingsRaw.MaxStatCount, maxUpgradeLevel: +settingsRaw.MaxUpgradeLevel,
      attackStatName: settingsRaw.AttackStatName, defenseStatName: settingsRaw.DefenseStatName, hpStatName: settingsRaw.HpStatName,
      customLastVersion: settingsRaw.CustomLastVersion ? +settingsRaw.CustomLastVersion : null,
      qualityMaxLevel: +settingsRaw.QualityMaxLevel, updateDate: settingsRaw.UpdateDate,
    };
    const math = MathHelper(settings);

    const versions = (T.Version || []).slice().sort((a, b) => a.Id - b.Id);
    const lastVersion = settings.customLastVersion ? versions.find(v => v.Id === settings.customLastVersion) : versions[versions.length - 1];
    const inVersion = o => (o.StartVersion_Id == null || o.StartVersion_Id <= lastVersion.Id) && (o.EndVersion_Id == null || lastVersion.Id <= o.EndVersion_Id);

    // --- formulas ---
    const formulaVarsByFormula = group(T.FormulaVariable, 'Formula_Id');
    const formulas = new Map();
    const formulaWarnings = [];
    for (const f of T.Formula || []) {
      const known = KNOWN_FORMULAS[f.Value.trim()];
      let fn = known;
      if (!fn) {
        try { fn = translateFormula(f.Value); formulaWarnings.push(`Formula ${f.Id} translated automatically: ${f.Description}`); }
        catch (e) { formulaWarnings.push(`Formula ${f.Id} failed: ${e.message}`); fn = () => 0; }
      }
      formulas.set(f.Id, { id: f.Id, enabled: !!f.Enabled, description: f.Description, fn, variables: g(formulaVarsByFormula, f.Id).slice().sort((a, b) => a.Id - b.Id) });
    }
    const isEnabledFormula = id => id != null && formulas.has(id) && formulas.get(id).enabled;

    // --- stats ---
    const stats = new Map();
    for (const s of T.Stat || []) {
      stats.set(s.Id, {
        id: s.Id, name: s.Name, elementId: s.Element_Id ?? null, raceId: s.Race_Id ?? null, type: s.Type ?? 0,
        isEditable: !!s.IsEditable, defaultValue: s.DefaultValue ?? 0, isPercent: !!s.IsPercent, progressName: s.ProgressName,
        roundDigits: s.RoundDigits ?? null, parentId: s.Parent_Id ?? null, isMelee: s.IsMelee == null ? null : !!s.IsMelee,
        orderIndex: s.OrderIndex ?? 0, descFormulaId: s.DescriptionFormula_Id ?? null, descTemplate: s.DescriptionTemplate ?? null,
        imageId: s.Image_Id ?? null, stability: !!s.Stability, bonuses: [], sources: [], restoreStats: {},
      });
    }
    for (const sb of T.StatBonus || []) stats.get(sb.Stat_Id).bonuses.push({ typeId: sb.Type_Id, formulaId: sb.Formula_Id });
    for (const ss of T.StatSource || []) if (isEnabledFormula(ss.Formula_Id)) stats.get(ss.Stat_Id).sources.push(ss.Formula_Id);
    for (const s of stats.values()) if (s.parentId != null && s.type < StatType.Other) stats.get(s.parentId).restoreStats[s.type] = s.id;

    const statByName = name => [...stats.values()].find(s => s.name === name);
    const ATTACK = statByName(settings.attackStatName).id;
    const DEFENSE = statByName(settings.defenseStatName).id;
    const HP = statByName(settings.hpStatName).id;

    // --- bonus types ---
    const bonusTypes = new Map();
    for (const b of T.BonusType || []) {
      bonusTypes.set(b.Id, {
        id: b.Id, template: b.Template, isSingle: !!b.IsSingle,
        stampQuality: b.StampQualityMinCoef != null && b.StampQualityMaxCoef != null ? { min: b.StampQualityMinCoef, max: b.StampQualityMaxCoef } : null,
        stats: [], variables: [],
      });
    }
    const btsConditions = group(T.BonusTypeStatCondition, 'BonusTypeStat_Id');
    for (const s of T.BonusTypeStat || []) {
      bonusTypes.get(s.BonusType_Id).stats.push({ id: s.Id, varIndex: s.VarIndex, statId: s.Stat_Id, isMultiply: !!s.IsMultiply, conditions: g(btsConditions, s.Id) });
    }
    for (const v of T.BonusTypeVariable || []) {
      bonusTypes.get(v.BonusType_Id).variables.push({
        index: v.Index, multiplicityStatId: v.MultiplicityStat_Id ?? null, hasSign: !!v.HasSign,
        mulFormulaId: v.MulFormula_Id ?? null, multiplicityValue: v.MultiplicityValue ?? null,
      });
    }
    for (const t of bonusTypes.values()) {
      t.isMultiply = !t.stats.length ? null : t.stats.every(s => s.isMultiply) ? true : t.stats.every(s => !s.isMultiply) ? false : null;
      t.hasDynamic = t.variables.some(v => isEnabledFormula(v.mulFormulaId));
    }

    // --- classes ---
    const classes = new Map();
    for (const c of T.Class || []) {
      classes.set(c.Id, { id: c.Id, name: c.Name, baseId: c.Base_Id ?? null, raw: c, imageId: c.Image_Id ?? null, specializationId: c.Specialization_Id, children: [] });
    }
    const specs = byId(T.ClassSpecialization);
    for (const c of classes.values()) if (c.baseId != null) classes.get(c.baseId).children.push(c.id);
    const chain = id => { const r = []; for (let c = classes.get(id); c; c = c.baseId != null ? classes.get(c.baseId) : null) r.push(c); return r; }; // self..root
    const firstDefined = (id, key) => { for (const c of chain(id)) if (c.raw[key] != null) return c.raw[key]; return null; };
    const allChildren = id => { const out = [id]; for (const ch of classes.get(id).children) out.push(...allChildren(ch)); return out; };
    const classBonusRows = group(T.ClassBonus, 'Class_Id');
    for (const c of classes.values()) {
      c.primaryStatId = firstDefined(c.id, 'PrimaryStat_Id');
      c.energyStatId = firstDefined(c.id, 'EnergyStat_Id');
      c.isMelee = !!firstDefined(c.id, 'IsMelee');
      c.artImageId = c.raw.Class_Image_Id ?? null;
      c.allowExtraWeapon = !!firstDefined(c.id, 'AllowExtraWeapon');
      c.hpPerVitality = firstDefined(c.id, 'HpPerVitality');
      c.spec = specs.get(c.specializationId);
      c.rootId = chain(c.id).pop().id;
      c.parents = chain(c.id).map(x => x.id); // self first
      c.subsetIds = new Set(allChildren(c.id)); // classes that "are" this class
      c.bonuses = chain(c.id).reverse().flatMap(x => g(classBonusRows, x.id)).map(b => ({ typeId: b.Type_Id, vars: [b.Value] }));
      const st = [c.primaryStatId, c.energyStatId];
      const energy = stats.get(c.energyStatId);
      for (const k of Object.keys(energy.restoreStats)) st.push(energy.restoreStats[k]);
      c.statIds = st;
      c.minLevel = c.baseId != null ? classes.get(c.baseId).spec.MaxLevel : 1;
      c.maxLevel = c.spec.MaxLevel ?? lastVersion.MaxLevel;
      c.bonusTalentCount = c.parents.reduce((s, id) => s + (classes.get(id).spec.BonusTalentCount || 0), 0);
    }
    const isSubsetOf = (classId, setId) => setId != null && classes.get(setId).subsetIds.has(classId);

    const classLevelHp = new Map();
    for (const c of classes.values()) if (c.baseId == null) classLevelHp.set(c.id, [0]);
    for (const r of T.ClassLevelHpBonus || []) classLevelHp.get(r.Class_Id)[r.Level] = r.Value;

    // stat sets
    const allStatList = [...stats.values()].sort((a, b) => a.id - b.id);
    const classStatUnion = new Set([...classes.values()].flatMap(c => c.statIds));
    const baseStatIds = allStatList.filter(s => !classStatUnion.has(s.id)).map(s => s.id);
    const notPrimaryEditStatIds = baseStatIds.filter(id => stats.get(id).isEditable);
    const editStatIds = classId => [classes.get(classId).primaryStatId, ...notPrimaryEditStatIds];

    // --- dependency layers (which stats feed which) ---
    const depsOf = s => s.bonuses.flatMap(sb => (bonusTypes.get(sb.typeId)?.stats || []).map(x => x.statId));
    const depStats = allStatList.map(s => ({ id: s.id, deps: depsOf(s) })).filter(p => p.deps.length);
    const layers = [];
    {
      let current = allStatList.map(s => s.id);
      const placed = new Set();
      while (current.length) {
        const curSet = new Set(current);
        const curDep = depStats.filter(p => curSet.has(p.id));
        const yes = [], no = [];
        for (const id of current) {
          const s = stats.get(id);
          const ok = s.sources.every(fid => formulas.get(fid).variables.every(v => v.TypeStat_Id == null || placed.has(v.TypeStat_Id)))
            && !curDep.some(p => p.deps.includes(id));
          (ok ? yes : no).push(id);
        }
        if (!yes.length) throw new Error('Stat dependency cycle');
        layers.push(yes); yes.forEach(id => placed.add(id)); current = no;
      }
    }
    const statPriority = new Map();
    layers.forEach((layer, i) => layer.forEach(id => statPriority.set(id, i * LAYER_STEP)));
    // bonus types: placed by the first stat layer they touch; layers without bonus types are skipped (index compacts)
    const bonusTypePriority = new Map();
    {
      const byLayer = new Map();
      for (const t of [...bonusTypes.values()].sort((a, b) => a.id - b.id)) {
        const li = layers.findIndex(layer => t.stats.some(s => layer.includes(s.statId)));
        if (li < 0) continue;
        if (!byLayer.has(li)) byLayer.set(li, []);
        byLayer.get(li).push(t);
      }
      let idx = 0;
      for (let li = 0; li < layers.length; li++) {
        if (!byLayer.has(li)) continue;
        for (const t of byLayer.get(li)) bonusTypePriority.set(t.id, idx * LAYER_STEP + (t.isMultiply ? MUL_OFFSET : SUM_OFFSET));
        idx++;
      }
    }
    const attackBonusTypes = new Set([...bonusTypes.values()].filter(t => t.stats.length && t.stats.every(s => s.statId === ATTACK)).map(t => t.id));
    const sourceStatIds = allStatList.filter(s => s.sources.length).map(s => s.id);

    // --- equipment ---
    const slots = new Map();
    for (const s of T.EquipmentSlot || []) {
      slots.set(s.Id, { id: s.Id, name: s.Name, stateId: s.State_Id ?? null, extraSlotId: s.ExtraSlot_Id ?? null, upgradable: !!s.Upgradable, count: s.Count || 1, isWeapon: s.IsWeapon == null ? null : !!s.IsWeapon, imageId: s.Image_Id ?? null, sharedStamp: !!s.SharedStamp, primarySlotId: null, typeIds: [] });
    }
    for (const s of slots.values()) if (s.extraSlotId != null) slots.get(s.extraSlotId).primarySlotId = s.id;
    const typeConds = group(T.EquipmentTypeCondition, 'Type_Id');
    const typeBonusRows = group(T.EquipmentTypeBonus, 'EquipmentType_Id');
    const eqTypes = new Map();
    for (const t of T.EquipmentType || []) {
      const isWeaponType = t.IsMeleeWeapon != null || t.IsSingleHandWeapon != null;
      eqTypes.set(t.Id, {
        id: t.Id, name: t.Name, slotId: t.Slot_Id,
        weaponInfo: isWeaponType ? { isMelee: !!t.IsMeleeWeapon, isSingleHand: !!t.IsSingleHandWeapon, isDoubleHit: !!t.IsDoubleHit } : null,
        conditionClassIds: g(typeConds, t.Id).map(c => c.Class_Id),
        bonuses: g(typeBonusRows, t.Id).map(b => ({ typeId: b.Type_Id, vars: [b.Value] })),
      });
      slots.get(t.Slot_Id).typeIds.push(t.Id);
    }
    const eqConds = group(T.EquipmentCondition, 'Equipment_Id');
    const eqBonusRows = group(T.EquipmentBonus, 'Equipment_Id');
    const eqBonusVars = group(T.EquipmentBonusVariable, 'EquipmentBonus_Id');
    const toArr = (rows, idxKey = 'Index', valKey = 'Value') => { const a = []; for (const r of rows) a[r[idxKey]] = r[valKey]; for (let i = 0; i < a.length; i++) if (a[i] == null) a[i] = 0; return a; };
    // the game data puts the switch on the wrong bonus of Ашкалотский тотем: «+4 к Удаче» (always on) instead of its dodge proc
    const ACTIVATE_FIX = { 781: null, 782: 1 };
    const activateOf = b => { const v = b.Id in ACTIVATE_FIX ? ACTIVATE_FIX[b.Id] : b.Activate; return v == null ? null : !!v; };
    const equipment = new Map();
    for (const e of T.Equipment || []) {
      let info = null;
      const has = k => e[k] != null;
      if (has('InternalLevel') && has('Attack') && has('AttackSpeed')) info = { kind: has('Defense') ? 'defweapon' : 'weapon', internalLevel: e.InternalLevel, attack: e.Attack, attackSpeed: e.AttackSpeed, defense: e.Defense ?? 0 };
      else if (has('InternalLevel') && has('Defense')) info = { kind: 'armor', internalLevel: e.InternalLevel, defense: e.Defense };
      equipment.set(e.Id, {
        id: e.Id, name: e.Name, typeId: e.Type_Id, level: e.Level ?? 1, genderId: e.Gender_Id ?? null, info,
        isPersonal: !!e.IsPersonal, imageId: e.Image_Id ?? null, costumeImageId: e.CostumeImage_Id ?? null, primaryCardId: e.PrimaryCard_Id ?? null,
        startVersion: e.StartVersion_Id, endVersion: e.EndVersion_Id, inVersion: inVersion(e), isCostume: e.CostumeImage_Id != null,
        conditionClassIds: g(eqConds, e.Id).map(c => c.Class_Id),
        bonuses: g(eqBonusRows, e.Id).map(b => ({ typeId: b.Type_Id, orderIndex: b.OrderIndex, activate: activateOf(b), vars: toArr(g(eqBonusVars, b.Id)) })).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
      });
    }
    const forges = []; for (const f of T.EquipmentForge || []) forges[f.Level] = f;
    const levelForges = new Map(); for (const f of T.EquipmentLevelForge || []) levelForges.set(f.EquipmentLevel + ':' + f.Level, f.Hp);
    const eqClasses = (T.EquipmentClass || []).slice().sort((a, b) => b.Level - a.Level);
    const equipmentClassOf = item => { const lv = item.info ? item.info.internalLevel : 1; return eqClasses.find(c => lv >= c.Level); };

    function itemClassConditions(item) {
      const lists = [
        eqTypes.get(item.typeId).conditionClassIds.flatMap(id => allChildren(id)),
        item.conditionClassIds.flatMap(id => allChildren(id)),
      ].filter(l => l.length);
      if (!lists.length) return [];
      const union = [...new Set(lists.flat())];
      return union.filter(id => { const c = classes.get(id); return c.spec.MaxLevel == null || c.spec.MaxLevel >= item.level; });
    }
    const itemAllowedForClass = (item, classId) => { const l = itemClassConditions(item); return !l.length || l.includes(classId); };
    const itemAllowedInState = (item, stateId) => { const s = slots.get(eqTypes.get(item.typeId).slotId).stateId; return s == null || s === stateId; };

    // --- cards ---
    const cardTypes = byId(T.CardType);
    const cardBonusRows = group(T.CardBonus, 'Card_Id');
    const cardBonusVars = group(T.CardBonusVariable, 'CardBonus_Id');
    const cardBonusVarConds = group(T.CardBonusVariableCondition, 'CardBonusVariable_Id');
    const cardSlotRows = group(T.CardEquipmentSlot, 'Card_Id');
    const cardTypeRows = group(T.CardEquipmentType, 'Card_Id');
    const cards = new Map();
    for (const c of T.Card || []) {
      const bonuses = g(cardBonusRows, c.Id).slice().sort((a, b) => (a.OrderIndex ?? 0) - (b.OrderIndex ?? 0) || a.Id - b.Id).map(b => ({
        typeId: b.Type_Id,
        upgrade: b.UpgConditionVariable != null && b.UpgLevelStepVariable != null ? { condition: b.UpgConditionVariable, step: b.UpgLevelStepVariable } : null,
        requiredCardId: b.RequiredCard_Id ?? null, negateCardId: b.NegateCard_Id ?? null, multiplyEffectCardId: b.MultiplyEffectCard_Id ?? null,
        requiredSetId: b.RequiredSet_Id ?? null, requiredSetSize: b.RequiredSetSize ?? 0,
        variables: g(cardBonusVars, b.Id).map(v => ({ index: v.Index, value: v.Value, conditions: g(cardBonusVarConds, v.Id).map(x => ({ typeId: x.EquipmentType_Id ?? null, isSingleHand: x.IsSingleHandWeapon == null ? null : !!x.IsSingleHandWeapon })) })),
      }));
      const ct = cardTypes.get(c.Type_Id);
      cards.set(c.Id, {
        id: c.Id, name: c.Name, typeId: c.Type_Id, elementId: ct?.Element_Id ?? null, cardTypeName: ct?.Name, imageId: ct?.Image_Id ?? null,
        maxEquipmentClassId: ct?.MaxEquipmentClass_Id ?? null, minEquipmentClassId: c.MinEquipmentClass_Id ?? null,
        isLegacy: !!c.IsLegacy, inVersion: inVersion(c), isSingleHand: c.IsSingleHandWeapon == null ? null : !!c.IsSingleHandWeapon,
        isMelee: c.IsMeleeWeapon == null ? null : !!c.IsMeleeWeapon, setId: c.Set_Id ?? null, groupKey: c.GroupKey ?? null, groupValue: c.GroupValue ?? null, groupOrder: c.GroupOrderKey ?? null,
        slotIds: g(cardSlotRows, c.Id).filter(inVersion).map(r => r.Slot_Id),
        typeIds: g(cardTypeRows, c.Id).filter(inVersion).map(r => r.Type_Id),
        bonuses,
      });
    }
    function cardAllowedTypes(card) {
      const ids = [...new Set([...card.slotIds.flatMap(s => slots.get(s)?.typeIds || []), ...card.typeIds])];
      return ids.filter(tid => {
        const wi = eqTypes.get(tid).weaponInfo;
        if (card.isSingleHand != null && (!wi || wi.isSingleHand !== card.isSingleHand)) return false;
        if (card.isMelee != null && (!wi || wi.isMelee !== card.isMelee)) return false;
        return true;
      });
    }
    function cardAllowedOn(card, item) {
      if (!cardAllowedTypes(card).includes(item.typeId)) return false;
      const ec = equipmentClassOf(item);
      if (card.maxEquipmentClassId != null && card.maxEquipmentClassId < ec.Id) return false;
      if (card.minEquipmentClassId != null && card.minEquipmentClassId > ec.Id) return false;
      return true;
    }

    // --- stamps ---
    const stampVariantRows = group(T.StampVariant, 'Stamp_Id');
    const stampVariantBonusRows = group(T.StampVariantBonus, 'StampVariant_Id');
    const stampEquipRows = group(T.StampEquipment, 'Stamp_Id');
    const stampColors = byId(T.StampColor);
    const stampClassRows = group(T.StampClass, 'Stamp_Id');
    const stamps = new Map(), stampVariants = new Map();
    for (const s of T.Stamp || []) {
      const st = { id: s.Id, name: s.Name, isLegacy: !!s.IsLegacy, variants: [], equipTypeIds: g(stampEquipRows, s.Id).filter(inVersion).map(r => r.Type_Id), hasEquipRows: g(stampEquipRows, s.Id).length > 0, classIds: g(stampClassRows, s.Id).map(r => r.Class_Id) };
      for (const v of g(stampVariantRows, s.Id)) {
        const variant = { id: v.Id, stampId: s.Id, colorId: v.Color_Id, color: stampColors.get(v.Color_Id), bonuses: g(stampVariantBonusRows, v.Id).slice().sort((a, b) => (a.OrderIndex ?? 0) - (b.OrderIndex ?? 0)).map(b => ({ typeId: b.Type_Id, value: b.Value, qualityValue: b.QualityValue })) };
        st.variants.push(variant); stampVariants.set(v.Id, variant);
      }
      stamps.set(s.Id, st);
    }
    // stats that make a stamp class-specific (primary stat / energy / melee-ranged)
    const filterStatsOfType = t => [...new Set(t.stats.map(s => { let st = stats.get(s.statId); while (st.parentId != null && st.type < StatType.Other) st = stats.get(st.parentId); return st; })
      .filter(st => st.isMelee != null || st.type === StatType.Primary || st.type === StatType.Energy).map(st => st.id))];
    const classAllowsStat = (cls, statId) => { const s = stats.get(statId); if (s.isMelee != null) return cls.isMelee === s.isMelee; if (s.type === StatType.Energy) return cls.energyStatId === s.id; if (s.type === StatType.Primary) return cls.primaryStatId === s.id; return true; };
    // whether a stamp is one of this class's own stamps
    function stampForClass(stamp, classId) {
      if (stamp.classIds.length) return stamp.classIds.includes(classId); // explicit list from the wiki
      const filter = [...new Set(stamp.variants.flatMap(v => v.bonuses.flatMap(b => filterStatsOfType(bonusTypes.get(b.typeId)))))];
      const cls = classes.get(classId);
      return !filter.length || filter.every(id => classAllowsStat(cls, id));
    }
    // Deliberate deviation from Anon's calculator (user's call, 2026-11-12, as in the game): the item decides, not the
    // character and not the level. An item any class can wear (rings, amulets, common armor…) takes a stamp of any
    // class; a class item (e.g. a Разбойник armor) takes only stamps that fit one of the classes it is made for.
    function stampAllowed(stamp, item, classId) {
      if (stamp.hasEquipRows && !stamp.equipTypeIds.includes(item.typeId)) return false;
      const itemClasses = itemClassConditions(item);
      return !itemClasses.length || itemClasses.some(id => stampForClass(stamp, id));
    }

    // --- talents, auras, buffs, elixirs, consumables, collections ---
    const talentBranches = new Map();
    for (const b of T.TalentBranch || []) talentBranches.set(b.Id, { id: b.Id, name: b.Name, classId: b.Class_Id, color: b.Color, orderIndex: b.OrderIndex ?? 0, talents: [] });
    const talentBonusRows = group(T.TalentBonus, 'Talent_Id');
    const talents = new Map();
    for (const t of T.Talent || []) {
      const tal = {
        id: t.Id, branchId: t.Branch_Id, name: t.Name, description: t.Description, passiveDescription: t.PassiveDescription, h: t.HIndex, v: t.VIndex, active: !!t.Active,
        equipmentCondition: t.EquipmentCondition ?? null, imageId: t.Image_Id ?? null, grayImageId: t.GrayImage_Id ?? null,
        bonuses: g(talentBonusRows, t.Id).map(b => ({ typeId: b.Type_Id, vars: [b.Value], sharedValue: b.SharedValue ?? null, auraId: b.AuraCondition_Id ?? null, buffId: b.BuffCondition_Id ?? null })),
      };
      talents.set(t.Id, tal); talentBranches.get(t.Branch_Id).talents.push(tal);
    }
    const auraBonusRows = group(T.AuraBonus, 'Aura_Id');
    const auras = new Map();
    for (const a of T.Aura || []) auras.set(a.Id, { id: a.Id, name: a.Name, classId: a.Class_Id, level: a.Level ?? 1, inVersion: inVersion(a), imageId: a.Image_Id ?? null, bonuses: g(auraBonusRows, a.Id).slice().sort((x, y) => (x.OrderIndex ?? 0) - (y.OrderIndex ?? 0)).map(b => ({ typeId: b.Type_Id, vars: [b.Value], sharedValue: b.SharedValue ?? null, inVersion: inVersion(b) })) });
    const buffBonusRows = group(T.BuffBonus, 'Buff_Id');
    // «Вожак стаи» (wolf form, buff 48): the game multiplies attack speed by 1.25 instead of adding +25% (2026-11-05, players' check):
    // its «к Скорости атаки» bonus (type 11) is counted as type 273, «бонус перемножается, а не складывается»
    const MULTIPLY_AS_BUFFS = new Set([48]);
    const buffs = new Map();
    for (const b of T.Buff || []) buffs.set(b.Id, { id: b.Id, name: b.Name, maxStack: b.MaxStackCount || 1, level: b.Level ?? 1, classId: b.Class_Id ?? null, cardId: b.Card_Id ?? null, stampId: b.Stamp_Id ?? null, talentId: b.TalentCondition_Id ?? null, guildTalentId: b.GuildCondition_Id ?? null, autoEnabled: !!b.AutoEnabled, inVersion: inVersion(b), imageId: b.Image_Id ?? null, isNegate: !!b.IsNegate, group: b.Group ?? null, bonuses: g(buffBonusRows, b.Id).slice().sort((x, y) => (x.OrderIndex ?? 0) - (y.OrderIndex ?? 0)).map(x => ({ typeId: MULTIPLY_AS_BUFFS.has(b.Id) && x.Type_Id === 11 ? 273 : x.Type_Id, vars: [x.Value] })) });
    const simpleBonusMap = (rows, key) => { const m = group(rows, key); return id => g(m, id).slice().sort((x, y) => (x.OrderIndex ?? 0) - (y.OrderIndex ?? 0)).map(b => ({ typeId: b.Type_Id, vars: [b.Value] })); };
    const elixirBonuses = simpleBonusMap(T.ElixirBonus, 'Elixir_Id');
    const elixirs = new Map((T.Elixir || []).map(e => [e.Id, { id: e.Id, name: e.Name, isLegacy: !!e.IsLegacy, imageId: e.Image_Id ?? null, bonuses: elixirBonuses(e.Id) }]));
    const consumableBonuses = simpleBonusMap(T.ConsumableBonus, 'Consumable_Id');
    const consumables = new Map((T.Consumable || []).map(e => [e.Id, { id: e.Id, name: e.Name, exclusive: e.Exeption ?? null, imageId: e.Image_Id ?? null, bonuses: consumableBonuses(e.Id) }]));
    const collectedBonuses = simpleBonusMap(T.CollectedItemBonus, 'CollectedItem_Id');
    const pets = byId(T.Pet), trophies = byId(T.Trophy);
    const collectedGroups = (T.CollectedGroup || []).slice().sort((a, b) => a.OrderIndex - b.OrderIndex);
    const collected = new Map();
    for (const c of T.CollectedItem || []) {
      const eq = c.Equipment_Id != null ? equipment.get(c.Equipment_Id) : null;
      const name = eq ? eq.name : c.Pet_Id != null ? pets.get(c.Pet_Id)?.Name : trophies.get(c.Trophy_Id)?.Name;
      const imageId = eq ? eq.imageId : c.Pet_Id != null ? pets.get(c.Pet_Id)?.Image_Id : trophies.get(c.Trophy_Id)?.Image_Id;
      collected.set(c.Id, { id: c.Id, groupId: c.Group_Id, name, imageId: imageId ?? null, genderId: eq ? eq.genderId : null, orderIndex: c.OrderIndex ?? 0, inVersion: inVersion(c), bonuses: collectedBonuses(c.Id) });
    }

    // Guild talents: one talent per branch, points 1..MaxPoints; a branch opens only when the previous ones are maxed.
    const guildVarRows = group(T.GuildTalentVariable, 'Talent_Id');
    const guildBonusRows = group(T.GuildTalentBonus, 'Talent_Id');
    const guildBonusVarRows = group(T.GuildTalentBonusVariable, 'GuildTalentBonus_Id');
    const guildTalents = new Map();
    const guildBranches = (T.GuildTalentBranch || []).slice().sort((a, b) => a.Id - b.Id).map(br => ({ id: br.Id, name: br.Name, maxPoints: br.MaxPoints, talents: [] }));
    for (const t of (T.GuildTalent || []).slice().sort((a, b) => (a.OrderIndex ?? 0) - (b.OrderIndex ?? 0))) {
      const gt = {
        id: t.Id, branchId: t.Branch_Id, name: t.Name, description: t.Description || '', active: !!t.Active, imageId: t.Image_Id ?? null, grayImageId: t.GrayImage_Id ?? null,
        // value of variable `index` at `points`
        value: (index, points) => g(guildVarRows, t.Id).find(v => v.Index === index && v.Points === points)?.Value ?? 0,
        bonusRows: g(guildBonusRows, t.Id).map(b => ({ typeId: b.Type_Id, vars: g(guildBonusVarRows, b.Id) })),
      };
      gt.bonuses = points => gt.bonusRows.map(b => {
        const vars = [];
        for (const v of b.vars) vars[v.Index] = gt.value(v.TalentVariableIndex, points);
        return { typeId: b.typeId, vars: Array.from(vars, x => x ?? 0) };
      });
      guildTalents.set(t.Id, gt);
      guildBranches.find(br => br.id === t.Branch_Id)?.talents.push(gt);
    }

    // Aura bonuses (port of AuraExtensions.GetBonuses). shared = what party members get (SharedValue ?? Value).
    // Talent bonuses for the aura override the aura's own bonus of the same type.
    const auraTalentBonuses = new Map([...auras.keys()].map(id => [id, [...talents.values()].flatMap(t => t.bonuses).filter(b => b.auraId === id)]));
    const nonZero = b => bonusTypes.get(b.typeId).stats.some(s => (b.vars[s.varIndex] ?? 0) !== 0);
    function auraBonuses(aura, shared, talentBonuses) {
      const expand = b => shared ? { typeId: b.typeId, vars: [b.sharedValue ?? b.vars[0]] } : b;
      const m = new Map();
      const add = (list, p) => { for (const b of list.map(expand).filter(nonZero)) { const cur = m.get(b.typeId); if (!cur || p > cur.p) m.set(b.typeId, { b, p }); } };
      add(aura.bonuses.filter(b => b.inVersion), 0);
      add(talentBonuses.filter(b => b.auraId === aura.id), 1);
      return [...m.values()].map(x => x.b);
    }
    // auras a party member can share with you: base bonuses and with the owner's talents
    const sharedAuras = [...auras.values()].filter(a => a.inVersion)
      .map(a => ({ aura: a, base: auraBonuses(a, true, []), withTalents: auraBonuses(a, true, auraTalentBonuses.get(a.id)) }))
      .filter(x => x.base.length || x.withTalents.length);

    const ctx = {
      settings, lastVersion, formulaWarnings, StatType,
      stats, bonusTypes, classes, slots, eqTypes, equipment, cards, stamps, stampVariants, stampColors, talentBranches, talents,
      auras, buffs, elixirs, consumables, collected, collectedGroups,
      genders: T.Gender || [], states: T.State || [], events: (T.Event || []).filter(inVersion), elements: byId(T.Element), races: byId(T.Race),
      ids: { ATTACK, DEFENSE, HP },
      layers, statPriority, bonusTypePriority,
      editStatIds, baseStatIds, isSubsetOf, equipmentClassOf, itemClassConditions, itemAllowedForClass, itemAllowedInState,
      cardAllowedOn, stampAllowed, stampForClass, math, formulas,
    };

    // ---------- rules used by the UI ----------
    ctx.freeStats = ch => (ch.level - 1) * settings.statsPerLevel - editStatIds(ch.classId).reduce((s, id) => s + ((ch.stats[id] || 1) - 1), 0);
    ctx.talentPoints = ch => Math.floor(Math.min(ch.level, lastVersion.MaxTalentLevel) / settings.talentLevelMultiplicity) + classes.get(ch.classId).bonusTalentCount;
    ctx.classBranches = classId => classes.get(classId).parents.slice().reverse().flatMap(cid => [...talentBranches.values()].filter(b => b.classId === cid).sort((a, b) => a.orderIndex - b.orderIndex));
    // own auras; skip ones that give the owner nothing (e.g. the second «Фортуна» that only gives the party +Hit)
    ctx.classAuras = (classId, level) => classes.get(classId).parents.flatMap(cid => [...auras.values()].filter(a => a.classId === cid)).reverse()
      .filter(a => a.level <= level && a.inVersion && auraBonuses(a, false, auraTalentBonuses.get(a.id)).length);
    ctx.sharedAuras = sharedAuras;
    ctx.guildBranches = guildBranches;
    ctx.guildTalents = guildTalents;
    ctx.guildPointsTotal = guildBranches.reduce((s, b) => s + b.maxPoints, 0);
    // drops talents that break the rules (wrong points, two in a branch, a branch opened before the previous is maxed)
    ctx.validGuildTalents = gts => {
      const out = {};
      for (const br of guildBranches) {
        const picked = br.talents.filter(t => (gts || {})[t.id] > 0);
        if (picked.length !== 1) break;
        const pts = Math.min(gts[picked[0].id], br.maxPoints);
        out[picked[0].id] = pts;
        if (pts < br.maxPoints) break;
      }
      return out;
    };
    ctx.auraBonuses = auraBonuses;
    ctx.maxUpgrade = item => equipmentClassOf(item).MaxUpgradeLevel ?? settings.maxUpgradeLevel;
    ctx.cardCount = item => { const s = slots.get(eqTypes.get(item.typeId).slotId); return s.isWeapon === true ? settings.weaponCardCount : s.isWeapon === false ? settings.equipmentCardCount : 0; };
    ctx.formatBonus = formatBonus;
    ctx.evaluateDynamicBonus = (bonus, ch) => evaluateDynamicBonus(bonus, ch);
    ctx.stampBonuses = (variantId, item) => stampBonuses(stampVariants.get(variantId), item);
    // what an upgrade adds to an item (for tooltips)
    ctx.upgradeBonus = (item, upgrade) => {
      const f = forges[upgrade];
      if (!item.info || !upgrade || !f) return null;
      return {
        attack: item.info.attack ? dceil(f.Attack * item.info.attack) : 0,
        defense: item.info.defense ? dceil(f.Defense * item.info.defense) : 0,
        hp: item.info.kind === 'armor' ? (levelForges.get(item.info.internalLevel + ':' + upgrade) || 0) : 0,
        allStat: f.AllStatBonus || 0,
      };
    };
    ctx.calc = ch => calc(ctx, ch);

    // equipment slot keys: "<slotId>:<index>"
    ctx.slotKeys = () => {
      const keys = [];
      for (const s of [...slots.values()].sort((a, b) => a.id - b.id)) for (let i = 0; i < s.count; i++) keys.push(`${s.id}:${i}`);
      return keys;
    };
    ctx.reverseKey = key => { const [sid, i] = key.split(':').map(Number); const s = slots.get(sid); const r = s.extraSlotId ?? s.primarySlotId; return r != null ? `${r}:${i}` : null; };

    // items that can go into a slot for this character
    ctx.itemsForSlot = (ch, key) => {
      const [sid, idx] = key.split(':').map(Number);
      const slot = slots.get(sid);
      const cls = classes.get(ch.classId);
      let typeFilter = t => t.slotId === sid;
      if (slot.primarySlotId != null) { // extra (left hand) slot
        const prim = ch.equipment[`${slot.primarySlotId}:${idx}`];
        const primItem = prim && equipment.get(prim.itemId);
        if (primItem && eqTypes.get(primItem.typeId).weaponInfo && !eqTypes.get(primItem.typeId).weaponInfo.isSingleHand) return [];
        typeFilter = t => t.slotId === sid || (cls.allowExtraWeapon && t.slotId === slot.primarySlotId && primItem && t.id === primItem.typeId);
      }
      return [...equipment.values()].filter(e => e.inVersion && typeFilter(eqTypes.get(e.typeId)) && e.level <= ch.level
        && (e.genderId == null || e.genderId === ch.genderId) && itemAllowedForClass(e, ch.classId))
        .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'ru'));
    };
    ctx.cardsForItem = (item, position) => [...cards.values()].filter(c => c.inVersion && cardAllowedOn(c, item) && (c.elementId == null || position === 0))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    ctx.stampsForItem = (item, classId) => [...stamps.values()].filter(s => s.variants.length && stampAllowed(s, item, classId)).sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    ctx.availableBuffs = ch => {
      const eqCards = new Set(Object.values(ch.equipment || {}).flatMap(e => e.cards || []).filter(Boolean));
      const eqStamps = new Set(Object.values(ch.equipment || {}).map(e => e.stampVariantId && stampVariants.get(e.stampVariantId)?.stampId).filter(Boolean));
      return [...buffs.values()].filter(b => {
        if (!b.inVersion) return false;
        if (b.classId != null) return isSubsetOf(ch.classId, b.classId) && b.level <= ch.level && (b.talentId == null || (ch.talents || []).includes(b.talentId));
        if (b.cardId != null) return eqCards.has(b.cardId);
        if (b.stampId != null) return eqStamps.has(b.stampId);
        if (b.guildTalentId != null) return (ch.guildTalents || {})[b.guildTalentId] > 0;
        return true;
      });
    };

    ctx.defaultCharacter = () => {
      const classId = [...classes.keys()].sort((a, b) => a - b)[0];
      const ch = {
        classId, level: 1, genderId: ctx.genders[0]?.Id ?? 1, stateId: ctx.states[0]?.Id ?? 1, eventId: null, lostControl: false,
        stats: {}, equipment: {}, talents: [], enableTalents: true, guildTalents: {}, enableGuildTalents: true, auraId: null, sharedAuras: {}, enableAura: true,
        buffs: {}, enableBuffs: true, elixirId: null, enableElixir: true, consumables: [], enableConsumables: true,
        collected: [], enableCollecting: true,
      };
      for (const id of editStatIds(classId)) ch.stats[id] = 1;
      return ch;
    };

    // ---------- calculation ----------
    function bonusVarsWithDynamic(bonus, ch) {
      const t = bonusTypes.get(bonus.typeId);
      if (!t.hasDynamic) return bonus;
      return evaluateDynamicBonus(bonus, ch);
    }
    function evaluateDynamicBonus(bonus, ch) {
      const t = bonusTypes.get(bonus.typeId);
      const vars = bonus.vars.map((value, i) => {
        const tv = t.variables.find(v => v.index === i && isEnabledFormula(v.mulFormulaId));
        return tv ? runFormula(tv.mulFormulaId, { ch, custom: { 0: value } }) : value;
      });
      return { typeId: bonus.typeId, vars };
    }

    function runFormula(formulaId, st) {
      const f = formulas.get(formulaId);
      const args = f.variables.map(v => {
        switch (v.Type) {
          case 0: return st.custom[v.Index];
          case 1: return dtrunc(st.custom[v.Index]);
          case 2: return st.ch.level;
          case 3: return lastVersion.MaxLevel;
          case 4: return st.stats.get(v.TypeStat_Id) ?? 0;
          case 5: return st.weaponInfo ?? null;
          case 7: return settings.levelMultiplicity;
          case 8: return classes.get(st.ch.classId).hpPerVitality;
          case 9: return math.armorByLevel(st.ch.level, settings.qualityMaxLevel);
          case 10: return math.attackByLevel(st.ch.level);
          case 11: {
            const stat = stats.get(v.TypeStat_Id);
            return runFormula(stat.descFormulaId, { ...st, custom: { 0: st.stats.get(stat.id) ?? 0 } });
          }
          default: throw new Error('Unknown formula variable type ' + v.Type);
        }
      });
      return f.fn(...args);
    }

    function stampBonuses(variant, item) {
      if (!variant) return [];
      const lv = item.info ? item.info.internalLevel : 1;
      return variant.bonuses.map(b => {
        const t = bonusTypes.get(b.typeId);
        const v = t.stampQuality ? math.stampValue(b.qualityValue, lv, t.stampQuality.min, t.stampQuality.max, 10, settings.qualityMaxLevel) : b.value;
        return { typeId: b.typeId, vars: [v] };
      });
    }

    function formatBonus(bonus) {
      const t = bonusTypes.get(bonus.typeId);
      if (!t) return '';
      return t.template.replace(/\{(\d+)(?::[^}]*)?\}/g, (_, n) => {
        const i = +n;
        const v = bonus.vars[i] ?? 0;
        const sign = t.variables.some(x => x.index === i && x.hasSign);
        const shown = Number.isInteger(v) ? v : +v.toFixed(2);
        return v > 0 && sign ? '+' + Math.ceil(v) : String(shown);
      });
    }

    function calc(ctx, chIn) {
      const ch = Object.assign(ctx.defaultCharacter(), chIn);
      const cls = classes.get(ch.classId);
      const currentClassStats = new Set([...cls.statIds, ...baseStatIds]);
      const entries = Object.entries(ch.equipment || {})
        .filter(([, e]) => e && equipment.has(e.itemId))
        .map(([key, e]) => ({ key, slotId: +key.split(':')[0], index: +key.split(':')[1], item: equipment.get(e.itemId), upgrade: e.upgrade || 0, stampVariant: e.stampVariantId ? stampVariants.get(e.stampVariantId) : null, cards: (e.cards || []).map(id => id ? cards.get(id) : null), active: e.active !== false }));
      const allowed = en => itemAllowedInState(en.item, ch.stateId);
      const isExtra = en => slots.get(en.slotId).primarySlotId != null;
      const slotIsWeapon = item => slots.get(eqTypes.get(item.typeId).slotId).isWeapon === true;
      const isDual = en => {
        if (!slotIsWeapon(en.item)) return false;
        const rk = ctx.reverseKey(en.key);
        const r = rk && entries.find(x => x.key === rk);
        return !!r && slotIsWeapon(r.item);
      };

      // current weapon. Two weapons (Вор, Разбойник, Ассасин): attack AND speed averaged. The original RQ Calc summed
      // the speeds, which doubled the DPS of every dual-wield build (2026-11-02: players report the game does not).
      const weapons = entries.slice().sort((a, b) => isExtra(a) - isExtra(b)).filter(allowed).filter(en => en.item.info && en.item.info.kind !== 'armor').map(en => en.item.info);
      const weaponInfo = weapons.length ? { Attack: idiv(weapons.reduce((s, w) => s + w.attack, 0), weapons.length), AttackSpeed: weapons.reduce((s, w) => s + w.attackSpeed, 0) / weapons.length } : null;

      const allCards = entries.flatMap(en => en.cards).filter(Boolean);
      const cardCount = pred => allCards.filter(pred).length;

      // --- upgrade info per item ---
      const upgradeInfo = en => {
        const info = en.item.info;
        if (!info || !en.upgrade) return null;
        const f = forges[en.upgrade];
        if (!f) return null;
        const def = d => dceil(f.Defense * d), atk = a => dceil(f.Attack * a);
        if (info.kind === 'armor') return { kind: 'armor', allStat: f.AllStatBonus, defense: def(info.defense), hp: levelForges.get(info.internalLevel + ':' + en.upgrade) || 0 };
        if (info.kind === 'weapon') return { kind: 'weapon', allStat: f.AllStatBonus, attack: atk(info.attack) };
        return { kind: 'defweapon', allStat: f.AllStatBonus, attack: atk(info.attack), defense: def(info.defense) };
      };

      function equipmentStats() {
        const m = new Map();
        const add = (id, v) => { if (v) m.set(id, (m.get(id) || 0) + v); };
        const withInfo = entries.filter(en => en.item.info && allowed(en));
        for (const en of withInfo) {
          const mod = isDual(en) ? 0.5 : 1, info = en.item.info;
          if (info.kind === 'armor') add(DEFENSE, info.defense);
          else if (info.kind === 'weapon') add(ATTACK, info.attack * mod);
          else { add(ATTACK, info.attack * mod); add(DEFENSE, info.defense); }
        }
        for (const en of withInfo) {
          const u = upgradeInfo(en); if (!u) continue;
          const mod = isDual(en) ? 0.5 : 1;
          if (u.kind === 'armor') { add(DEFENSE, u.defense); add(HP, u.hp); }
          else if (u.kind === 'weapon') add(ATTACK, u.attack * mod);
          else { add(ATTACK, u.attack * mod); add(DEFENSE, u.defense); }
        }
        for (const en of withInfo) {
          const u = upgradeInfo(en); if (!u || !u.allStat) continue;
          for (const id of editStatIds(ch.classId)) add(id, u.allStat);
        }
        return m;
      }

      // --- card bonus variables ---
      function cardBonusVars(en, cb) {
        if (cb.requiredCardId != null && cardCount(c => c.id === cb.requiredCardId) === 0) return null;
        let vars;
        if (cb.upgrade) {
          if (cb.upgrade.condition >= en.upgrade) return null;
          const main = cb.variables[0];
          const num = cb.upgrade.step === 0 ? 1 : idiv(en.upgrade - cb.upgrade.condition, cb.upgrade.step);
          vars = [];
          [main.value, cb.upgrade.step, cb.upgrade.condition, main.value * num].forEach((v, i) => { vars[main.index + i] = v; });
        } else {
          vars = [];
          const t = eqTypes.get(en.item.typeId);
          for (const v of cb.variables) {
            const ok = !v.conditions.length || v.conditions.some(c => (c.typeId == null || c.typeId === t.id) && (c.isSingleHand == null || (t.weaponInfo && c.isSingleHand === t.weaponInfo.isSingleHand)));
            vars[v.index] = ok ? v.value : 0;
          }
        }
        if (cb.multiplyEffectCardId != null) { const n = cardCount(c => c.id === cb.multiplyEffectCardId); vars = vars.map(v => v * n); }
        if (cb.negateCardId != null) { const n = cardCount(c => c.id === cb.negateCardId); vars = vars.map(v => v * (1 - n)); }
        if (cb.requiredSetId != null && cardCount(c => c.setId === cb.requiredSetId) < cb.requiredSetSize) return null;
        for (let i = 0; i < vars.length; i++) if (vars[i] == null) vars[i] = 0;
        return vars.length ? vars : null;
      }
      function groupByType(list, typeId) {
        const t = bonusTypes.get(typeId);
        const calcVars = new Set(t.stats.map(s => s.varIndex));
        const byIdx = new Map();
        for (const b of list) b.vars.forEach((v, i) => { if (!byIdx.has(i)) byIdx.set(i, []); byIdx.get(i).push(v); });
        const merged = [];
        let conflict = false;
        for (const [i, vals] of byIdx) {
          if (calcVars.has(i)) merged[i] = vals.reduce((s, v) => s + v, 0);
          else { const d = [...new Set(vals)]; if (d.length > 1) conflict = true; merged[i] = d[0]; }
        }
        return conflict ? list : [{ typeId, vars: merged, source: list[0].source }];
      }

      // --- all bonus sources (same order as the original) ---
      function getBonuses() {
        const out = [];
        const push = (b, source) => out.push({ typeId: b.typeId, vars: b.vars.slice(), source });
        cls.bonuses.forEach(b => push(b, 'Класс'));
        for (const en of entries) {
          if (!allowed(en)) continue;
          for (const b of en.item.bonuses) if (b.activate == null || b.activate === en.active) push(b, en.item.name);
          // the weapon type's own bonus (standard range of bows, rifles…), not the item's
          for (const b of eqTypes.get(en.item.typeId).bonuses) push(b, 'Оружие: ' + eqTypes.get(en.item.typeId).name);
        }
        for (const en of entries) {
          if (!en.stampVariant || !allowed(en)) continue;
          stampBonuses(en.stampVariant, en.item).forEach(b => push(b, 'Печать: ' + stamps.get(en.stampVariant.stampId).name));
        }
        if (ch.enableElixir && ch.elixirId && elixirs.has(ch.elixirId)) elixirs.get(ch.elixirId).bonuses.forEach(b => push(b, 'Эликсир'));
        if (ch.enableConsumables) for (const id of ch.consumables || []) consumables.get(id)?.bonuses.forEach(b => push(b, consumables.get(id).name));
        if (ch.enableGuildTalents) for (const [idStr, pts] of Object.entries(ch.guildTalents || {})) {
          const gt = guildTalents.get(+idStr);
          if (gt && pts > 0) gt.bonuses(pts).forEach(b => push(b, 'Гильдия: ' + gt.name));
        }
        const chosenTalents = (ch.talents || []).map(id => talents.get(id)).filter(Boolean);
        if (ch.enableAura) {
          // own aura + auras of party members; the same aura doesn't stack: max per bonus type
          const list = [];
          if (ch.auraId && auras.has(ch.auraId)) list.push({ aura: auras.get(ch.auraId), bonuses: auraBonuses(auras.get(ch.auraId), false, ch.enableTalents ? chosenTalents.flatMap(t => t.bonuses) : []) });
          for (const [idStr, withTal] of Object.entries(ch.sharedAuras || {})) {
            const aura = auras.get(+idStr);
            if (aura && aura.inVersion) list.push({ aura, bonuses: auraBonuses(aura, true, withTal ? auraTalentBonuses.get(aura.id) : []) });
          }
          const merged = new Map();
          for (const { aura, bonuses } of list) for (const b of bonuses) {
            const key = aura.id + ':' + b.typeId, cur = merged.get(key);
            if (!cur) merged.set(key, { aura, b: { typeId: b.typeId, vars: b.vars.slice() } });
            else cur.b.vars = cur.b.vars.map((v, i) => Math.max(v, b.vars[i] ?? v));
          }
          for (const { aura, b } of merged.values()) push(b, 'Аура: ' + aura.name);
        }
        if (ch.enableBuffs) {
          for (const [idStr, stacks] of Object.entries(ch.buffs || {})) {
            const buff = buffs.get(+idStr); if (!buff || !stacks) continue;
            let list;
            if (buff.classId != null) {
              if (buff.talentId != null && (!ch.enableTalents || !(ch.talents || []).includes(buff.talentId))) continue;
              const cand = [...buff.bonuses.map(b => ({ b, p: 0 })), ...(ch.enableTalents ? chosenTalents.flatMap(t => t.bonuses).filter(b => b.buffId === buff.id).map(b => ({ b, p: 1 })) : [])];
              list = pickByPriority(cand);
            } else list = buff.bonuses;
            list.forEach(b => push({ typeId: b.typeId, vars: b.vars.map(v => v * stacks) }, 'Бафф: ' + buff.name));
          }
        }
        if (ch.enableTalents) for (const t of chosenTalents) for (const b of t.bonuses) if (b.auraId == null && b.buffId == null) push(b, 'Талант: ' + t.name);
        // cards: same card + same bonus type are merged for attack bonuses (identical cards add up)
        {
          const groups = new Map();
          for (const en of entries) {
            if (!allowed(en)) continue;
            for (const card of en.cards) {
              if (!card) continue;
              for (const cb of card.bonuses) {
                const vars = cardBonusVars(en, cb);
                if (!vars) continue;
                const k = card.id + ':' + cb.typeId;
                if (!groups.has(k)) groups.set(k, { typeId: cb.typeId, list: [] });
                groups.get(k).list.push({ typeId: cb.typeId, vars, source: 'Карта: ' + card.name });
              }
            }
          }
          for (const { typeId, list } of groups.values()) {
            const res = attackBonusTypes.has(typeId) ? groupByType(list, typeId) : list;
            res.forEach(b => push(b, b.source));
          }
        }
        if (ch.enableCollecting) for (const id of ch.collected || []) collected.get(id)?.bonuses.forEach(b => push(b, 'Коллекция'));
        return out;
      }
      function pickByPriority(cand) {
        const m = new Map();
        for (const c of cand) { const cur = m.get(c.b.typeId); if (!cur || c.p > cur.p) m.set(c.b.typeId, c); }
        return [...m.values()].map(c => c.b);
      }

      // --- evaluators ---
      const isEvaluated = ts => !ts.conditions.length || ts.conditions.some(c =>
        (c.Event_Id == null || c.Event_Id === ch.eventId) && (c.State_Id == null || c.State_Id === ch.stateId)
        && (c.Class_Id == null || isSubsetOf(ch.classId, c.Class_Id))
        && (c.EquipmentType_Id == null || entries.filter(en => en.item.typeId === c.EquipmentType_Id).length >= (c.PairEquipment ? 2 : 1))
        && (c.IsMaxLevel == null || !!c.IsMaxLevel === (ch.level === lastVersion.MaxLevel))
        && (c.LostControl == null || !!c.LostControl === !!ch.lostControl));
      const constEval = (priority, isMultiply, map, source) => ({ priority, isMultiply, map, source });
      const dynEval = (priority, fn) => ({ priority, fn });
      function constBonusEval(bonus) {
        const b = bonusVarsWithDynamic(bonus, ch);
        const t = bonusTypes.get(b.typeId);
        const map = new Map();
        for (const ts of t.stats) {
          if (!currentClassStats.has(ts.statId) || !isEvaluated(ts)) continue;
          const v = b.vars[ts.varIndex] ?? 0;
          if (v !== 0) map.set(ts.statId, v);
        }
        return constEval(bonusTypePriority.get(t.id) ?? 0, !!t.isMultiply, map, bonus.source);
      }
      function bonusEval(bonus) {
        const t = bonusTypes.get(bonus.typeId);
        const mv = t.variables.filter(v => v.multiplicityStatId != null).sort((a, b) => a.index - b.index);
        if (!mv.length) return constBonusEval(bonus);
        return dynEval(statPriority.get(mv[0].multiplicityStatId) + DYN_OFFSET, state => {
          const vars = bonus.vars.slice();
          for (const v of mv) {
            const step = dtrunc(bonus.vars[1] ?? 0);
            const count = step ? idiv(dtrunc(state.get(v.multiplicityStatId) ?? 0), step) : 0;
            const actual = v.multiplicityValue == null ? count : 1 + Math.min(1, count);
            vars[v.index] = dtrunc(bonus.vars[0] ?? 0) * actual;
          }
          for (let i = 0; i < vars.length; i++) if (vars[i] == null) vars[i] = 0;
          return [constBonusEval({ typeId: bonus.typeId, vars, source: bonus.source })];
        });
      }
      const statBonuses = (statId, value) => stats.get(statId).bonuses.filter(sb => isEnabledFormula(sb.formulaId)).map(sb => {
        const v = runFormula(sb.formulaId, { ch, custom: { 0: value } });
        return v !== 0 ? { typeId: sb.typeId, vars: [v], source: stats.get(statId).name } : null;
      }).filter(Boolean);

      const evaluators = [];
      if (!weaponInfo) evaluators.push(constEval(0, false, new Map([[ATTACK, 2]]), 'Без оружия'));
      evaluators.push(constEval(0, false, new Map([[HP, classLevelHp.get(cls.rootId)[ch.level] || 0]]), 'Уровень'));
      evaluators.push(constEval(0, false, new Map(editStatIds(ch.classId).map(id => [id, ch.stats[id] || 1])), 'Очки характеристик'));
      evaluators.push(constEval(0, false, new Map([...currentClassStats].map(id => [id, stats.get(id).defaultValue])), 'База'));
      evaluators.push(constEval(0, false, equipmentStats(), 'Снаряжение'));
      const allBonuses = getBonuses();
      const byType = new Map();
      for (const b of allBonuses) { if (!byType.has(b.typeId)) byType.set(b.typeId, []); byType.get(b.typeId).push(b); }
      for (const [typeId, list] of byType) {
        const t = bonusTypes.get(typeId);
        if (!t || t.isMultiply == null) continue;
        for (const b of t.isSingle ? list.slice(0, 1) : list) evaluators.push(bonusEval(b));
      }
      layers.forEach((layer, i) => {
        const set = new Set(layer);
        evaluators.push(dynEval(i * LAYER_STEP + DEP_OFFSET, state => [...state].filter(([id]) => set.has(id)).flatMap(([id, val]) => statBonuses(id, dtrunc(val)).map(constBonusEval))));
      });
      for (const sid of sourceStatIds) for (const fid of stats.get(sid).sources) {
        evaluators.push(dynEval(statPriority.get(sid) + SUM_OFFSET, state => [constEval(0, false, new Map([[sid, runFormula(fid, { ch, stats: state, weaponInfo })]]))]));
      }

      // --- run: priority groups ascending; inside a group sums first, then multipliers ---
      const priorities = [...new Set(evaluators.map(e => e.priority))].sort((a, b) => a - b);
      let state = new Map();
      for (const p of priorities) {
        const start = state;
        const consts = evaluators.filter(e => e.priority === p).flatMap(e => e.fn ? e.fn(start) : [e]);
        const sums = consts.filter(c => !c.isMultiply), muls = consts.filter(c => c.isMultiply);
        if (sums.length) {
          const next = new Map(state);
          for (const c of sums) for (const [k, v] of c.map) next.set(k, next.has(k) ? next.get(k) + v : v);
          state = next;
        }
        if (muls.length) {
          const next = new Map(state);
          for (const c of muls) for (const [k, v] of c.map) { const f = 1 + v / 100; next.set(k, next.has(k) ? next.get(k) * f : f); }
          for (const [k, v] of next) if (stats.get(k).isEditable) next.set(k, bankRound(v));
          state = next;
        }
      }

      // description values (e.g. defense -> % damage absorbed, crit rating -> real crit %)
      const descriptions = new Map();
      for (const [id, v] of state) {
        const s = stats.get(id);
        if (isEnabledFormula(s.descFormulaId)) descriptions.set(id, runFormula(s.descFormulaId, { ch, stats: state, weaponInfo, custom: { 0: v } }));
      }

      // per-item details for the UI
      const items = {};
      for (const en of entries) {
        items[en.key] = {
          upgrade: upgradeInfo(en),
          stamp: en.stampVariant ? stampBonuses(en.stampVariant, en.item) : [],
          dynamic: en.item.bonuses.filter(b => bonusTypes.get(b.typeId).hasDynamic).map(b => evaluateDynamicBonus(b, ch)),
          allowed: allowed(en),
        };
      }

      return { stats: state, descriptions, weaponInfo, bonuses: allBonuses, items };
    }

    return ctx;
  }

  return { createContext, bankRound, StatType };
});
