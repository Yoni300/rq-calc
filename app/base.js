'use strict';
/* «База»: a reference of the game built from facts only.
   - monsters: data/base-monsters.js (tools/update-base-wiki.mjs, the wiki's monster templates);
   - the world: data/base-world.js (tools/update-world-wiki.mjs) — locations with their map and markers, NPCs, quests,
     recipes, gathering points / ore veins / fishing spots;
   - the calculator's items, cards and stamps; loot (trophies, ores, consumables…) from data/market-items.js
     (tools/update-market-items.mjs; the name stayed from the removed Market tool).
   No article text, quest descriptions or dialogues are copied. Everything is linked: for any name the base knows where
   it comes from (monsters, gathering, vendors, quest rewards, recipes) and what it is needed for (recipes, quests).
   Uses globals from app.js / bosses.js at call time (h, T, ctx, ch, IMG, store, itemTip, locale, …). */

// loot catalog: id = wiki page id, icons in data/market-img
const MI_BY = new Map((window.RQ_MARKET_ITEMS || []).map(i => [i.id, i]));
const MI_IMG = id => `../data/market-img/${id}.png`;

const BASE_T = {
  uk: {
    title: 'База', sub: 'Монстри, локації з картами, НПС, завдання, рецепти, ресурси, предмети — і де що взяти',
    cats: { monster: 'Монстри', loc: 'Локації', npc: 'НПС', quest: 'Завдання', event: 'Івенти', recipe: 'Рецепти', res: 'Збір і рибалка', item: 'Спорядження', card: 'Карти', stamp: 'Печатки', good: 'Предмети', loot: 'Видобуток', thing: 'Предмет' },
    goods: { all: 'Усі', fx: 'Ефект', box: 'Вміст', more: 'Додатково', gift: 'У подарунку', where: 'Де', gets: 'Виходить', needs: 'Потрібно', mons: 'Монстри', given: 'Видає', feat: 'Особливості', make: 'Створення' },
    search: 'Пошук по всій базі…', empty: 'Нічого не знайдено', pick: 'Оберіть щось у списку ліворуч', back: 'Назад', more: 'Показано {n} з {all} — уточніть пошук',
    lvl: 'рів.', level: 'Рівень', hp: 'Життя', race: 'Раса', element: 'Стихія', defense: 'Захист', exp: 'Досвід', mode: 'Атака',
    aggro: 'Агресивний', yes: 'так', no: 'ні', event: 'Івент', group: 'Група', quest: 'Завдання', summoned: 'Призивається', type: 'Тип',
    boss: 'бос', elite: 'еліта', where: 'Де живе', resp: 'респаун', toTimer: 'У таймер',
    drops: { equip: 'Спорядження', cards: 'Карти', drop: 'Видобуток', cons: 'Розхідники', questDrop: 'Для завдань', recipes: 'Рецепти', summon: 'Призов' },
    src: { drop: 'Хто дропає', node: 'Збір', shop: 'Продають', quest: 'Нагорода за завдання', craft: 'Створюється за рецептом', box: 'Міститься в', given: 'Видає', event: 'Івент', edition: 'Видання гри', season: 'Сезонна пригода', other: 'Ще', station: 'Створюється на верстаті', from: 'Створюється з', start: 'Початкове спорядження класу', card: 'Шанс з карти (бонус карти)' },
    notes: { leaders: 'Падає з вожаків (будь-яких)' },
    use: { recipe: 'Потрібно для рецептів', quest: 'Потрібно для завдань', coll: 'Потрібно для колекцій', station: 'Компонент на верстаті', made: 'З цього роблять' },
    ev: { cat: 'Івенти', yearly: 'Проводиться регулярно', past: 'Більше не проводиться', status: 'Статус', usual: 'Зазвичай', last: 'Останній раз', since: 'Уведено', now: 'Іде зараз', left: 'ще {t}', soon: 'Почнеться {d}', how: 'Як це працює', history: 'Коли проводився', toCal: 'Календар', groups: { monsters: 'Монстри', npcs: 'НПС', locs: 'Локації', quests: 'Завдання', chains: 'Ланцюжки завдань', mounts: 'Вихованці та їздові', gear: 'Спорядження', cards: 'Карти', transmog: 'Преобразці', boxes: 'Коробки та скрині', cons: 'Витратні та їжа', trophies: 'Трофеї' } },
    whereGet: 'Де взяти', usedFor: 'Де потрібно', nobody: 'У вікі немає, звідки це береться',
    equip: 'Вдягнути в калькуляторі', equipped: 'Вдягнуто: {slot}', cantEquip: 'Не підходить поточному класу ({cls}) або рівню',
    slots: 'Куди ставиться', variants: 'Кольори печатки', monsters: 'Монстри', npc: 'Торговцю',
    everywhere: 'Це не окрема локація: так вікі позначає монстрів, які можуть з\x27явитися на будь-якій локації — івентових і мандрівних.', map: 'Карта', npcsHere: 'НПС', exits: 'Переходи', resHere: 'Ресурси', locType: 'Тип локації', levels: 'Рівні',
    gives: 'Дає завдання', takes: 'Приймає завдання', shop: 'Продає', price: 'Ціна', standsIn: 'Де стоїть',
    from: 'Видає', to: 'Здати', chain: 'Ланцюжок', prev: 'Перед цим', next: 'Далі', cls: 'Клас',
    task: 'Що зробити', kill: 'Убити', need: 'Принести', useIt: 'Використати', bring: 'Віднести', reward: 'Нагорода', choice: 'На вибір', gold: 'Золото',
    result: 'Результат', chance: 'Шанс', ingredients: 'Ресурси', recipeFrom: 'Де взяти рецепт',
    ct: { title: 'Дерево крафту', make: 'Зробити', pcs: 'шт.', chance: 'З урахуванням шансу', chanceTip: 'У середньому: скільки спроб і ресурсів піде, якщо частина крафтів не вдасться',
      fold: 'Згорнути: візьму цей предмет готовим', unfold: 'Розгорнути рецепт', recipe: 'рецепт', crafts: 'крафтів: {n}', tries: '≈ спроб: {n}', gives: 'вийде {n}',
      total: 'Усього зібрати', hint: '▾ згортає підрецепт — тоді предмет рахується як готовий',
      shop: 'НПС', node: 'Збір', drop: 'Дроп', quest: 'Завдання', box: 'З', event: 'Івент', craft: 'Можна скрафтити', none: 'невідомо, де взяти', fee: 'Обробка на верстатах',
      pricePer: 'Ціна за шт.', cost: 'Разом', pricePh: 'ціна', priceTip: 'Ваша ціна за 1 шт. — запам\x27ятовується для всіх рецептів', priceNpc: 'Порожньо — ціна НПС; впишіть свою, якщо купуєте в гравців',
      craftCost: 'Вартість крафту', priced: '(ціна є для {n} з {all} ресурсів)' },
    nodeKind: { gather: 'Точка збору', ore: 'Рудне родовище', fish: 'Рибне місце' }, bait: 'Наживка', yields: 'Що дає', locsOf: 'Де є',
    marks: { npc: 'НПС', shop: 'Торговець', exit: 'Перехід', fish: 'Рибалка', craft: 'Майстерня', post: 'Пошта', infanta: 'Інфанта' },
    questsN: 'завдань: {n}', sellsN: 'товарів: {n}', andMore: '…і ще {n}',
    src2: 'Факти з royalquest.info (вікі гри) і бази калькулятора — без описів і діалогів', wiki: 'Сторінка у вікі',
  },
  ru: {
    title: 'База', sub: 'Монстры, локации с картами, НПС, задания, рецепты, ресурсы, предметы — и где что взять',
    cats: { monster: 'Монстры', loc: 'Локации', npc: 'НПС', quest: 'Задания', event: 'Ивенты', recipe: 'Рецепты', res: 'Сбор и рыбалка', item: 'Снаряжение', card: 'Карты', stamp: 'Печати', good: 'Предметы', loot: 'Добыча', thing: 'Предмет' },
    goods: { all: 'Все', fx: 'Эффект', box: 'Содержимое', more: 'Дополнительно', gift: 'В подарке', where: 'Где', gets: 'Получается', needs: 'Требуется', mons: 'Монстры', given: 'Выдаёт', feat: 'Особенности', make: 'Создание' },
    search: 'Поиск по всей базе…', empty: 'Ничего не найдено', pick: 'Выберите что-нибудь в списке слева', back: 'Назад', more: 'Показано {n} из {all} — уточните поиск',
    lvl: 'ур.', level: 'Уровень', hp: 'Жизни', race: 'Раса', element: 'Стихия', defense: 'Защита', exp: 'Опыт', mode: 'Атака',
    aggro: 'Агрессивный', yes: 'да', no: 'нет', event: 'Ивент', group: 'Группа', quest: 'Задание', summoned: 'Призывается', type: 'Тип',
    boss: 'босс', elite: 'элита', where: 'Где живёт', resp: 'респаун', toTimer: 'В таймер',
    drops: { equip: 'Снаряжение', cards: 'Карты', drop: 'Добыча', cons: 'Расходники', questDrop: 'Для заданий', recipes: 'Рецепты', summon: 'Призыв' },
    src: { drop: 'Кто дропает', node: 'Сбор', shop: 'Продают', quest: 'Награда за задание', craft: 'Создаётся по рецепту', box: 'Содержится в', given: 'Выдаёт', event: 'Ивент', edition: 'Издание игры', season: 'Сезонное приключение', other: 'Ещё', station: 'Создаётся на станке', from: 'Создаётся из', start: 'Начальная экипировка класса', card: 'Шанс с карты (бонус карты)' },
    notes: { leaders: 'Падает с вожаков (любых)' },
    use: { recipe: 'Нужно для рецептов', quest: 'Нужно для заданий', coll: 'Нужно для коллекций', station: 'Компонент на станке', made: 'Из этого делают' },
    ev: { cat: 'Ивенты', yearly: 'Проводится регулярно', past: 'Больше не проводится', status: 'Статус', usual: 'Обычно', last: 'Последний раз', since: 'Введён', now: 'Идёт сейчас', left: 'ещё {t}', soon: 'Начнётся {d}', how: 'Как это работает', history: 'Когда проводился', toCal: 'Календарь', groups: { monsters: 'Монстры', npcs: 'НПС', locs: 'Локации', quests: 'Задания', chains: 'Цепочки заданий', mounts: 'Питомцы и ездовые', gear: 'Снаряжение', cards: 'Карты', transmog: 'Преобразцы', boxes: 'Коробки и сундуки', cons: 'Расходники и еда', trophies: 'Трофеи' } },
    whereGet: 'Где взять', usedFor: 'Где нужно', nobody: 'В вики нет, откуда это берётся',
    equip: 'Надеть в калькуляторе', equipped: 'Надето: {slot}', cantEquip: 'Не подходит текущему классу ({cls}) или уровню',
    slots: 'Куда ставится', variants: 'Цвета печати', monsters: 'Монстры', npc: 'Торговцу',
    everywhere: 'Это не отдельная локация: так вики помечает монстров, которые могут появиться на любой локации, — ивентовых и бродячих.', map: 'Карта', npcsHere: 'НПС', exits: 'Переходы', resHere: 'Ресурсы', locType: 'Тип локации', levels: 'Уровни',
    gives: 'Даёт задания', takes: 'Принимает задания', shop: 'Продаёт', price: 'Цена', standsIn: 'Где стоит',
    from: 'Выдаёт', to: 'Сдать', chain: 'Цепочка', prev: 'Перед этим', next: 'Дальше', cls: 'Класс',
    task: 'Что сделать', kill: 'Убить', need: 'Принести', useIt: 'Использовать', bring: 'Отнести', reward: 'Награда', choice: 'На выбор', gold: 'Золото',
    result: 'Результат', chance: 'Шанс', ingredients: 'Ресурсы', recipeFrom: 'Где взять рецепт',
    ct: { title: 'Дерево крафта', make: 'Сделать', pcs: 'шт.', chance: 'С учётом шанса', chanceTip: 'В среднем: сколько попыток и ресурсов уйдёт, если часть крафтов не удастся',
      fold: 'Свернуть: возьму этот предмет готовым', unfold: 'Развернуть рецепт', recipe: 'рецепт', crafts: 'крафтов: {n}', tries: '≈ попыток: {n}', gives: 'выйдет {n}',
      total: 'Всего собрать', hint: '▾ сворачивает подрецепт — тогда предмет считается готовым',
      shop: 'НПС', node: 'Сбор', drop: 'Дроп', quest: 'Задание', box: 'Из', event: 'Ивент', craft: 'Можно скрафтить', none: 'неизвестно, где взять', fee: 'Обработка на станках',
      pricePer: 'Цена за шт.', cost: 'Итого', pricePh: 'цена', priceTip: 'Ваша цена за 1 шт. — запоминается для всех рецептов', priceNpc: 'Пусто — цена НПС; впишите свою, если покупаете у игроков',
      craftCost: 'Стоимость крафта', priced: '(цена есть для {n} из {all} ресурсов)' },
    nodeKind: { gather: 'Точка сбора', ore: 'Рудное месторождение', fish: 'Рыбное место' }, bait: 'Наживка', yields: 'Что даёт', locsOf: 'Где есть',
    marks: { npc: 'НПС', shop: 'Торговец', exit: 'Переход', fish: 'Рыбалка', craft: 'Мастерская', post: 'Почта', infanta: 'Инфанта' },
    questsN: 'заданий: {n}', sellsN: 'товаров: {n}', andMore: '…и ещё {n}',
    src2: 'Факты с royalquest.info (вики игры) и из базы калькулятора — без описаний и диалогов', wiki: 'Страница в вики',
  },
  en: {
    title: 'Database', sub: 'Monsters, locations with maps, NPCs, quests, recipes, resources, items — and where to get what',
    cats: { monster: 'Monsters', loc: 'Locations', npc: 'NPCs', quest: 'Quests', event: 'Events', recipe: 'Recipes', res: 'Gathering & fishing', item: 'Gear', card: 'Cards', stamp: 'Stamps', good: 'Items', loot: 'Loot', thing: 'Item' },
    goods: { all: 'All', fx: 'Effect', box: 'Contents', more: 'Also', gift: 'In the gift', where: 'Where', gets: 'Gives', needs: 'Needs', mons: 'Monsters', given: 'Given by', feat: 'Features', make: 'Crafting' },
    search: 'Search the whole database…', empty: 'Nothing found', pick: 'Pick something in the list on the left', back: 'Back', more: 'Showing {n} of {all} — narrow the search',
    lvl: 'lvl', level: 'Level', hp: 'Health', race: 'Race', element: 'Element', defense: 'Defence', exp: 'Experience', mode: 'Attack',
    aggro: 'Aggressive', yes: 'yes', no: 'no', event: 'Event', group: 'Group', quest: 'Quest', summoned: 'Summoned by', type: 'Type',
    boss: 'boss', elite: 'elite', where: 'Lives in', resp: 'respawn', toTimer: 'To the timer',
    drops: { equip: 'Gear', cards: 'Cards', drop: 'Loot', cons: 'Consumables', questDrop: 'Quest items', recipes: 'Recipes', summon: 'Summons' },
    src: { drop: 'Dropped by', node: 'Gathering', shop: 'Sold by', quest: 'Quest reward', craft: 'Crafted by recipe', box: 'Found in', given: 'Given by', event: 'Event', edition: 'Game edition', season: 'Seasonal adventure', other: 'Also', station: 'Made on a station', from: 'Made from', start: 'Starting gear of', card: 'Chance from a card (card bonus)' },
    notes: { leaders: 'Drops from pack leaders (any)' },
    use: { recipe: 'Used in recipes', quest: 'Needed for quests', coll: 'Needed for collections', station: 'Station component', made: 'Made into' },
    ev: { cat: 'Events', yearly: 'Runs regularly', past: 'No longer runs', status: 'Status', usual: 'Usually', last: 'Last time', since: 'Added', now: 'Running now', left: '{t} left', soon: 'Starts {d}', how: 'How it works', history: 'When it ran', toCal: 'Calendar', groups: { monsters: 'Monsters', npcs: 'NPCs', locs: 'Locations', quests: 'Quests', chains: 'Quest chains', mounts: 'Pets and mounts', gear: 'Gear', cards: 'Cards', transmog: 'Transmogs', boxes: 'Boxes and chests', cons: 'Consumables and food', trophies: 'Trophies' } },
    whereGet: 'Where to get', usedFor: 'Used for', nobody: 'The wiki does not say where it comes from',
    equip: 'Put on in the calculator', equipped: 'Put on: {slot}', cantEquip: 'Not for the current class ({cls}) or level',
    slots: 'Goes into', variants: 'Stamp colours', monsters: 'Monsters', npc: 'To a vendor',
    everywhere: 'Not a real location: the wiki marks this way the monsters that can turn up on any location — event and wandering ones.', map: 'Map', npcsHere: 'NPCs', exits: 'Exits', resHere: 'Resources', locType: 'Location type', levels: 'Levels',
    gives: 'Gives quests', takes: 'Takes quests', shop: 'Sells', price: 'Price', standsIn: 'Stands in',
    from: 'Given by', to: 'Turn in to', chain: 'Chain', prev: 'Before', next: 'Next', cls: 'Class',
    task: 'To do', kill: 'Kill', need: 'Bring', useIt: 'Use', bring: 'Deliver to', reward: 'Reward', choice: 'Choice of', gold: 'Gold',
    result: 'Result', chance: 'Chance', ingredients: 'Resources', recipeFrom: 'Where to get the recipe',
    ct: { title: 'Crafting tree', make: 'Make', pcs: 'pcs', chance: 'Count the chance', chanceTip: 'On average: how many tries and resources it takes when some crafts fail',
      fold: 'Collapse: I\'ll get this item ready-made', unfold: 'Expand the recipe', recipe: 'recipe', crafts: '{n} crafts', tries: '≈ {n} tries', gives: 'makes {n}',
      total: 'Total to gather', hint: '▾ collapses a sub-recipe — the item then counts as ready-made',
      shop: 'NPC', node: 'Gathering', drop: 'Drop', quest: 'Quest', box: 'From', event: 'Event', craft: 'Can be crafted', none: 'source unknown', fee: 'Station fees',
      pricePer: 'Price each', cost: 'Total', pricePh: 'price', priceTip: 'Your price for 1 piece — remembered for every recipe', priceNpc: 'Empty — the NPC price; type your own if you buy from players',
      craftCost: 'Crafting cost', priced: '(priced: {n} of {all} resources)' },
    nodeKind: { gather: 'Gathering point', ore: 'Ore vein', fish: 'Fishing spot' }, bait: 'Bait', yields: 'Yields', locsOf: 'Found in',
    marks: { npc: 'NPC', shop: 'Vendor', exit: 'Exit', fish: 'Fishing', craft: 'Workshop', post: 'Post', infanta: 'Infanta' },
    questsN: 'quests: {n}', sellsN: 'goods: {n}', andMore: '…and {n} more',
    src2: 'Facts from royalquest.info (the game wiki) and the calculator\'s database — no descriptions or dialogues', wiki: 'Wiki page',
  },
};
const BTX = () => BASE_T[lang] || BASE_T.ru;
const bget2 = (k, def) => { try { const v = localStorage.getItem('rqc.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const BS = { cat: bget2('baseCat', 'monster'), q: '', sel: bget2('baseSel', null), back: [] };
const BCATS = ['monster', 'loc', 'npc', 'quest', 'event', 'recipe', 'res', 'item', 'good', 'card', 'stamp'];
BS.sub = bget2('baseSub', '');

// ---------- the index (built on first use) ----------
const bnorm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
// "Ледяная коса к.вд2сл", "Брюки ловца 1 слот", "Перчатки лучника 1СЛ", "Кинжал новичка ЭОГ" → the item itself
const bstrip = s => String(s || '').replace(/\s+\d+\s+слот(а|ов)?\s*$/i, '').replace(/\s*\d\s*сл\.?$/i, '').replace(/\s+к\.\s*\S+$/i, '').replace(/\s+Э[А-ЯЁ]{1,2}\d?$/, '').replace(/\s*\(Класс [A-ZА-Я]\)$/, '').trim();
let BX = null;
function baseIndex() {
  if (BX) return BX;
  const W = window.RQ_BASE_WORLD || { locs: [], npcs: [], quests: [], recipes: [], nodes: [] };
  const special = m => !!m.event || /Ивент|Квест|Призыва/i.test(m.group || '') || !(m.locs || []).length;
  const monsters = (window.RQ_BASE_MONSTERS || []).slice().sort((a, b) => special(a) - special(b) || (a.level ?? 999) - (b.level ?? 999) || a.name.localeCompare(b.name, 'ru'));
  const items = [...ctx.equipment.values()].filter(i => i.inVersion !== false);
  const cards = [...ctx.cards.values()].filter(c => c.inVersion !== false && !c.isLegacy);
  const stamps = [...ctx.stamps.values()].filter(s => !s.isLegacy);
  const loot = (window.RQ_MARKET_ITEMS || []).filter(i => i.cat !== 'card');
  const goods = window.RQ_BASE_GOODS || [];
  const byName = list => new Map(list.map(x => [bnorm(x.name), x]));
  const X = { W, monsters, items, cards, stamps, loot, npcs: W.npcs, recipes: W.recipes,
    // quests: the story ones by level first, event and level-1 ones at the end
    quests: W.quests.slice().sort((a, b) => (!!a.event || (a.level ?? 0) <= 1) - (!!b.event || (b.level ?? 0) <= 1) || (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name, 'ru')), nodes: W.nodes,
    itemBy: byName(items), cardBy: byName(cards), lootBy: byName(window.RQ_MARKET_ITEMS || []), monBy: byName(monsters),
    events: window.RQ_BASE_EVENTS || [], eventBy: byName(window.RQ_BASE_EVENTS || []),
    npcBy: byName(W.npcs), questBy: byName(W.quests), recipeBy: byName(W.recipes), nodeBy: byName(W.nodes) };

  // locations: the wiki's (map, markers) together with the ones the monsters name
  const locs = new Map();
  const loc = name => { if (!locs.has(name)) locs.set(name, { name, monsters: [], npcs: [], nodes: [] }); return locs.get(name); };
  for (const l of W.locs) Object.assign(loc(l.name), l);
  for (const m of monsters) for (const l of m.locs || []) loc(l.loc).monsters.push({ m, resp: l.resp });
  for (const n of W.npcs) for (const l of n.locs || []) loc(l).npcs.push(n);
  for (const n of W.nodes) for (const l of n.locs || []) loc(l).nodes.push(n);
  X.locs = [...locs.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  for (const l of X.locs) {
    l.monsters.sort((a, b) => (a.m.level ?? 999) - (b.m.level ?? 999));
    const lv = l.monsters.map(x => x.m.level).filter(v => v != null && v > 1);
    if (lv.length && l.name !== 'Все локации') { l.min = Math.min(...lv); l.max = Math.max(...lv); } // "everywhere" has no level range
  }
  X.locBy = new Map(X.locs.map(l => [l.name, l]));

  // where every name comes from, and what it is needed for
  const src = new Map(), use = new Map();
  const put = (map, name, kind, v) => { const k = bnorm(name); if (!k) return; if (!map.has(k)) map.set(k, {}); const o = map.get(k); (o[kind] ||= []).includes(v) || o[kind].push(v); };
  for (const m of monsters) {
    for (const x of m.equip || []) { put(src, bstrip(x), 'drop', m); put(src, 'Рецепт: ' + bstrip(x), 'drop', m); }
    for (const k of ['cards', 'drop', 'cons', 'questDrop', 'recipes']) for (const x of m[k] || []) put(src, x, 'drop', m);
  }
  for (const n of W.nodes) for (const d of n.drops || []) put(src, d.n, 'node', n);
  for (const n of W.npcs) for (const s of n.shop || []) put(src, s.n, 'shop', { npc: n, price: s.p });
  for (const q of W.quests) {
    for (const r of [...(q.reward || []), ...(q.choice || [])]) put(src, r.n, 'quest', q);
    for (const r of [...(q.need || []), ...(q.use || [])]) put(use, r.n, 'quest', q);
  }
  for (const r of W.recipes) {
    if (r.result) put(src, bstrip(r.result), 'craft', r);
    for (const x of r.res || []) put(use, x.n, 'recipe', r);
  }
  for (const g of goods) {
    for (const k of ['Дроп', 'ДопДроп', 'Подарок']) for (const x of (g.lists || {})[k] || []) put(src, x.n, 'box', g);
    for (const x of (g.lists || {})['Выдаёт'] || []) put(src, g.name, 'given', x.n);
  }
  X.goods = goods; X.goodBy = byName(goods);
  // market items the wiki item pages do not cover stay as «loot»
  X.lootOnly = loot.filter(i => !X.goodBy.has(bnorm(i.name)));
  X.src = src; X.use = use;
  X.questsFrom = new Map(); X.questsTo = new Map(); X.questsAfter = new Map();
  const add = (map, k, v) => { if (!k) return; if (!map.has(k)) map.set(k, []); map.get(k).push(v); };
  for (const q of W.quests) { add(X.questsFrom, q.from, q); if (q.to && q.to !== q.from) add(X.questsTo, q.to, q); for (const p of q.prev || []) add(X.questsAfter, bnorm(p), q); }
  BX = X;
  return X;
}
const srcCache = new Map();
const eqv = (a, b) => a === b;
let WSN = null;
const wikiSrc = name => {
  if (!WSN) { WSN = new Map(); for (const [k, v] of Object.entries(window.RQ_BASE_SOURCES || {})) { const n = bnorm(k); WSN.set(n, [...(WSN.get(n) || []), ...v]); } }
  const a = bnorm(name), b = bnorm(bstrip(name));
  return [...(WSN.get(a) || []), ...(b !== a ? WSN.get(b) || [] : [])];
};
// name → a kind of source from BTX().notes (the wiki page says «Выпадают из вожаков» and names no monsters)
const SRC_NOTES = { 'осколок хрустальной реки': 'leaders' };
function sourcesOf(name) {
  const ck = bnorm(name);
  if (srcCache.has(ck)) return srcCache.get(ck);
  const X = baseIndex();
  const own = X.src.get(bnorm(bstrip(name))) || X.src.get(bnorm(name)) || {};
  const out = {};
  for (const [k, v] of Object.entries(own)) out[k] = v.slice();
  const add = (k, v, same = eqv) => { const l = (out[k] ||= []); if (!l.some(x => same(x, v))) l.push(v); };
  for (const [src, how, kind] of wikiSrc(name)) {
    if (kind === 'k') continue; // a collection needs the item
    if (kind === 'z') { add('card', src); continue; } // a card whose bonus gives a chance at the item
    const page = src.replace(/^Монстр\s+/, '').replace(/^Задание\s*[—-]\s*/, '');
    const g = X.goodBy.get(bnorm(src)), n = X.nodeBy.get(bnorm(src.replace(/\s*\(ресурс\)$/, '')));
    if (how === 'd' && kind === 'm') { const m = X.monBy.get(bnorm(page)); m ? add('drop', m) : add('other', src); }
    else if (how === 'd' && kind === 'e') add('event', src);
    else if ((how === 'b' || how === 'g') && g) add('box', g);
    else if ((how === 'b' && kind === 'x') || how === 'f' || n) n ? add('node', n) : add('other', src);
    else if (how === 'g' && kind === 'i') add('edition', src);
    else if (how === 's') { const p = X.npcBy.get(bnorm(src)); p ? add('shop', { npc: p, price: (p.shop || []).find(x => bnorm(x.n) === bnorm(name))?.p || '' }, (a, b) => a.npc === b.npc) : add('other', src); }
    else if (how === 'q' && kind === 'p') add('season', src.replace(/^Сезонное приключение\s*[—-]\s*/, ''));
    else if (how === 'q') { const q = X.questBy.get(bnorm(page)); q ? add('quest', q) : add('other', src); }
    else if (how === 'r') { const r = X.recipeBy.get(bnorm(src)); r ? add('craft', r) : add('other', src); }
    else if (how === 'w') add('station', src);
    else if (how === 'c') add('from', src);
    else if (how === 't') add('start', src);
    else if (how === 'u' || how === 'v') continue; // uses, see usesOf
    else add('other', src);
  }
  // nothing else known: an event item at least comes from its event
  if (!Object.keys(out).length) {
    const g = X.goodBy.get(bnorm(name)), ev = g && g.f && g.f['Ивент'];
    if (ev) add('event', ev);
    else for (const e of X.events) if (Object.values(e).some(v => Array.isArray(v) && v.includes(name))) { add('event', e.name); break; }
  }
  // a source the wiki only states in a note, with no list of monsters
  if (!Object.keys(out).length && SRC_NOTES[bnorm(name)]) add('note', SRC_NOTES[bnorm(name)]);
  srcCache.set(ck, out);
  return out;
}
function usesOf(name) {
  const out = Object.assign({}, baseIndex().use.get(bnorm(name)) || {});
  const coll = wikiSrc(name).filter(x => x[2] === 'k').map(x => x[0]);
  if (coll.length) out.coll = [...new Set(coll)];
  const w = wikiSrc(name);
  const st = w.filter(x => x[1] === 'u').map(x => x[0]); if (st.length) out.station = [...new Set(st)];
  const mk = w.filter(x => x[1] === 'v').map(x => x[0]); if (mk.length) out.made = [...new Set(mk)];
  return out;
}

const hideImg = e => { e.target.style.visibility = 'hidden'; };
// ---------- entries: { kind, key, name, icon, round, meta } ----------
const ph = kind => ({ loc: 'globe', npc: 'group', quest: 'book', recipe: 'calc', res: 'globe', event: 'calendar' }[kind] || 'book');
function iconOfName(name) {
  const X = baseIndex(), k = bnorm(bstrip(name));
  const it = X.itemBy.get(k); if (it) return IMG(it.imageId);
  const c = X.cardBy.get(bnorm(name)); if (c) return IMG(c.imageId);
  const l = X.lootBy.get(bnorm(name)); if (l) return MI_IMG(l.id);
  const W = window.RQ_BASE_ICONS || {};
  const f = W[name] || W[bstrip(name)];
  return f ? `../data/icons/${f}` : null;
}
function entryOf(kind, x) {
  const t = BTX();
  switch (kind) {
    case 'monster': return { kind, key: x.name, name: x.name, icon: x.img ? `../data/monsters/${x.img}` : null, round: true,
      meta: [x.level != null ? `${t.lvl} ${x.level}` : '', x.race, /босс/i.test(x.type || '') ? t.boss : /элит/i.test(x.type || '') ? t.elite : ''].filter(Boolean).join(' · ') };
    case 'item': return { kind, key: x.id, name: x.name, icon: IMG(x.imageId), meta: `${ctx.eqTypes.get(x.typeId)?.name || ''} · ${t.lvl} ${x.level}` };
    case 'card': return { kind, key: x.id, name: x.name, icon: IMG(x.imageId), meta: cardTypeLabel(x) };
    case 'stamp': return { kind, key: x.id, name: `${T.stampWord} ${x.name}`, icon: IMG(x.variants[x.variants.length - 1]?.color?.Image_Id), meta: `${x.variants.length} · ${t.variants.toLowerCase()}` };
    case 'loc': return { kind, key: x.name, name: x.name, icon: x.map ? `../data/maps/${x.map}` : null, cover: true, meta: [(x.type || [])[0], x.min != null ? `${t.lvl} ${x.min === x.max ? x.min : `${x.min}–${x.max}`}` : ''].filter(Boolean).join(' · ') };
    case 'loot': return { kind, key: x.id, name: x.name, icon: MI_IMG(x.id), meta: x.type || '' };
    case 'npc': return { kind, key: x.name, name: x.name, icon: x.img ? `../data/npcs/${x.img}` : null, round: true,
      meta: [(x.locs || [])[0], (baseIndex().questsFrom.get(x.name) || []).length ? fmtT(t.questsN, { n: baseIndex().questsFrom.get(x.name).length }) : '', (x.shop || []).length ? fmtT(t.sellsN, { n: x.shop.length }) : ''].filter(Boolean).join(' · ') };
    case 'quest': return { kind, key: x.name, name: x.name, icon: (n => n && n.img ? `../data/npcs/${n.img}` : null)(baseIndex().npcBy.get(bnorm(x.from))), round: true, meta: [x.level != null ? `${t.lvl} ${x.level}` : '', x.from, x.type].filter(Boolean).join(' · ') };
    case 'recipe': return { kind, key: x.name, name: x.name.replace(/^Рецепт:\s*/, ''), icon: iconOfName(x.result), meta: [`${t.chance} ${x.chance ?? '?'}%`, `${(x.res || []).length} ${t.ingredients.toLowerCase()}`].join(' · ') };
    case 'res': return { kind, key: x.name, name: x.name, icon: (x.drops || []).map(d => iconOfName(d.n)).find(Boolean) || null, meta: [t.nodeKind[x.kind], (x.locs || []).length ? `${t.locsOf.toLowerCase()}: ${x.locs.length}` : ''].filter(Boolean).join(' · ') };
    case 'good': return { kind, key: x.name, name: x.name, icon: iconOfName(x.name), meta: [(x.f || {})['Тип'] || x.cat, (x.f || {})['МинУровень'] ? `${t.lvl} ${x.f['МинУровень']}+` : '', (x.f || {})['Ивент']].filter(Boolean).join(' · ') };
    case 'thing': return { kind, key: x, name: x, icon: iconOfName(x), meta: '' };
    case 'event': return { kind, key: x.name, name: x.name, icon: x.img ? `../data/events/${x.img}` : null, cover: true,
      meta: [x.running ? evMonths(x) : t.ev.past, x.dates[0] ? x.dates[0].to.slice(0, 4) : ''].filter(Boolean).join(' · ') };
  }
  return null;
}
const entryCache = new Map();
function entriesOf(kind) {
  const ck = kind + ':' + lang;
  if (entryCache.has(ck)) return entryCache.get(ck);
  const X = baseIndex();
  const src = { event: X.events, monster: X.monsters, item: X.items, card: X.cards, stamp: X.stamps, loc: X.locs, loot: X.loot, good: X.goods, npc: X.npcs, quest: X.quests, recipe: X.recipes, res: X.nodes }[kind] || [];
  const list = src.map(x => entryOf(kind, x));
  if (kind === 'good') list.push(...X.lootOnly.map(x => entryOf('loot', x)));
  entryCache.set(ck, list);
  return list;
}
function findEntry(kind, key) {
  const X = baseIndex();
  const pick = (x) => x && { e: entryOf(kind, x), x };
  switch (kind) {
    case 'monster': return pick(X.monBy.get(bnorm(key)));
    case 'item': return pick(ctx.equipment.get(key));
    case 'card': return pick(ctx.cards.get(key));
    case 'stamp': return pick(ctx.stamps.get(key));
    case 'loc': return pick(X.locBy.get(key));
    case 'loot': return pick(MI_BY.get(key));
    case 'good': return pick(X.goodBy.get(bnorm(key)));
    case 'npc': return pick(X.npcBy.get(bnorm(key)));
    case 'quest': return pick(X.questBy.get(bnorm(key)));
    case 'recipe': return pick(X.recipeBy.get(bnorm(key)));
    case 'res': return pick(X.nodeBy.get(bnorm(key)));
    case 'thing': return { e: entryOf('thing', key), x: key };
    case 'event': return pick(X.eventBy.get(bnorm(key)));
  }
  return null;
}
// any name → the entry it opens, or null (an item, a card, loot, a recipe, an NPC, a monster, a location, or a «thing»
// the base knows sources or uses of)
function linkOfName(name) {
  const X = baseIndex(), k = bnorm(bstrip(name)), n = bnorm(name);
  const it = X.itemBy.get(k); if (it) return { kind: 'item', key: it.id };
  const c = X.cardBy.get(n); if (c) return { kind: 'card', key: c.id };
  if (X.recipeBy.has(n)) return { kind: 'recipe', key: X.recipeBy.get(n).name };
  if (X.goodBy.has(n)) return { kind: 'good', key: X.goodBy.get(n).name };
  const l = X.lootBy.get(n); if (l && l.cat !== 'card') return { kind: 'loot', key: l.id };
  if (X.eventBy.has(n)) return { kind: 'event', key: X.eventBy.get(n).name };
  if (X.npcBy.has(n)) return { kind: 'npc', key: X.npcBy.get(n).name };
  if (X.monBy.has(n)) return { kind: 'monster', key: X.monBy.get(n).name };
  if (X.locBy.has(name)) return { kind: 'loc', key: name };
  if (X.nodeBy.has(n)) return { kind: 'res', key: X.nodeBy.get(n).name };
  if (X.src.has(k) || X.src.has(n) || X.use.has(n)) return { kind: 'thing', key: name };
  return null;
}

// ---------- the view ----------
function openBase(kind, key, { push = true } = {}) {
  if (push && BS.sel && !(BS.sel.kind === kind && BS.sel.key === key)) BS.back.push(BS.sel);
  BS.sel = { kind, key };
  store.set('baseSel', BS.sel);
  if (tab !== 'base') { switchTool('base'); return; }
  markBaseList();
  drawBaseDetail();
}
// only move the highlight in the list: rebuilding its 300 rows makes every icon load again and the page blink
function markBaseList() {
  const el = document.getElementById('baseList');
  if (!el) return;
  for (const r of el.children) if (r._bs) r.classList.toggle('on', !!BS.sel && BS.sel.kind === r._bs.kind && BS.sel.key === r._bs.key);
}

function renderBase(el) {
  const t = BTX();
  const search = h('input', { class: 'inp', placeholder: t.search, value: BS.q, spellcheck: false });
  search.addEventListener('input', () => { BS.q = search.value; drawBaseList(); });
  el.append(h('div', { class: 'bs-wrap' },
    h('div', { class: 'bs-side' },
      h('div', { class: 'bs-cats' }, BCATS.map(c => h('button', { class: 'bs-cat' + (BS.cat === c && !BS.q.trim() ? ' on' : ''), onclick: () => { BS.cat = c; BS.q = ''; store.set('baseCat', c); renderCenter(); } }, t.cats[c]))),
      BS.cat === 'good' && !BS.q.trim() ? goodsFilter() : null,
      search,
      h('div', { class: 'bs-list', id: 'baseList' })),
    h('div', { class: 'bs-detail', id: 'baseDetail' })));
  drawBaseList();
  drawBaseDetail();
  if (!BS.q) search.focus({ preventScroll: true });
}

function baseRow(e, showCat, onclick) {
  const on = BS.sel && BS.sel.kind === e.kind && BS.sel.key === e.key;
  const row = h('div', { class: 'bs-row' + (on ? ' on' : ''), onclick: onclick || (() => openBase(e.kind, e.key, { push: false })) },
    e.icon ? h('img', { class: 'bs-ic' + (e.round ? ' round' : '') + (e.cover ? ' cover' : ''), src: e.icon, loading: 'lazy', decoding: 'sync', draggable: 'false', onerror: hideImg }) : h('span', { class: 'bs-ic ph' }, iconEl(ph(e.kind))),
    h('div', { class: 'bs-name' }, e.name, h('small', null, (showCat ? BTX().cats[e.kind] + ' · ' : '') + (e.meta || ''))));
  row._bs = e;
  return row;
}

function drawBaseList() {
  const el = document.getElementById('baseList');
  if (!el) return;
  const t = BTX();
  el.innerHTML = '';
  const q = BS.q.trim();
  let list = q ? BCATS.flatMap(c => entriesOf(c)).filter(e => matches(q, e.name)) : entriesOf(BS.cat);
  if (!q && BS.cat === 'good' && BS.sub) list = list.filter(e => e.kind === 'good' && (baseIndex().goodBy.get(bnorm(e.key)) || {}).cat === BS.sub);
  if (!list.length) { el.append(h('div', { class: 'bs-empty' }, t.empty)); return; }
  const N = 300;
  for (const e of list.slice(0, N)) el.append(baseRow(e, !!q));
  if (list.length > N) el.append(h('div', { class: 'bs-empty' }, fmtT(t.more, { n: N, all: list.length })));
}

// ---------- pieces of a page ----------
const bsec = (title, ...kids) => h('div', { class: 'bs-sec' }, h('h4', null, title), kids);
const bfacts = rows => h('div', { class: 'bs-facts' }, rows.filter(([, v]) => v != null && v !== '').map(([k, v]) => h('div', null, h('span', null, k), h('b', null, v instanceof Node ? v : String(v)))));
// "Цветущий лук 2 слота", "Перчатки лучника 1СЛ" → the name and that many card-slot icons, like in the game
const slotsOf = s => {
  const m = String(s || '').match(/^(.*?)\s+(\d)\s+слот(?:а|ов)?\s*$/i) || String(s || '').match(/^(.*?\S)\s*(\d)\s*сл\.?$/i);
  return m && +m[2] > 0 ? { name: m[1].trim(), n: +m[2] } : null;
};
const slotIcons = n => h('span', { class: 'bs-slots', title: n + ' ' + (n === 1 ? 'слот' : n < 5 ? 'слота' : 'слотов') }, Array.from({ length: n }, () => h('i', { class: 'tt-empty-card' })));
function bchip(name, link, { count, extra, icon } = {}) {
  if (link === undefined) link = linkOfName(name);
  const f = link && findEntry(link.kind, link.key);
  const ic = icon || (f && f.e.icon);
  const sl = typeof name === 'string' ? slotsOf(name) : null;
  return h(link ? 'button' : 'span', { class: 'bs-chip' + (link ? ' link' : ''), onclick: link ? () => openBase(link.kind, link.key) : null },
    ic ? h('img', { src: ic, decoding: 'sync', draggable: 'false', class: f && f.e.round ? 'round' : '', onerror: hideImg }) : null,
    sl ? sl.name : name, sl ? slotIcons(sl.n) : null,
    count && count > 1 ? h('b', { class: 'bs-n' }, '×' + fmtNum(count)) : null, extra ? h('small', null, extra) : null);
}
const chips = (list, fn) => h('div', { class: 'bs-chips' }, list.map(fn));
const mchip = m => bchip(`${m.name}${m.level != null ? ` · ${BTX().lvl} ${m.level}` : ''}`, { kind: 'monster', key: m.name });
const qchip = q => bchip(`${q.name}${q.level != null ? ` · ${BTX().lvl} ${q.level}` : ''}`, { kind: 'quest', key: q.name });
const fmtMin = min => { const hh = Math.floor(min / 60), mm = min % 60; return (hh ? `${hh} ${T.hShort} ` : '') + (mm || !hh ? `${mm} ${T.mShort}` : ''); };
const wikiLink = title => h('a', { class: 'bs-wiki', href: `https://royalquest.info/ru/${encodeURIComponent(title.replace(/ /g, '_'))}`, target: '_blank', rel: 'noopener' }, BTX().wiki + ' ↗');

// ---------- «Дерево крафта»: a recipe with its sub-recipes for N pieces, and the total of what to gather ----------
// State of the open recipe: how many to make, collapsed sub-recipes (taken ready-made), the chosen recipe where there are several.
// Station recipes (data/base-stations.js) join in as recipes with a fee. A conversion for runes (Элениумный преобразователь)
// is only an alternative and stays folded until opened — otherwise an ore you dig would turn into a cheaper ore.
const CRAFT = { key: null, qty: 1, chance: bget2('craftChance', false), off: new Set(), on: new Set(), pick: new Map(), prices: bget2('craftPrices', {}) || {} };
const feeOf = r => { const m = String(r.fee || '').trim().match(/^(\d+)\s*(\S*)$/); return m ? { n: +m[1], cur: m[2] } : null; };
const stationRecipes = () => (window.RQ_BASE_STATIONS || []).flatMap(st => st.items.map(it => ({
  name: `${st.name}: ${it.n}`, result: it.n, count: 1, chance: 100, res: it.res, station: st.name, fee: it.price, conv: !/^\d+$/.test(String(it.price).trim()) })));
let RBY = null;
// result name → the recipes that make it: the plain recipe, «(Очистка)», a station for gold, a conversion for runes
function recipesFor(name) {
  if (!RBY) {
    RBY = new Map();
    for (const r of [...baseIndex().recipes, ...stationRecipes()]) if (r.result) { const k = bnorm(bstrip(r.result)); if (!RBY.has(k)) RBY.set(k, []); RBY.get(k).push(r); }
    const rank = r => r.conv ? 3 : r.station ? 2 : /\(Очистка\)/.test(r.name) ? 1 : 0;
    for (const l of RBY.values()) l.sort((a, b) => rank(a) - rank(b));
  }
  return RBY.get(bnorm(bstrip(name))) || [];
}
// the station recipes that make a name / that take it as a component
const stationMaking = name => recipesFor(name).filter(r => r.station);
const stationUsing = name => stationRecipes().filter(r => r.res.some(x => bnorm(x.n) === bnorm(name)));
// one node: need = pieces wanted; a craftable node holds its recipe, the number of crafts and its ingredients
function craftNode(name, need, path, seen, recipe) {
  const alts = recipe ? [recipe] : recipesFor(name).filter(r => !seen.has(bnorm(r.name)));
  const node = { name, need, path, craftable: alts.length > 0 };
  if (!alts.length) return node;
  const ri = Math.min(CRAFT.pick.get(path) || 0, alts.length - 1), r = alts[ri];
  if (!recipe && (CRAFT.off.has(path) || (r.conv && !CRAFT.on.has(path)))) return node;
  const per = r.count || 1, crafts = Math.ceil(need / per - 1e-9);
  // with the chance: the average number of tries (not rounded — only the resource counts are rounded up)
  const tries = CRAFT.chance && r.chance && r.chance < 100 ? crafts * 100 / r.chance : crafts;
  const s2 = new Set(seen).add(bnorm(r.name));
  Object.assign(node, { recipe: r, alts: recipe ? [] : alts, crafts, tries, made: crafts * per,
    kids: (r.res || []).map((x, i) => craftNode(x.n, (x.c || 1) * tries, `${path}>${ri}.${i}`, s2)) });
  return node;
}
// a short «where to get it» for a resource; the cheapest NPC price in gold when someone sells it
function craftHint(name, craftable) {
  // every way to get it, one part per kind: «Збір: X; Дроп: Y · рів. 60 +2; Карта: Z» (the whole list in the tooltip)
  const c = BTX().ct, s = sourcesOf(name), parts = [];
  const more = l => l.length > 1 ? ` +${l.length - 1}` : '';
  let gold = null;
  if (s.shop) {
    const best = s.shop.map(x => ({ x, p: goldNum(x.price) })).sort((a, b) => (a.p ?? Infinity) - (b.p ?? Infinity))[0];
    gold = best.p; parts.push(`${c.shop}: ${best.x.npc.name}${more(s.shop)}`);
  }
  if (s.node) parts.push(`${c.node}: ${s.node[0].name}${more(s.node)}`);
  if (s.note) parts.push(BTX().notes[s.note[0]] || s.note[0]);
  if (s.drop) { const m = s.drop.slice().sort((a, b) => (a.level ?? 999) - (b.level ?? 999))[0]; parts.push(`${c.drop}: ${m.name}${m.level != null ? ` · ${BTX().lvl} ${m.level}` : ''}${more(s.drop)}`); }
  if (s.card) parts.push(`${s.card[0]}${more(s.card)}`); // the name already says «Карта …»
  if (s.quest) parts.push(`${c.quest}: ${s.quest[0].name}${more(s.quest)}`);
  if (s.box) parts.push(`${c.box}: ${s.box[0].name}${more(s.box)}`);
  if (s.event) parts.push(`${c.event}: ${s.event[0]}`);
  if (!parts.length && craftable) parts.push(c.craft);
  if (!parts.length) for (const k of ['given', 'season', 'station', 'from', 'other']) if (s[k]) { parts.push(String(s[k][0])); break; }
  if (!parts.length) return { text: c.none, none: true };
  return { text: parts.join('; '), gold };
}
function craftBlock(x) {
  const t = BTX(), c = t.ct;
  if (CRAFT.key !== x.name) Object.assign(CRAFT, { key: x.name, qty: x.count || 1, off: new Set(), on: new Set(), pick: new Map() });
  const body = h('div');
  const qty = h('input', { class: 'inp ct-qty', type: 'number', min: 1, max: 99999, value: CRAFT.qty });
  const setQty = v => { CRAFT.qty = clamp(Math.round(+v) || 1, 1, 99999); qty.value = CRAFT.qty; draw(); };
  qty.addEventListener('input', () => { if (+qty.value >= 1) { CRAFT.qty = Math.min(Math.round(+qty.value), 99999); draw(); } });
  qty.addEventListener('change', () => setQty(qty.value));
  const step = d => h('button', { class: 'btn small ghost ct-step', onclick: () => setQty(CRAFT.qty + d * (x.count || 1)) }, d > 0 ? '+' : '−');
  const chk = h('label', { class: 'check ct-chance', title: c.chanceTip }, h('input', { type: 'checkbox', checked: CRAFT.chance,
    onchange: e => { CRAFT.chance = e.target.checked; store.set('craftChance', CRAFT.chance); draw(); } }), c.chance);
  function draw() {
    const root = craftNode(x.result || x.name, CRAFT.qty, 'r', new Set(), x);
    const rows = [], tot = new Map(), fees = new Map();
    let unsure = false, foldable = false;
    const walk = (n, d) => {
      if (n.recipe && n.recipe.chance != null && n.recipe.chance < 100) unsure = true;
      if (d > 0 && n.craftable) foldable = true;
      const tog = d === 0 ? null : n.recipe
        ? h('button', { class: 'ct-tog', title: c.fold, onclick: () => { CRAFT.off.add(n.path); CRAFT.on.delete(n.path); draw(); } }, '▾')
        : n.craftable ? h('button', { class: 'ct-tog off', title: c.unfold, onclick: () => { CRAFT.off.delete(n.path); CRAFT.on.add(n.path); draw(); } }, '▸') : h('span', { class: 'ct-tog none' });
      let info;
      if (n.recipe) {
        const st = n.recipe.station, fee = feeOf(n.recipe);
        const bits = [st || `${c.recipe} ${n.recipe.chance ?? '?'}%`, fmtT(c.crafts, { n: fmtNum(n.crafts) })];
        if (n.tries !== n.crafts) bits.push(fmtT(c.tries, { n: fmtNum(n.tries, n.tries % 1 ? 1 : 0) }));
        if (n.made !== Math.ceil(n.need - 1e-9)) bits.push(fmtT(c.gives, { n: fmtNum(n.made) }));
        if (fee) fees.set(fee.cur, (fees.get(fee.cur) || 0) + fee.n * n.crafts);
        info = h('span', { class: 'ct-info' },
          d === 0 || st ? h('small', null, bits.join(' · ')) : h('button', { class: 'ct-rlink', onclick: () => openBase('recipe', n.recipe.name) }, bits.join(' · ')),
          fee ? h('span', { class: 'bs-price' }, priceEl(fee.cur ? `${fee.n * n.crafts} ${fee.cur}` : fee.n * n.crafts)) : null,
          n.alts.length > 1 ? h('select', { class: 'inp ct-alt', onchange: e => { CRAFT.pick.set(n.path, +e.target.value); draw(); } },
            n.alts.map((r, i) => h('option', { value: i, selected: r === n.recipe }, r.station ? `${r.station} · ${r.fee}` : r.name.replace(/^Рецепт:\s*/, '')))) : null);
      } else {
        const hn = craftHint(n.name, n.craftable);
        const k = bnorm(n.name);
        const o = tot.get(k) || { name: n.name, n: 0, hint: hn };
        o.n += n.need; tot.set(k, o);
        info = h('small', { class: 'ct-info' + (hn.none ? ' none' : ''), title: hn.text }, hn.text);
      }
      rows.push(h('div', { class: 'ct-row' + (d === 0 ? ' root' : ''), style: `--d:${d}` }, tog, bchip(n.name, undefined, { count: d === 0 ? n.made : Math.ceil(n.need - 1e-9) }), info));
      for (const k of n.kids || []) walk(k, d + 1);
    };
    walk(root, 0);
    chk.style.display = unsure ? '' : 'none';
    const list = [...tot.values()].sort((a, b) => b.n - a.n);
    for (const o of list) o.n = Math.ceil(o.n - 1e-9);
    // a price per piece for every resource: the player's own (remembered for every recipe) or else the NPC price;
    // typing only refreshes the sums, so the field keeps its focus
    const priceOf = o => { const v = CRAFT.prices[bnorm(o.name)]; return v != null ? v : o.hint.gold ?? null; };
    const lineEls = new Map();
    const sumEl = h('span', { class: 'bs-price' }), sumNote = h('small');
    const goldFee = fees.get('') || 0;
    const recount = () => {
      let sum = goldFee, priced = 0;
      for (const o of list) {
        const p = priceOf(o), el = lineEls.get(o);
        el.replaceChildren(p != null ? priceEl(p * o.n) : '');
        if (p != null) { sum += p * o.n; priced++; }
      }
      sumEl.replaceChildren(priceEl(sum));
      sumNote.textContent = priced < list.length ? ' ' + fmtT(c.priced, { n: priced, all: list.length }) : '';
    };
    const priceInput = o => {
      const own = CRAFT.prices[bnorm(o.name)];
      const inp = h('input', { class: 'inp ct-price', type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: own ?? '',
        placeholder: o.hint.gold != null ? fmtNum(o.hint.gold) : c.pricePh, title: o.hint.gold != null ? c.priceNpc : c.priceTip });
      inp.addEventListener('input', () => {
        const v = inp.value.trim() === '' ? null : +inp.value;
        if (v == null || !isFinite(v) || v < 0) delete CRAFT.prices[bnorm(o.name)]; else CRAFT.prices[bnorm(o.name)] = v;
        store.set('craftPrices', CRAFT.prices);
        recount();
      });
      return inp;
    };
    body.replaceChildren(
      h('div', { class: 'ct-tree' }, rows),
      foldable ? h('div', { class: 'hint ct-note' }, c.hint) : null,
      bsec(c.total, h('div', { class: 'ct-tot' },
        h('div', { class: 'ct-tot-h' }, h('span'), h('span'), h('span'), h('span', null, c.pricePer), h('span', null, c.cost)),
        list.map(o => { const line = h('span', { class: 'bs-price ct-line' }); lineEls.set(o, line); return h('div', null,
          bchip(o.name), h('b', { class: 'ct-n' }, '×' + fmtNum(o.n)),
          h('small', { class: o.hint.none ? 'none' : '', title: o.hint.text }, o.hint.text),
          priceInput(o), line); }))),
      goldFee ? h('div', { class: 'ct-sum' }, h('span', null, c.fee), h('span', { class: 'bs-price' }, priceEl(goldFee))) : null,
      [...fees].filter(([cur]) => cur).map(([cur, v]) => h('div', { class: 'ct-sum' }, h('span', null, c.fee), h('span', { class: 'bs-price' }, priceEl(`${v} ${cur}`)))),
      h('div', { class: 'ct-sum ct-total' }, h('span', null, c.craftCost, sumNote), sumEl));
    recount();
  }
  draw();
  return h('div', { class: 'bs-group ct' },
    h('div', { class: 'ct-head' }, h('h3', null, c.title),
      h('div', { class: 'ct-ctl' }, h('span', null, c.make), step(-1), qty, step(1), h('span', null, c.pcs), chk)),
    body);
}

/** «Где взять» and «Где нужно» for any name. */
function whereBlocks(name) {
  const t = BTX(), s = sourcesOf(name), u = usesOf(name);
  const out = [];
  const parts = [];
  if (s.drop) parts.push(bsec(t.src.drop, chips(s.drop.slice().sort((a, b) => (a.level ?? 999) - (b.level ?? 999)), mchip)));
  if (s.note) parts.push(bsec(t.src.drop, chips(s.note, k => bchip(t.notes[k] || k, null))));
  if (s.card) parts.push(bsec(t.src.card, chips(s.card, n => bchip(n))));
  if (s.node) parts.push(bsec(t.src.node, chips(s.node, n => bchip(n.name, { kind: 'res', key: n.name }, { extra: t.nodeKind[n.kind] }))));
  if (s.shop) parts.push(bsec(t.src.shop, chips(s.shop, x => bchip(x.npc.name, { kind: 'npc', key: x.npc.name }, { extra: priceEl(x.price) }))));
  if (s.quest) parts.push(bsec(t.src.quest, chips(s.quest, qchip)));
  if (s.box) parts.push(bsec(t.src.box, chips(s.box, g => bchip(g.name, { kind: 'good', key: g.name }))));
  if (s.given) parts.push(bsec(t.src.given, chips(s.given, n => bchip(n))));
  if (s.event) parts.push(bsec(t.src.event, chips(s.event, n => { const l = evLink(n); return l instanceof Node ? l : bchip(n, null); })));
  if (s.season) parts.push(bsec(t.src.season, chips(s.season, n => bchip(n, null))));
  if (s.edition) parts.push(bsec(t.src.edition, chips(s.edition, n => bchip(n, null))));
  if (s.craft) parts.push(bsec(t.src.craft, chips(s.craft, r => bchip(r.name.replace(/^Рецепт:\s*/, ''), { kind: 'recipe', key: r.name }, { extra: `${r.chance ?? '?'}%` }))));
  if (s.station) {
    // with the station's table: what goes in and the fee per piece; a station without one (Расщепитель) stays a chip
    const made = stationMaking(name), rest = s.station.filter(n => !made.some(r => r.station === n));
    parts.push(bsec(t.src.station, made.map(r => h('div', { class: 'bs-strow' }, bchip(r.station, null), h('span', { class: 'bs-st-eq' }, '='),
      chips(r.res, x => bchip(x.n, undefined, { count: x.c })), h('span', { class: 'bs-price' }, priceEl(r.fee)))),
      rest.length ? chips(rest, n => bchip(n)) : null));
  }
  if (s.from) parts.push(bsec(t.src.from, chips(s.from, n => bchip(n))));
  if (s.start) parts.push(bsec(t.src.start, chips(s.start, n => bchip(n, null))));
  if (s.other) parts.push(bsec(t.src.other, chips(s.other, n => bchip(n))));
  out.push(h('div', { class: 'bs-group' }, h('h3', null, t.whereGet), parts.length ? parts : h('div', { class: 'hint' }, t.nobody)));
  const uses = [];
  if (u.recipe) uses.push(bsec(t.use.recipe, chips(u.recipe, r => bchip(r.name.replace(/^Рецепт:\s*/, ''), { kind: 'recipe', key: r.name }, { count: (r.res.find(x => bnorm(x.n) === bnorm(name)) || {}).c }))));
  if (u.quest) uses.push(bsec(t.use.quest, chips(u.quest, qchip)));
  if (u.coll) uses.push(bsec(t.use.coll, chips(u.coll, n => bchip(n, null))));
  if (u.station) {
    const into = stationUsing(name), rest = u.station.filter(n => !into.some(r => r.station === n));
    uses.push(bsec(t.use.station, into.length ? chips(into, r => bchip(r.result, undefined, { extra: `${r.station} · ${(r.res.find(x => bnorm(x.n) === bnorm(name)) || {}).c} ${t.ct.pcs}` })) : null,
      rest.length ? chips(rest, n => bchip(n)) : null));
  }
  if (u.made) uses.push(bsec(t.use.made, chips(u.made, n => bchip(n))));
  if (uses.length) out.push(h('div', { class: 'bs-group' }, h('h3', null, t.usedFor), uses));
  return out;
}

// the location map: the wiki's frame is 800 × 640, the map image sits in it at its own size and offset
const MARK_KIND = { 'НПС': 'npc', 'Лорд': 'npc', 'Инфанта': 'infanta', 'Продавец': 'shop', 'Рынок': 'shop', 'ТорговецРыбой': 'shop', 'Почта': 'post',
  'Локация': 'exit', 'Подземелье': 'exit', 'Здание': 'exit', 'Замок': 'exit', 'Летающий': 'exit', 'Рыбалка': 'fish' };
const MARK_GLYPH = { npc: '!', infanta: '♛', shop: '$', post: '✉', exit: '➜', fish: '≈', craft: '⚒' };
const markKind = t => MARK_KIND[t] || 'craft';
function markTip(m) {
  const t = BTX(), X = baseIndex(), k = markKind(m.t);
  const title = `<div class="bs-tt-h"><b>${esc(m.n)}</b><span>${esc(m.t === 'Продавец' ? t.marks.shop : t.marks[k] || m.t)}</span></div>`;
  if (k === 'npc' || k === 'shop' || k === 'infanta' || k === 'post') {
    const n = X.npcBy.get(bnorm(m.n));
    const qs = (n && X.questsFrom.get(n.name)) || [];
    const img = n && n.img ? `<img class="bs-tt-img" src="../data/npcs/${n.img}">` : '';
    let body = '';
    if (qs.length) body += `<div class="bs-tt-s">${esc(t.gives)}</div>` + qs.slice(0, 6).map(q => `<div>${q.level != null ? `<span class="m">${t.lvl} ${q.level}</span> ` : ''}${esc(q.name)}</div>`).join('') + (qs.length > 6 ? `<div class="m">${esc(fmtT(t.andMore, { n: qs.length - 6 }))}</div>` : '');
    if (n && (n.shop || []).length) body += `<div class="bs-tt-s">${esc(t.shop)}</div>` + n.shop.slice(0, 5).map(s => `<div>${esc(s.n)} <span class="m">${priceHtml(s.p)}</span></div>`).join('') + (n.shop.length > 5 ? `<div class="m">${esc(fmtT(t.andMore, { n: n.shop.length - 5 }))}</div>` : '');
    return `<div class="bs-tt">${img}<div>${title}${body}</div></div>`;
  }
  if (k === 'exit') {
    const l = X.locBy.get(m.n);
    return `<div class="bs-tt"><div>${title}${l && l.min != null ? `<div class="m">${t.lvl} ${l.min}–${l.max}</div>` : ''}</div></div>`;
  }
  if (k === 'fish') {
    const n = X.nodeBy.get(bnorm(m.n));
    return `<div class="bs-tt"><div>${title}${n ? (n.drops || []).slice(0, 6).map(d => `<div>${esc(d.n)}</div>`).join('') : ''}</div></div>`;
  }
  return `<div class="bs-tt"><div>${title}</div></div>`;
}
function markOpen(m) {
  const X = baseIndex(), k = markKind(m.t);
  if ((k === 'npc' || k === 'shop' || k === 'infanta' || k === 'post') && X.npcBy.has(bnorm(m.n))) openBase('npc', X.npcBy.get(bnorm(m.n)).name);
  else if (k === 'exit' && X.locBy.has(m.n)) openBase('loc', m.n);
  else if (k === 'fish' && X.nodeBy.has(bnorm(m.n))) openBase('res', X.nodeBy.get(bnorm(m.n)).name);
}
function mapView(l) {
  const wrap = h('div', { class: 'bs-map' });
  const sz = l.size || 800;
  const im = h('img', { class: 'bs-map-img', src: `../data/maps/${l.map}`, draggable: 'false' });
  Object.assign(im.style, { left: `${((800 - sz) / 2 / 800) * 100}%`, top: `${(((640 - sz) / 2 + (l.off || 0)) / 640) * 100}%`, width: `${(sz / 800) * 100}%` });
  wrap.append(im);
  for (const m of l.marks || []) {
    if (m.x == null || m.y == null) continue;
    const k = markKind(m.t);
    wrap.append(h('button', { class: `bs-mark ${k}`, style: `left:${(m.x / 800) * 100}%;top:${(m.y / 640) * 100}%`, tip: () => markTip(m), onclick: () => markOpen(m) }, MARK_GLYPH[k]));
  }
  return wrap;
}

// ---------- events (data/base-events.js; how they work: our own short points in tools/event-notes.mjs) ----------
const evDate = (iso, year) => new Date(iso + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
const evRange = r => `${evDate(r.from, r.from.slice(0, 4) !== r.to.slice(0, 4))} – ${evDate(r.to, true)}`;
// «октябрь – ноябрь»: the months of the latest run
function evMonths(x) {
  const r = x.dates && x.dates[0];
  if (!r) return '';
  const m = iso => new Date(iso + 'T12:00:00').toLocaleDateString(locale(), { month: 'long' });
  return m(r.from) === m(r.to) ? m(r.from) : `${m(r.from)} – ${m(r.to)}`;
}
// the event name on other pages opens the event
function evLink(name) {
  if (!name) return null;
  const ev = baseIndex().eventBy.get(bnorm(name));
  return ev ? bchip(name, { kind: 'event', key: ev.name }, { icon: ev.img ? `../data/events/${ev.img}` : undefined }) : name;
}
// running now or coming: from the calendar (Steam news), else from the wiki's dates
function evLive(x) {
  const now = Date.now() / 1000;
  const c = (typeof SN !== 'undefined' && SN.cal || []).find(c => (c.kind === 'event' || c.kind === 'season') && bnorm(c.name) === bnorm(x.name) && (c.end == null || c.end > now));
  if (c) return c.start != null && c.start > now ? { soon: c.start } : { left: c.end != null ? c.end - now : null };
  const r = x.dates && x.dates[0];
  if (r && now >= Date.parse(r.from + 'T00:00:00+03:00') / 1000 && now < Date.parse(r.to + 'T23:59:59+03:00') / 1000) return { left: Date.parse(r.to + 'T23:59:59+03:00') / 1000 - now };
  return null;
}
function drawEventPage(el, x) {
  const t = BTX(), v = t.ev, X = baseIndex();
  if (x.img) el.insertBefore(h('img', { class: 'bs-banner', src: `../data/events/${x.img}`, draggable: 'false', onerror: hideImg }), el.querySelector('.bs-head'));
  const live = evLive(x);
  if (live) el.append(h('div', { class: 'bs-live' }, h('b', null, live.soon ? fmtT(v.soon, { d: evDate(new Date(live.soon * 1000).toISOString().slice(0, 10)) }) : v.now),
    live.left != null && typeof calSpan === 'function' ? ' · ' + v.left.replace('{t}', calSpan(live.left)) : '',
    typeof switchTool === 'function' ? h('button', { class: 'btn small ghost', onclick: () => switchTool('calendar') }, '📅 ' + v.toCal) : null));
  el.append(bfacts([[v.status, x.running ? v.yearly : v.past], [v.usual, x.running ? evMonths(x) : ''], [v.last, x.dates[0] ? evRange(x.dates[0]) : ''], [v.since, x.since]]));
  const notes = x.notes && (x.notes[lang] || x.notes.ru);
  if (notes && notes.length) el.append(bsec(v.how, h('ul', { class: 'bs-how' }, notes.map(n => h('li', null, n)))));
  const G = v.groups;
  const sec = (k, fn) => { const list = x[k] || []; if (list.length) el.append(bsec(`${G[k]} · ${list.length}`, chips(list, fn))); };
  sec('locs', n => bchip(n, X.locBy.has(n) ? { kind: 'loc', key: n } : null));
  sec('npcs', n => bchip(n, X.npcBy.has(bnorm(n)) ? { kind: 'npc', key: X.npcBy.get(bnorm(n)).name } : null));
  sec('monsters', n => { const m = X.monBy.get(bnorm(n)); return m ? mchip(m) : bchip(n, null); });
  sec('quests', n => { const q = X.questBy.get(bnorm(n)); return q ? qchip(q) : bchip(n, null); });
  sec('chains', n => bchip(n, null));
  for (const k of ['mounts', 'gear', 'cards', 'transmog', 'boxes', 'cons', 'trophies']) sec(k, n => bchip(n));
  // the official posts about it on Steam (guides, dates), opened in «Новости»
  const posts = (typeof SN !== 'undefined' && SN.items || []).filter(it => bnorm((it.ru || {}).t).includes(bnorm(x.name)) || bnorm((it.ru || {}).b).includes('«' + bnorm(x.name) + '»'));
  if (posts.length && typeof snText === 'function') el.append(bsec(STX().title, h('div', { class: 'bs-chips' }, posts.slice(0, 8).map(it =>
    h('button', { class: 'bs-chip link', onclick: () => { SN.sel = it.id; switchTool('steam'); } }, '📰 ' + snText(it).t, h('small', null, snDate(it.at)))))));
  if (x.dates && x.dates.length) el.append(bsec(v.history, h('div', { class: 'bs-chips' }, x.dates.map(r => h('span', { class: 'bs-chip' }, evRange(r))))));
  el.append(h('div', { class: 'bs-foot' }, wikiLink(x.name)));
}

// ---------- the page ----------
function drawBaseDetail() {
  const el = document.getElementById('baseDetail');
  if (!el) return;
  const t = BTX(), X = baseIndex();
  el.innerHTML = '';
  const f = BS.sel && findEntry(BS.sel.kind, BS.sel.key);
  if (!f) { el.append(h('div', { class: 'bs-empty big' }, t.pick)); return; }
  const { e, x } = f;
  if (BS.back.length) el.append(h('button', { class: 'btn small ghost bs-back', onclick: () => { const p = BS.back.pop(); if (p) openBase(p.kind, p.key, { push: false }); } }, '← ' + t.back));
  el.append(h('div', { class: 'bs-head' },
    e.kind === 'event' ? null : e.icon ? h('img', { class: 'bs-big' + (e.round ? ' round' : '') + (e.cover ? ' cover' : ''), src: e.icon, draggable: 'false', onerror: hideImg }) : h('span', { class: 'bs-big ph' }, iconEl(ph(e.kind))),
    h('div', { class: 'bs-title' }, h('h2', null, e.name), h('div', { class: 'bs-meta' }, t.cats[e.kind] + (e.meta ? ' · ' + e.meta : '')))));

  if (e.kind === 'monster') {
    el.append(bfacts([[t.level, x.level], [t.hp, x.hp != null ? fmtNum(x.hp) : null], [t.race, x.race], [t.element, x.element], [t.defense, x.defense],
      [t.exp, x.exp != null ? fmtNum(x.exp) : null], [t.mode, x.mode], [t.aggro, x.aggro ? t.yes : t.no], [t.event, evLink(x.event)], [t.group, x.group], [t.quest, x.quest], [t.summoned, x.summoned]]));
    if ((x.locs || []).length) {
      el.append(bsec(t.where, h('div', { class: 'bs-chips' }, x.locs.map(l => bchip(l.loc, { kind: 'loc', key: l.loc }, { extra: l.resp ? `${t.resp} ${fmtMin(l.resp)}` : '' })))));
      if (typeof BOSSES !== 'undefined' && BOSSES.find(b => b.name === x.name)) el.append(h('button', { class: 'btn small bs-act', onclick: () => { BT.q = x.name; switchTool('timer'); } }, iconEl('skull'), t.toTimer));
    }
    for (const k of ['equip', 'cards', 'drop', 'cons', 'questDrop', 'recipes', 'summon']) {
      const list = x[k] || [];
      if (list.length) el.append(bsec(t.drops[k], chips(list, n => bchip(n, k === 'summon' ? linkOfName(n) : undefined))));
    }
    el.append(h('div', { class: 'bs-foot' }, wikiLink('Монстр ' + x.name)));
  } else if (e.kind === 'event') {
    drawEventPage(el, x);
  } else if (e.kind === 'loc' && x.name === 'Все локации') {
    // not a place: the wiki writes it for monsters that can turn up on any location (event and wandering ones)
    el.append(h('div', { class: 'note bs-everywhere' }, t.everywhere));
    const grid = h('div', { class: 'bs-mlist' });
    for (const { m } of x.monsters) grid.append(baseRow(entryOf('monster', m), false, () => openBase('monster', m.name)));
    el.append(bsec(t.monsters, grid));
  } else if (e.kind === 'loc') {
    el.append(bfacts([[t.locType, (x.type || []).join(', ')], [t.levels, x.min != null ? `${x.min}–${x.max}` : (x.lv || []).join('–')], [t.event, evLink(x.event)]]));
    if (x.map) el.append(mapView(x));
    const marks = x.marks || [];
    const npcNames = [...new Set([...marks.filter(m => ['npc', 'shop', 'infanta', 'post'].includes(markKind(m.t))).map(m => m.n), ...x.npcs.map(n => n.name)])];
    if (npcNames.length) el.append(bsec(t.npcsHere, chips(npcNames, n => bchip(n, X.npcBy.has(bnorm(n)) ? { kind: 'npc', key: X.npcBy.get(bnorm(n)).name } : null))));
    if (x.monsters.length) {
      const grid = h('div', { class: 'bs-mlist' });
      for (const { m, resp } of x.monsters) { const en = entryOf('monster', m); if (resp) en.meta += ` · ${t.resp} ${fmtMin(resp)}`; grid.append(baseRow(en, false, () => openBase('monster', m.name))); }
      el.append(bsec(t.monsters, grid));
    }
    const res = [...new Set([...x.nodes.map(n => n.name), ...marks.filter(m => markKind(m.t) === 'fish').map(m => m.n)])];
    if (res.length) el.append(bsec(t.resHere, chips(res, n => bchip(n, X.nodeBy.has(bnorm(n)) ? { kind: 'res', key: X.nodeBy.get(bnorm(n)).name } : null))));
    const exits = marks.filter(m => markKind(m.t) === 'exit');
    if (exits.length) el.append(bsec(t.exits, chips(exits, m => bchip(m.n, X.locBy.has(m.n) ? { kind: 'loc', key: m.n } : null, { extra: m.t }))));
    el.append(h('div', { class: 'bs-foot' }, wikiLink(x.name)));
  } else if (e.kind === 'npc') {
    el.append(bfacts([[t.race, x.race], [t.event, evLink(x.event)]]));
    if ((x.locs || []).length) el.append(bsec(t.standsIn, chips(x.locs, l => bchip(l, X.locBy.has(l) ? { kind: 'loc', key: l } : null))));
    const gives = X.questsFrom.get(x.name) || [], takes = X.questsTo.get(x.name) || [];
    if (gives.length) el.append(bsec(`${t.gives} (${gives.length})`, chips(gives, qchip)));
    if (takes.length) el.append(bsec(`${t.takes} (${takes.length})`, chips(takes, qchip)));
    if ((x.shop || []).length) {
      el.append(bsec(`${t.shop} (${x.shop.length})`, h('div', { class: 'bs-shop' }, x.shop.map(s => h('div', null, bchip(s.n), h('span', { class: 'bs-price' }, priceEl(s.p)))))));
    }
    el.append(h('div', { class: 'bs-foot' }, wikiLink(x.name)));
  } else if (e.kind === 'quest') {
    el.append(bfacts([[t.level, x.level], [t.type, x.type], [t.event, evLink(x.event)], [t.chain, x.chain ? `${x.chain}${x.num ? ` · №${x.num}` : ''}` : ''], [t.cls, (x.cls || []).join(', ')],
      [t.exp, x.exp ? fmtNum(x.exp) : null], [t.gold, x.gold ? priceEl(x.gold) : null]]));
    const npcLink = n => bchip(n, X.npcBy.has(bnorm(n)) ? { kind: 'npc', key: X.npcBy.get(bnorm(n)).name } : null);
    el.append(h('div', { class: 'bs-pair' }, x.from ? bsec(t.from, npcLink(x.from)) : null, x.to ? bsec(t.to, npcLink(x.to)) : null));
    const prev = (x.prev || []).map(p => X.questBy.get(bnorm(p))).filter(Boolean);
    const next = X.questsAfter.get(bnorm(x.name)) || [];
    if (prev.length || next.length) el.append(h('div', { class: 'bs-pair' }, prev.length ? bsec(t.prev, chips(prev, qchip)) : null, next.length ? bsec(t.next, chips(next, qchip)) : null));
    const task = [];
    if ((x.kill || []).length) task.push(bsec(t.kill, chips(x.kill, k => bchip(k.n, X.monBy.has(bnorm(k.n)) ? { kind: 'monster', key: X.monBy.get(bnorm(k.n)).name } : null, { count: k.c }))));
    if ((x.need || []).length) task.push(bsec(t.need, chips(x.need, k => bchip(k.n, undefined, { count: k.c }))));
    if ((x.use || []).length) task.push(bsec(t.useIt, chips(x.use, k => bchip(k.n, undefined, { count: k.c }))));
    if ((x.bring || []).length) task.push(bsec(t.bring, chips(x.bring, npcLink)));
    if ((x.loc || []).length) task.push(bsec(t.where, chips(x.loc, l => bchip(l, X.locBy.has(l) ? { kind: 'loc', key: l } : null))));
    if (task.length) el.append(h('div', { class: 'bs-group' }, h('h3', null, t.task), task));
    const rew = [];
    if ((x.reward || []).length) rew.push(bsec(t.reward, chips(x.reward, k => bchip(k.n, undefined, { count: k.c }))));
    if ((x.choice || []).length) rew.push(bsec(t.choice, chips(x.choice, k => bchip(k.n, undefined, { count: k.c }))));
    if (rew.length) el.append(h('div', { class: 'bs-group' }, h('h3', null, t.reward), rew));
    el.append(h('div', { class: 'bs-foot' }, wikiLink('Задание — ' + x.name)));
  } else if (e.kind === 'recipe') {
    el.append(bfacts([[t.chance, x.chance != null ? `${x.chance}%` : null]]));
    el.append(craftBlock(x));
    const s = sourcesOf(x.name);
    const parts = [];
    if (s.drop) parts.push(bsec(t.src.drop, chips(s.drop.slice().sort((a, b) => (a.level ?? 999) - (b.level ?? 999)), mchip)));
    if (s.box) parts.push(bsec(t.src.box, chips(s.box, g => bchip(g.name, { kind: 'good', key: g.name }))));
    if (s.shop) parts.push(bsec(t.src.shop, chips(s.shop, y => bchip(y.npc.name, { kind: 'npc', key: y.npc.name }, { extra: priceEl(y.price) }))));
    if (s.quest) parts.push(bsec(t.src.quest, chips(s.quest, qchip)));
    if (s.season) parts.push(bsec(t.src.season, chips(s.season, n => bchip(n, null))));
    if (s.other) parts.push(bsec(t.src.other, chips(s.other, n => bchip(n))));
    if (x.from) parts.push(bsec(t.from, chips([x.from], n => bchip(n))));
    el.append(h('div', { class: 'bs-group' }, h('h3', null, t.recipeFrom), parts.length ? parts : h('div', { class: 'hint' }, t.nobody)));
    el.append(h('div', { class: 'bs-foot' }, wikiLink(x.name)));
  } else if (e.kind === 'res') {
    if ((x.bait || []).length) el.append(bsec(t.bait, chips(x.bait, n => bchip(n))));
    el.append(bsec(t.yields, chips(x.drops || [], d => bchip(d.n, undefined, { count: d.c, extra: d.ev || '' }))));
    if ((x.locs || []).length) el.append(bsec(t.locsOf, chips(x.locs, l => bchip(l, X.locBy.has(l) ? { kind: 'loc', key: l } : null))));
  } else if (e.kind === 'item') {
    const tip = h('div', { class: 'bs-tip' });
    tip.innerHTML = itemTip(x, null);
    el.append(tip);
    const sets = allowedSets(ch);
    const keys = [...sets.keys()].filter(k => sets.get(k).has(x.id));
    const key = keys.find(k => !ch.equipment[k]) || keys[0];
    el.append(key
      ? h('button', { class: 'btn primary small bs-act', onclick: () => {
        changed(c => {
          const n = ctx.cardCount(x);
          const en = { itemId: x.id, upgrade: 0, cards: Array.from({ length: n }, () => null) };
          if (x.primaryCardId) en.cards[0] = x.primaryCardId;
          c.equipment[key] = en;
          if (slotLockedByTwoHander(c, ctx.reverseKey(key) || '')) delete c.equipment[ctx.reverseKey(key)];
        }, { center: false });
        toast(fmtT(t.equipped, { slot: ctx.slots.get(+key.split(':')[0])?.name || '' }));
      } }, iconEl('calc'), t.equip)
      : h('div', { class: 'hint' }, fmtT(t.cantEquip, { cls: ctx.classes.get(ch.classId)?.name || '' })));
    el.append(...whereBlocks(x.name));
  } else if (e.kind === 'card') {
    el.append(h('div', { class: 'bs-bonuses' }, x.bonuses.map(cb => h('div', null, bonusText({ typeId: cb.typeId, vars: cardBonusVarsForDisplay(cb) })))));
    const where = [...(x.slotIds || []).map(id => ctx.slots.get(id)?.name), ...(x.typeIds || []).map(id => ctx.eqTypes.get(id)?.name)].filter(Boolean);
    if (where.length) el.append(bsec(t.slots, chips(where, w => h('span', { class: 'bs-chip' }, w))));
    el.append(...whereBlocks(x.name));
  } else if (e.kind === 'stamp') {
    el.append(bsec(t.variants, h('div', { class: 'bs-variants' }, x.variants.map(v => h('div', { class: 'bs-var' },
      h('i', { style: `background:${v.color?.Argb || '#888'}` }),
      h('div', null, v.bonuses.map(b => h('div', null, bonusText({ typeId: b.typeId, vars: [b.value] })))))))));
  } else if (e.kind === 'good') {
    const g = x, F = g.f || {}, L = g.lists || {}, gt = t.goods;
    const priceKeys = new Set(['Цена', 'РыбнаяЦена']);
    // «Класс1…Класс6» → one «Класс» row; the event links to its page
    const rows = [], cls = [];
    for (const [k, v] of Object.entries(F)) {
      if (/^Класс\d$/.test(k)) { if (!cls.length) rows.push(['Класс', cls]); cls.push(v); continue; }
      rows.push([k, priceKeys.has(k) ? priceEl(v) : k === 'Ивент' ? evLink(v) : v]);
    }
    el.append(bfacts(rows.map(([k, v]) => [goodLabel(k), Array.isArray(v) ? v.join(', ') : v])));
    if (L['Бонус']) el.append(bsec(gt.fx, h('div', { class: 'bs-bonuses' }, L['Бонус'].map(b => h('div', null, b.n)))));
    if (L['Особенность']) el.append(bsec(gt.feat, h('div', { class: 'bs-bonuses' }, L['Особенность'].map(b => h('div', null, b.n)))));
    if (L['Дроп']) el.append(bsec(gt.box, chips(L['Дроп'], d => bchip(d.n, undefined, { count: d.c }))));
    if (L['ДопДроп']) el.append(bsec(gt.more, chips(L['ДопДроп'], d => bchip(d.n, undefined, { count: d.c }))));
    if (L['Подарок']) el.append(bsec(gt.gift, chips(L['Подарок'], d => bchip(d.n, undefined, { count: d.c }))));
    if (L['Получается']) el.append(bsec(gt.gets, chips(L['Получается'], d => bchip(d.n))));
    if (L['Требуется']) el.append(bsec(gt.needs, chips(L['Требуется'], d => bchip(d.n))));
    if (L['Создание']) el.append(bsec(gt.make, chips(L['Создание'], d => bchip(d.n))));
    if (L['Монстр']) el.append(bsec(gt.mons, chips(L['Монстр'], d => bchip(d.n))));
    if (L['Лока']) el.append(bsec(gt.where, chips(L['Лока'], d => bchip(d.n, X.locBy.has(d.n) ? { kind: 'loc', key: d.n } : null))));
    el.append(...whereBlocks(g.name));
    el.append(h('div', { class: 'bs-foot' }, wikiLink(g.name)));
  } else if (e.kind === 'loot' || e.kind === 'thing') {
    const mi = e.kind === 'loot' ? x : X.lootBy.get(bnorm(x));
    if (mi) {
      el.append(bfacts([[t.npc, mi.npc != null ? priceEl(mi.npc) : null], [t.event, evLink(mi.event)]]));
    }
    el.append(...whereBlocks(e.kind === 'loot' ? x.name : x));
  }
  el.append(h('div', { class: 'note bs-src' }, t.src2));
  el.scrollTop = 0;
}

// the wiki's field names → readable labels («МинУровень» → «Мин. уровень»); unknown ones get spaces between words
const GOOD_L = {
  ru: { Цена: 'Цена', Тип: 'Тип', Ивент: 'Ивент', Выдаёт: 'Выдаёт', МинУровень: 'Мин. уровень', МаксУровень: 'Макс. уровень', ФактУровень: 'Факт. уровень', КлассПредмета: 'Класс предмета', Класс: 'Класс', Слоты: 'Слоты для карт', Защита: 'Защита', Атака: 'Атака', Пол: 'Пол', Скорость: 'Скорость', БонусКоллекции: 'Бонус коллекции', Корм: 'Корм', Создаётся: 'Создаётся', СоздаётсяШт: 'Создаётся, шт.', Жизни: 'Жизни', Требования: 'Требования', Раса: 'Раса', Элемент: 'Стихия', Устаревший: 'Устаревший', РыбнаяЦена: 'Цена рыбой' },
  uk: { Цена: 'Ціна', Тип: 'Тип', Ивент: 'Івент', Выдаёт: 'Видає', МинУровень: 'Мін. рівень', МаксУровень: 'Макс. рівень', ФактУровень: 'Факт. рівень', КлассПредмета: 'Клас предмета', Класс: 'Клас', Слоты: 'Слоти для карт', Защита: 'Захист', Атака: 'Атака', Пол: 'Стать', Скорость: 'Швидкість', БонусКоллекции: 'Бонус колекції', Корм: 'Корм', Создаётся: 'Створюється', СоздаётсяШт: 'Створюється, шт.', Жизни: 'Життя', Требования: 'Вимоги', Раса: 'Раса', Элемент: 'Стихія', Устаревший: 'Застарілий', РыбнаяЦена: 'Ціна рибою' },
  en: { Цена: 'Price', Тип: 'Type', Ивент: 'Event', Выдаёт: 'Given by', МинУровень: 'Min level', МаксУровень: 'Max level', ФактУровень: 'Actual level', КлассПредмета: 'Grade', Класс: 'Class', Слоты: 'Card slots', Защита: 'Defense', Атака: 'Attack', Пол: 'Gender', Скорость: 'Speed', БонусКоллекции: 'Collection bonus', Корм: 'Food', Создаётся: 'Made at', СоздаётсяШт: 'Made, pcs', Жизни: 'HP', Требования: 'Requirements', Раса: 'Race', Элемент: 'Element', Устаревший: 'Obsolete', РыбнаяЦена: 'Fish price' },
};
const goodLabel = k => (GOOD_L[lang] || GOOD_L.ru)[k] || k.replace(/([а-яё])([А-ЯЁ])/g, (m, a, b) => a + ' ' + b.toLowerCase());

// «Предметы»: one chip per wiki category (Еда, Зелья, Контейнеры, Трофеи…), the biggest first
function goodsFilter() {
  const t = BTX(), cnt = new Map();
  for (const g of baseIndex().goods) cnt.set(g.cat, (cnt.get(g.cat) || 0) + 1);
  const cats = [...cnt.entries()].sort((a, b) => b[1] - a[1]);
  const pick = c => { BS.sub = c; store.set('baseSub', c); renderCenter(); };
  return h('div', { class: 'bs-subs' },
    h('button', { class: 'bs-sub' + (!BS.sub ? ' on' : ''), onclick: () => pick('') }, t.goods.all),
    cats.map(([c, n]) => h('button', { class: 'bs-sub' + (BS.sub === c ? ' on' : ''), onclick: () => pick(c) }, c, h('small', null, ' ' + n))));
}
