'use strict';
/* «Обмен» tool: a panel over the game that values both sides of the trade window (trade/ in the app).
   This page turns it on / off and keeps the prices: the sign price for cards and your own prices for other loot.
   The trade window reading is ported from TradeCounterRQ by w-stus (github.com/w-stus/tradecounterRQ), non-commercial license.
   The website only describes it and offers the app. Uses app.js helpers at call time (h, $, lang, iconEl, toast). */
/* global SETTINGS, IS_APP, saveSettings, h, $, lang, iconEl, toast */

const TRADE_T = {
  uk: {
    title: 'Обмін', sub: 'Вартість обміну поверх гри',
    lead: 'Панель поверх гри, яка читає вікно обміну й рахує обидві сторони: карти — за знаками, решту — за вашими цінами, плюс золото. Внизу — різниця: скільки ви отримуєте мінус скільки віддаєте.',
    on: 'Увімкнути', off: 'Вимкнути', show: 'Показати панель', isOff: 'Вимкнено',
    starting: 'Запускаю розпізнавання…', noGame: 'Шукаю вікно Royal Quest…', waiting: 'Гру знайдено — чекаю на обмін', reading: 'Читаю обмін', err: 'Помилка: {e}',
    keyBusy: 'Клавіша {key} зайнята іншою програмою — відкривайте панель кнопкою «Показати панель».',
    signs: 'Ціна знака', signsHint: 'Карти рахуються як знаки × ціна знака. Скупка — коли карти отримуєте ви, продаж — коли віддаєте.', buySign: 'Скупка', sellSign: 'Продаж', save: 'Зберегти', saved: 'Збережено',
    prices: 'Ваші ціни', pricesHint: 'Ціни на звичайний і унікальний лут. Їх можна вказати й просто на панелі — клацніть по рядку обміну.',
    add: 'Додати предмет…', none: 'Цін ще немає.', name: 'Предмет', kind: 'Тип', buy: 'Скупка', sell: 'Продаж', del: 'Прибрати', notFound: 'Нічого не знайдено',
    cat: { regular: 'Звичайний', card: 'Карта', unique: 'Унікальний' }, signsN: 'знаків',
    how: 'Як користуватися', steps: [
      ['Увімкніть інструмент', 'і запустіть гру у віконному режимі або «вікно без рамки». Програма сама знайде вікно Royal Quest.'],
      ['Вкажіть ціну знака', 'тут або на панелі: ціну скупки й продажу. Знаки всіх карт уже є в базі.'],
      ['Відкрийте обмін', 'панель з’явиться сама: зліва що отримуєте (ціни скупки), справа що віддаєте (ціни продажу) і різниця.'],
      ['Ціна предмета', 'клацніть рядок на панелі, щоб указати ціну або вибрати правильний предмет, якщо назву прочитано з помилкою.'],
      ['Історія', 'тримайте рюкзак відкритим під час обміну: за його золотом до й після програма записує покупку чи продаж.'],
    ],
    keys: 'Керування', keyRows: [['{key}', 'сховати / показати панель'], ['⠿ Обмін', 'перетягнути панель'], ['Клік по рядку', 'ціна або правильний предмет']],
    note: 'Програма лише дивиться на вікно гри, як трансляція екрана: у гру не втручається, пам’ять не читає, нічого не натискає. Розпізнавання працює на вашому комп’ютері без інтернету.',
    credit: 'Розпізнавання вікна обміну перенесено з програми {link} від w-stus (некомерційна ліцензія).',
    hist: 'Історія обмінів', histHint: 'Обмін записується сам, коли золото в рюкзаку змінилося: менше — покупка, більше — продаж. Тримайте рюкзак відкритим під час обміну, щоб було видно його золото.',
    from: 'З', to: 'По', dir: { all: 'Усі', purchase: 'Покупки', sale: 'Продажі' }, today: 'Сьогодні', week: '7 днів', month: '30 днів', all: 'Усе',
    purchases: 'Покупок', sales: 'Продажів', spent: 'Витрачено', got: 'Отримано', net: 'Потік золота', netNote: 'отримано з продажів − витрачено на покупки, не прибуток',
    tabs: { journal: 'Журнал', days: 'По днях', items: 'Предмети' }, purchase: 'Покупка', sale: 'Продаж', noTrades: 'За цей період обмінів немає.',
    bagGold: 'Золото рюкзака', recv: 'Отримано', gave: 'Віддано', nothing: 'нічого', unknownItem: 'Невідомий предмет', unknownQty: '?', rowIssue: { uncertain: 'незрозуміла комірка', noName: 'назву не прочитано', noQuantity: 'кількість невідома' },
    mismatch: 'Золото у вікні обміну не збіглося зі зміною рюкзака: записано за рюкзаком.', delTrade: 'Видалити запис', delAsk: 'Видалити цей обмін з історії?',
    day: 'День', side: 'Сторона', qty: 'Кількість', unknownRows: 'Невідома к-сть', prev: '‹', next: '›',
    last: 'Останній результат: {r}', counted: { purchase: 'враховано покупку {a}', sale: 'враховано продаж {a}' }, notCounted: 'не враховано — {w}',
    why: { captureBreak: 'перервалося спостереження за грою', readError: 'помилка читання', newTradeTooSoon: 'новий обмін до перевірки балансу', closeOrBalance: 'не підтверджено закриття вікна або баланс', noInitial: 'не прочитано золото рюкзака до обміну', noFinal: 'не прочитано золото рюкзака після обміну', unchanged: 'золото в рюкзаку не змінилося' },
    autoCopy: 'Копіювати суму в буфер обміну', autoCopyHint: 'Коли всі предмети, які ви отримуєте, мають ціну, їхня сума (без золота) сама копіюється — у грі вставте її як своє золото (Ctrl+V).',
    web: 'Обмін працює лише в програмі RQ Tools для Windows.', dl: 'Скачати програму',
  },
  ru: {
    title: 'Обмен', sub: 'Стоимость обмена поверх игры',
    lead: 'Панель поверх игры, которая читает окно обмена и считает обе стороны: карты — по знакам, остальное — по вашим ценам, плюс золото. Внизу — разница: сколько вы получаете минус сколько отдаёте.',
    on: 'Включить', off: 'Выключить', show: 'Показать панель', isOff: 'Выключено',
    starting: 'Запускаю распознавание…', noGame: 'Ищу окно Royal Quest…', waiting: 'Игра найдена — жду обмен', reading: 'Читаю обмен', err: 'Ошибка: {e}',
    keyBusy: 'Клавиша {key} занята другой программой — открывайте панель кнопкой «Показать панель».',
    signs: 'Цена знака', signsHint: 'Карты считаются как знаки × цена знака. Скупка — когда карты получаете вы, продажа — когда отдаёте.', buySign: 'Скупка', sellSign: 'Продажа', save: 'Сохранить', saved: 'Сохранено',
    prices: 'Ваши цены', pricesHint: 'Цены на обычный и уникальный лут. Их можно указать и прямо на панели — нажмите на строку обмена.',
    add: 'Добавить предмет…', none: 'Цен пока нет.', name: 'Предмет', kind: 'Тип', buy: 'Скупка', sell: 'Продажа', del: 'Убрать', notFound: 'Ничего не найдено',
    cat: { regular: 'Обычный', card: 'Карта', unique: 'Уникальный' }, signsN: 'знаков',
    how: 'Как пользоваться', steps: [
      ['Включите инструмент', 'и запустите игру в оконном режиме или «окно без рамки». Программа сама найдёт окно Royal Quest.'],
      ['Укажите цену знака', 'здесь или на панели: цену скупки и продажи. Знаки всех карт уже есть в базе.'],
      ['Откройте обмен', 'панель появится сама: слева что получаете (цены скупки), справа что отдаёте (цены продажи) и разница.'],
      ['Цена предмета', 'нажмите на строку на панели, чтобы указать цену или выбрать правильный предмет, если название прочитано с ошибкой.'],
      ['История', 'держите рюкзак открытым во время обмена: по его золоту до и после программа записывает покупку или продажу.'],
    ],
    keys: 'Управление', keyRows: [['{key}', 'скрыть / показать панель'], ['⠿ Обмен', 'перетащить панель'], ['Клик по строке', 'цена или правильный предмет']],
    note: 'Программа только смотрит на окно игры, как трансляция экрана: в игру не вмешивается, память не читает, ничего не нажимает. Распознавание работает на вашем компьютере без интернета.',
    credit: 'Распознавание окна обмена перенесено из программы {link} от w-stus (некоммерческая лицензия).',
    hist: 'История обменов', histHint: 'Обмен записывается сам, когда золото в рюкзаке изменилось: меньше — покупка, больше — продажа. Держите рюкзак открытым во время обмена, чтобы было видно его золото.',
    from: 'С', to: 'По', dir: { all: 'Все', purchase: 'Покупки', sale: 'Продажи' }, today: 'Сегодня', week: '7 дней', month: '30 дней', all: 'Всё',
    purchases: 'Покупок', sales: 'Продаж', spent: 'Потрачено', got: 'Получено', net: 'Поток золота', netNote: 'получено от продаж − потрачено на покупки, не прибыль',
    tabs: { journal: 'Журнал', days: 'По дням', items: 'Предметы' }, purchase: 'Покупка', sale: 'Продажа', noTrades: 'За этот период обменов нет.',
    bagGold: 'Золото рюкзака', recv: 'Получено', gave: 'Отдано', nothing: 'ничего', unknownItem: 'Неизвестный предмет', unknownQty: '?', rowIssue: { uncertain: 'неясная ячейка', noName: 'название не прочитано', noQuantity: 'количество неизвестно' },
    mismatch: 'Золото в окне обмена не совпало с изменением рюкзака: записано по рюкзаку.', delTrade: 'Удалить запись', delAsk: 'Удалить этот обмен из истории?',
    day: 'День', side: 'Сторона', qty: 'Количество', unknownRows: 'Неизв. кол-во', prev: '‹', next: '›',
    last: 'Последний результат: {r}', counted: { purchase: 'учтена покупка {a}', sale: 'учтена продажа {a}' }, notCounted: 'не учтён — {w}',
    why: { captureBreak: 'прервалось наблюдение за игрой', readError: 'ошибка чтения', newTradeTooSoon: 'новый обмен до проверки баланса', closeOrBalance: 'не подтверждено закрытие окна или баланс', noInitial: 'не прочитано золото рюкзака до обмена', noFinal: 'не прочитано золото рюкзака после обмена', unchanged: 'золото в рюкзаке не изменилось' },
    autoCopy: 'Копировать сумму в буфер обмена', autoCopyHint: 'Когда у всех предметов, которые вы получаете, есть цена, их сумма (без золота) сама копируется — в игре вставьте её как своё золото (Ctrl+V).',
    web: 'Обмен работает только в программе RQ Tools для Windows.', dl: 'Скачать программу',
  },
  en: {
    title: 'Trade', sub: 'Trade value over the game',
    lead: 'A panel over the game that reads the trade window and values both sides: cards by their signs, the rest by your own prices, plus the gold. At the bottom: what you get minus what you give.',
    on: 'Turn on', off: 'Turn off', show: 'Show the panel', isOff: 'Off',
    starting: 'Starting the reader…', noGame: 'Looking for the Royal Quest window…', waiting: 'Game found — waiting for a trade', reading: 'Reading a trade', err: 'Error: {e}',
    keyBusy: 'Another program uses {key} — open the panel with «Show the panel».',
    signs: 'Sign price', signsHint: 'Cards count as signs × the sign price. Buy is when you get the cards, sell is when you give them.', buySign: 'Buy', sellSign: 'Sell', save: 'Save', saved: 'Saved',
    prices: 'Your prices', pricesHint: 'Prices for regular and unique loot. You can also set them right on the panel — click a trade row.',
    add: 'Add an item…', none: 'No prices yet.', name: 'Item', kind: 'Kind', buy: 'Buy', sell: 'Sell', del: 'Remove', notFound: 'Nothing found',
    cat: { regular: 'Regular', card: 'Card', unique: 'Unique' }, signsN: 'signs',
    how: 'How to use', steps: [
      ['Turn the tool on', 'and run the game in a window or a borderless window. The app finds the Royal Quest window itself.'],
      ['Set the sign price', 'here or on the panel: the buy and the sell price. The signs of every card are built in.'],
      ['Open a trade', 'the panel shows up by itself: what you get on the left (buy prices), what you give on the right (sell prices) and the difference.'],
      ['Item price', 'click a row on the panel to set its price, or to pick the right item when the name was misread.'],
      ['History', 'keep the backpack open during the trade: from its gold before and after the app saves a purchase or a sale.'],
    ],
    keys: 'Controls', keyRows: [['{key}', 'hide / show the panel'], ['⠿ Trade', 'drag the panel'], ['Click a row', 'price or the right item']],
    note: 'The app only looks at the game window, like screen sharing: it never touches the game or its memory and presses nothing. Reading runs on your computer, offline.',
    credit: 'The trade window reading is ported from {link} by w-stus (non-commercial license).',
    hist: 'Trade history', histHint: 'A trade is saved by itself when the backpack gold changes: less is a purchase, more is a sale. Keep the backpack open during the trade so its gold is visible.',
    from: 'From', to: 'To', dir: { all: 'All', purchase: 'Purchases', sale: 'Sales' }, today: 'Today', week: '7 days', month: '30 days', all: 'All',
    purchases: 'Purchases', sales: 'Sales', spent: 'Spent', got: 'Received', net: 'Gold flow', netNote: 'received from sales − spent on purchases, not profit',
    tabs: { journal: 'Journal', days: 'By day', items: 'Items' }, purchase: 'Purchase', sale: 'Sale', noTrades: 'No trades in this period.',
    bagGold: 'Backpack gold', recv: 'Received', gave: 'Given', nothing: 'nothing', unknownItem: 'Unknown item', unknownQty: '?', rowIssue: { uncertain: 'unclear slot', noName: 'name not read', noQuantity: 'count unknown' },
    mismatch: 'The trade window gold did not match the backpack change: saved by the backpack.', delTrade: 'Delete the record', delAsk: 'Delete this trade from the history?',
    day: 'Day', side: 'Side', qty: 'Count', unknownRows: 'Unknown count', prev: '‹', next: '›',
    last: 'Last result: {r}', counted: { purchase: 'purchase {a} counted', sale: 'sale {a} counted' }, notCounted: 'not counted — {w}',
    why: { captureBreak: 'lost sight of the game', readError: 'reading error', newTradeTooSoon: 'a new trade before the balance was checked', closeOrBalance: 'the window closing or the balance was not confirmed', noInitial: 'backpack gold before the trade was not read', noFinal: 'backpack gold after the trade was not read', unchanged: 'the backpack gold did not change' },
    autoCopy: 'Copy the sum to the clipboard', autoCopyHint: 'When every item you get has a price, their value (without gold) is copied by itself — paste it as your gold in the game (Ctrl+V).',
    web: 'Trade works only in the RQ Tools app for Windows.', dl: 'Download app',
  },
};
const TRT = () => TRADE_T[lang] || TRADE_T.ru;
const TRADE_REPO = 'https://github.com/w-stus/tradecounterRQ';
let tradeState = { on: false, prices: {} };
const tradeApi = () => IS_APP && typeof window.rqcApp.trade === 'function';

function tradeApply() { if (tradeApi()) window.rqcApp.trade({ on: !!SETTINGS.tradeOn, lang }); }
function tradeLang() { if (tradeApi()) window.rqcApp.trade({ lang }); }
function tradeSet(on) { SETTINGS.tradeOn = on; saveSettings(); window.rqcApp.trade({ on, lang }); }
if (tradeApi()) {
  window.rqcApp.onTrade(st => { const fresh = st.historyChanged; tradeState = { ...tradeState, ...st }; if (fresh) tradeHistLoad(); else drawTradeTool(); });
  // app.js (lang) loads after this file: send once the page is ready
  window.addEventListener('DOMContentLoaded', tradeApply);
}

function renderTradeTool(el) {
  el.append(h('div', { class: 'st-wrap', id: 'tradeWrap' }));
  if (tradeApi()) window.rqcApp.trade({ action: 'state' });
  drawTradeTool();
  if (tradeApi()) tradeHistLoad();
}
function tradeStatus(t, s) {
  if (!s.on) return t.isOff;
  if (s.error && !s.ready) return t.err.replace('{e}', s.error);
  if (!s.ready) return t.starting;
  if (!s.game) return t.noGame;
  return s.reading ? t.reading : t.waiting;
}
function drawTradeTool() {
  const el = $('tradeWrap');
  if (!el) return;
  // keep a half-typed price: redraw later
  if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  const t = TRT(), s = tradeState, on = tradeApi() && s.on, key = s.hotkey || 'Alt+Shift+T';
  el.innerHTML = '';
  const ctl = !tradeApi()
    ? h('div', { class: 'st-ctl web' }, h('div', { class: 'st-state' }, t.web),
      h('button', { class: 'btn primary', onclick: () => $('btnDownload').click() }, iconEl('download'), t.dl))
    : h('div', { class: 'st-ctl' + (on ? ' on' : '') },
      h('div', { class: 'st-state' }, h('i', { class: 'st-dot' }), tradeStatus(t, s)),
      h('div', { class: 'st-btns' },
        h('button', { class: 'btn' + (on ? '' : ' primary'), onclick: () => tradeSet(!on) }, on ? t.off : t.on),
        on ? h('button', { class: 'btn', onclick: () => window.rqcApp.trade({ action: 'show' }) }, t.show) : null),
      on && s.hotkeyOk === false ? h('div', { class: 'st-warn' }, t.keyBusy.replace('{key}', key)) : null);
  const credit = h('p', { class: 'tr-credit' });
  const [a, b] = t.credit.split('{link}');
  credit.append(a, h('a', { href: TRADE_REPO, target: '_blank', rel: 'noopener' }, 'TradeCounterRQ'), b);
  el.append(
    h('div', { class: 'st-head' }, h('h2', null, t.title), h('p', null, t.lead)),
    ctl,
    tradeApi() ? h('div', { class: 'st-grid' }, tradePricesCard(t, s), tradeSignsCard(t, s)) : '',
    h('div', { class: 'st-grid' },
      h('section', { class: 'st-card' }, h('h3', null, t.how),
        h('ol', { class: 'st-steps' }, t.steps.map(([x, y]) => h('li', null, h('b', null, x), h('span', null, y))))),
      h('div', { class: 'st-col' },
        h('section', { class: 'st-card' }, h('h3', null, t.keys),
          h('div', { class: 'st-keys' }, t.keyRows.map(([k, y]) => h('div', null, h('kbd', null, k.replace('{key}', key)), h('span', null, y))))))),
    tradeApi() ? tradeHistoryCard(t) : '',
    h('div', { class: 'sn-note st-note' }, t.note),
    credit);
}
function tradeSignsCard(t, s) {
  const buy = h('input', { class: 'inp', type: 'number', min: 1, value: s.buySign ?? '', placeholder: '—' });
  const sell = h('input', { class: 'inp', type: 'number', min: 1, value: s.sellSign ?? '', placeholder: '—' });
  const save = () => { window.rqcApp.trade({ signs: { buySign: buy.value, sellSign: sell.value } }); document.activeElement.blur(); toast(t.saved); };
  for (const i of [buy, sell]) i.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  return h('section', { class: 'st-card' }, h('h3', null, t.signs), h('p', { class: 'tr-hint' }, t.signsHint),
    h('div', { class: 'tr-signs' }, h('label', null, h('span', null, t.buySign), buy), h('label', null, h('span', null, t.sellSign), sell),
      h('button', { class: 'btn primary', onclick: save }, t.save)),
    h('label', { class: 'tr-copy' }, h('input', { type: 'checkbox', checked: s.autoCopy !== false ? '' : null, onchange: e => window.rqcApp.trade({ autoCopy: e.target.checked }) }),
      h('span', null, h('b', null, t.autoCopy), h('small', null, t.autoCopyHint))));
}
function tradePricesCard(t, s) {
  const list = Object.entries(s.prices || {}).sort((a, b) => a[0].localeCompare(b[0], 'ru'));
  const q = h('input', { class: 'inp', type: 'text', placeholder: t.add });
  const hits = h('div', { class: 'tr-hits' });
  let tm = null;
  q.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(async () => {
    const res = q.value.trim().length < 2 ? [] : await window.rqcApp.tradeKnown(q.value);
    hits.innerHTML = '';
    for (const k of res.slice(0, 12)) hits.append(h('button', { onclick: () => { window.rqcApp.trade({ price: { name: k.name, category: k.category, buy: k.price?.buy, sell: k.price?.sell } }); q.value = ''; hits.innerHTML = ''; document.activeElement.blur(); } },
      k.name, h('small', null, t.cat[k.category] + (k.signs ? ` · ${k.signs} ${t.signsN}` : ''))));
    if (q.value.trim().length >= 2 && !res.length) hits.append(h('div', { class: 'tr-hint' }, t.notFound));
  }, 150); });
  const num = (name, p, field) => {
    const i = h('input', { class: 'inp', type: 'number', min: 1, value: p[field] ?? '', placeholder: '—' });
    const commit = () => { if (String(p[field] ?? '') !== i.value) window.rqcApp.trade({ price: { ...p, name, [field]: i.value } }); };
    i.addEventListener('change', commit);
    i.addEventListener('keydown', e => { if (e.key === 'Enter') { commit(); i.blur(); } });
    return i;
  };
  const kind = (name, p) => {
    const sel = h('select', { class: 'inp' }, ['regular', 'unique', 'card'].map(c => { const o = h('option', { value: c }, t.cat[c]); if (c === p.category) o.selected = true; return o; }));
    sel.addEventListener('change', () => window.rqcApp.trade({ price: { ...p, name, category: sel.value } }));
    return sel;
  };
  return h('section', { class: 'st-card tr-prices' }, h('h3', null, t.prices), h('p', { class: 'tr-hint' }, t.pricesHint),
    h('div', { class: 'tr-add' }, q, hits),
    list.length ? h('div', { class: 'tr-table' },
      h('div', { class: 'tr-row tr-th' }, h('span', null, t.name), h('span', null, t.kind), h('span', null, t.buy), h('span', null, t.sell), h('span')),
      list.map(([name, p]) => h('div', { class: 'tr-row' }, h('span', { class: 'tr-nm', title: name }, name), kind(name, p),
        p.category === 'card' ? h('span', { class: 'tr-hint' }, p.signs ? `${p.signs} ${t.signsN}` : '') : num(name, p, 'buy'),
        p.category === 'card' ? h('span') : num(name, p, 'sell'),
        h('button', { class: 'btn ghost tr-del', title: t.del, onclick: () => window.rqcApp.trade({ price: { name, remove: true } }) }, '✕'))))
      : h('p', { class: 'tr-hint' }, t.none));
}

// ---------- history (trade/engine/accounting.js report(): totals, by day, item movement, the journal) ----------
const pad2 = n => String(n).padStart(2, '0');
const isoDay = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const TH = { from: isoDay(new Date()), to: isoDay(new Date()), dir: 'all', tab: 'journal', page: 0, open: new Set(), rep: null };
const tfmt = n => n == null ? '—' : Number(n).toLocaleString('ru-RU').replace(/ /g, ' ');
async function tradeHistLoad() {
  if (!tradeApi() || !window.rqcApp.tradeHistory) return;
  const [y1, m1, d1] = TH.from.split('-').map(Number), [y2, m2, d2] = TH.to.split('-').map(Number);
  const from = new Date(y1, m1 - 1, d1).getTime(), until = new Date(y2, m2 - 1, d2 + 1).getTime();
  try { TH.rep = await window.rqcApp.tradeHistory({ from, until, direction: TH.dir === 'all' ? null : TH.dir, tzOffsetMin: new Date().getTimezoneOffset(), page: TH.page, pageSize: 100 }); }
  catch { TH.rep = null; }
  drawTradeTool();
}
function tradeOutcomeText(t, o) {
  if (!o) return null;
  const when = new Date(o.at).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'ru-RU', { hour: '2-digit', minute: '2-digit' });
  const r = o.code === 'purchase' || o.code === 'sale' ? t.counted[o.code].replace('{a}', tfmt(o.amount)) : t.notCounted.replace('{w}', t.why[String(o.code).split(':')[1]] || o.code);
  return `${when} · ${r}`;
}
function tradeHistoryCard(t) {
  const rep = TH.rep;
  const setRange = days => { const d = new Date(); TH.to = isoDay(d); if (days == null) TH.from = '2020-01-01'; else { d.setDate(d.getDate() - days + 1); TH.from = isoDay(d); } TH.page = 0; tradeHistLoad(); };
  const from = h('input', { class: 'inp', type: 'date', value: TH.from }), to = h('input', { class: 'inp', type: 'date', value: TH.to });
  from.addEventListener('change', () => { if (from.value) { TH.from = from.value; TH.page = 0; tradeHistLoad(); } });
  to.addEventListener('change', () => { if (to.value) { TH.to = to.value; TH.page = 0; tradeHistLoad(); } });
  const dir = h('select', { class: 'inp' }, ['all', 'purchase', 'sale'].map(k => { const o = h('option', { value: k }, t.dir[k]); if (k === TH.dir) o.selected = true; return o; }));
  dir.addEventListener('change', () => { TH.dir = dir.value; TH.page = 0; tradeHistLoad(); });
  const card = h('section', { class: 'st-card th-card' }, h('h3', null, t.hist), h('p', { class: 'tr-hint' }, t.histHint),
    h('div', { class: 'th-filter' },
      h('label', null, h('span', null, t.from), from), h('label', null, h('span', null, t.to), to), h('label', null, h('span', null, ' '), dir),
      h('div', { class: 'th-quick' }, [[t.today, 1], [t.week, 7], [t.month, 30], [t.all, null]].map(([l, n]) => h('button', { class: 'btn ghost', onclick: () => setRange(n) }, l)))));
  const lo = tradeOutcomeText(t, tradeState.lastOutcome);
  if (lo) card.append(h('p', { class: 'th-last' }, t.last.replace('{r}', lo)));
  if (!rep) return card;
  const f = rep.total;
  card.append(h('div', { class: 'th-sum' },
    [[t.purchases, tfmt(f.purchases)], [t.sales, tfmt(f.sales)], [t.spent, tfmt(f.spent)], [t.got, tfmt(f.received)]].map(([l, v]) => h('div', null, h('small', null, l), h('b', null, v))),
    h('div', { class: 'th-net' }, h('small', null, t.net), h('b', { class: f.net > 0 ? 'up' : f.net < 0 ? 'down' : '' }, (f.net > 0 ? '+' : f.net < 0 ? '−' : '') + tfmt(Math.abs(f.net))), h('span', null, t.netNote))));
  card.append(h('div', { class: 'th-tabs' }, Object.entries(t.tabs).map(([k, l]) => h('button', { class: 'btn' + (TH.tab === k ? ' primary' : ' ghost'), onclick: () => { TH.tab = k; drawTradeTool(); } }, l))));
  if (!f.count) { card.append(h('p', { class: 'tr-hint' }, t.noTrades)); return card; }
  const sideName = s => (s === 'received' ? t.recv : t.gave);
  const rowText = r => `${r.name || t.unknownItem} × ${r.quantity == null ? t.unknownQty : tfmt(r.quantity)}` + (r.issues && r.issues.length ? ` — ${r.issues.map(i => t.rowIssue[i] || i).join(', ')}` : '');
  if (TH.tab === 'journal') {
    const list = h('div', { class: 'th-list' });
    for (const tr of rep.trades) {
      const open = TH.open.has(tr.id), buy = tr.direction === 'purchase';
      const time = new Date(tr.completedAt).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const items = tr.rows.map(r => `${sideName(r.side)}: ${r.name || t.unknownItem}${r.quantity > 1 ? ' ×' + tfmt(r.quantity) : ''}`).join('; ');
      const row = h('div', { class: 'th-tr' + (open ? ' open' : '') },
        h('div', { class: 'th-head', onclick: () => { if (open) TH.open.delete(tr.id); else TH.open.add(tr.id); drawTradeTool(); } },
          h('span', { class: 'th-time' }, time), h('span', { class: 'th-dir ' + (buy ? 'buy' : 'sell') }, buy ? t.purchase : t.sale),
          h('b', { class: buy ? 'down' : 'up' }, (buy ? '−' : '+') + tfmt(tr.amount)), h('span', { class: 'th-items' }, items)));
      if (open) {
        const det = h('div', { class: 'th-det' }, h('div', null, `${t.bagGold}: ${tfmt(tr.initialGold)} → ${tfmt(tr.finalGold)}`));
        for (const s of ['received', 'given']) {
          const rows = tr.rows.filter(r => r.side === s);
          det.append(h('div', { class: 'th-side' }, h('b', null, sideName(s) + ': '), rows.length ? '' : t.nothing,
            rows.length ? h('ol', null, rows.map(r => h('li', null, rowText(r)))) : null));
        }
        if (tr.reconciliation === 'mismatch') det.append(h('div', { class: 'st-warn' }, t.mismatch));
        det.append(h('button', { class: 'btn ghost th-del', onclick: async () => { if (!confirm(t.delAsk)) return; await window.rqcApp.tradeDelete(tr.id); TH.open.delete(tr.id); tradeHistLoad(); } }, t.delTrade));
        row.append(det);
      }
      list.append(row);
    }
    card.append(list);
    const pages = Math.max(1, Math.ceil(f.count / rep.pageSize));
    if (pages > 1) card.append(h('div', { class: 'th-pages' },
      h('button', { class: 'btn ghost', disabled: TH.page > 0 ? null : '', onclick: () => { TH.page--; tradeHistLoad(); } }, t.prev),
      h('span', null, `${TH.page + 1} / ${pages}`),
      h('button', { class: 'btn ghost', disabled: TH.page + 1 < pages ? null : '', onclick: () => { TH.page++; tradeHistLoad(); } }, t.next)));
  } else if (TH.tab === 'days') {
    card.append(h('div', { class: 'th-table' },
      h('div', { class: 'th-trow th-th' }, [t.day, t.purchases, t.sales, t.spent, t.got, t.net].map(x => h('span', null, x))),
      rep.days.map(d => h('div', { class: 'th-trow' }, h('span', null, d.day.split('-').reverse().join('.')), h('span', null, tfmt(d.purchases)), h('span', null, tfmt(d.sales)),
        h('span', null, tfmt(d.spent)), h('span', null, tfmt(d.received)), h('span', { class: d.net > 0 ? 'up' : d.net < 0 ? 'down' : '' }, (d.net > 0 ? '+' : d.net < 0 ? '−' : '') + tfmt(Math.abs(d.net)))))));
  } else {
    card.append(h('div', { class: 'th-table th-items-t' },
      h('div', { class: 'th-trow th-th' }, [t.side, t.name, t.qty, t.unknownRows].map(x => h('span', null, x))),
      rep.items.map(m => h('div', { class: 'th-trow' }, h('span', null, sideName(m.side)), h('span', { class: 'tr-nm' }, m.name === '?' ? t.unknownItem : m.name),
        h('span', null, m.known === 0 && m.unknownRows > 0 ? '—' : tfmt(m.known)), h('span', null, tfmt(m.unknownRows))))));
  }
  return card;
}
