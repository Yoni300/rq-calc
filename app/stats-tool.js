'use strict';
/* «Статистика» tool: RQ Stats, the overlay over the game with DPS, gold, exp, kills and loot (stats/ in the app).
   This page explains how to set the game up and turns the overlay on / off; the overlay itself is its own window.
   The website only describes it and offers the app. Uses app.js helpers at call time (h, $, lang, iconEl, switchTool). */
/* global SETTINGS, IS_APP, saveSettings, h, $, lang, iconEl */

const STATS_T = {
  uk: {
    title: 'Статистика бою', sub: 'DPS, золото, досвід і лут поверх гри',
    lead: 'Панель поверх гри, яка рахує ваш DPS, підняте золото, досвід, убитих мобів і весь зібраний лут — наживо, поки ви фармите.',
    on: 'Показати оверлей', off: 'Вимкнути оверлей', isOn: 'Оверлей увімкнено', isOff: 'Оверлей вимкнено',
    calib: 'Виділити чат', reset: 'Нова сесія', noRegion: 'Покажіть програмі, де чат: натисніть «Виділити чат», обведіть рамкою рядки вкладки Stats і натисніть Enter.',
    keysBusy: 'Гарячі клавіші Alt+Shift+S / Alt+Shift+R зайняті іншою програмою — користуйтеся кнопками тут.',
    setup: 'Як налаштувати гру', chatCap: 'Налаштування вкладки «Stats» у грі', steps: [
      ['Створіть нову вкладку чату', 'Назвіть її «Stats» і поставте галочки точно як на картинці нижче: «Нанесённый урон», «Полученный урон», «Лечение», «Опыт», «Подбор лута», «Прочее» і «Сохранять историю сообщений». Решту вимкніть, щоб інші повідомлення не заважали.'],
      ['Навіщо історія повідомлень', 'З галочкою «Сохранять историю сообщений» гра пише файл chatlogs\\Stats (РРРР.ММ).htm, і програма звіряє з ним точні підсумки.'],
      ['Покажіть, де чат', 'Увімкніть оверлей, обведіть мишкою рядки повідомлень вкладки Stats (без кнопок вкладок) і натисніть Enter.'],
    ],
    shows: 'Що показує', showsList: ['DPS за останні 10 секунд із графіком', 'Золото й досвід за сесію', 'Скільки й яких мобів убито', 'Увесь лут, окремо карти', 'Нанесений і отриманий урон, лікування, макс. удар, влучність'],
    keys: 'Керування', keyRows: [['Alt+Shift+S', 'сховати / показати панель'], ['Alt+Shift+R', 'заново виділити чат'], ['Заголовок панелі', 'перетягнути панель']],
    note: 'Гра має бути у віконному режимі або «вікно без рамки». Програма лише читає екран і файли історії чату — у гру не втручається, пам’ять не читає. Сесія зберігається між запусками.',
    web: 'Оверлей працює лише в програмі RQ Tools для Windows.', dl: 'Скачати програму',
    pause: 'Пауза', resume: 'Продовжити', isPaused: 'На паузі — нічого не рахується', save: 'Зберегти сесію', saveAsk: 'Як назвати сесію?', sessDefault: 'Сесія',
    savedTitle: 'Збережені сесії', noSaved: 'Тут з’являться сесії, які ви збережете кнопкою «Зберегти сесію» (тут або на оверлеї).',
    del: 'Видалити', delAsk: 'Видалити сесію «{name}»?', cancel: 'Скасувати', ok: 'Зберегти', savedToast: 'Сесію збережено',
    dur: 'Час', gold: 'Золото', exp: 'Досвід', kills: 'Мобів', items: 'Луту', cards: 'карт', avgDps: 'Сер. DPS', maxHit: 'Макс. удар', mobs: 'Моби', loot: 'Лут', more: 'Детальніше', less: 'Згорнути',
    dealt: 'Нанесено', recv: 'Отримано', heal: 'Лікування', peakDps: 'Пік DPS', accuracy: 'Влучність', level: 'Рівень', on: 'по: ', perSession: 'за сесію', hitsOf: '{hits} з {tries} ударів',
    all: 'Усе', cardsChip: 'Карти', other: 'Інше', totalKilled: 'Усього вбито', kinds: ['вид', 'види', 'видів'], noMobs: 'Мобів не вбито.', noLoot: 'Луту немає.',
    chartTitle: 'Урон за секунду протягом сесії', max: 'макс', start: 'початок', noChart: 'Графік є лише в сесій, збережених після оновлення.',
    imp: 'Імпорт логу чату', impTip: 'Вибрати файл історії чату гри (папка chatlogs) і зберегти його як сесії', fromLog: 'з логу',
    impNote: 'Оверлей не обов’язковий: експортуйте історію вкладки чату в грі («Экспорт истории») або візьміть місячний файл з chatlogs — програма порахує по ньому ту саму статистику. Довгий лог ділиться на сесії там, де була перерва понад 30 хв.',
    impAdded: 'Додано сесій: {n}', impSkipped: 'уже були: {n}', impEmpty: 'У файлі немає бою, луту чи золота', impFail: 'Не вдалося прочитати файл',
  },
  ru: {
    title: 'Статистика боя', sub: 'DPS, золото, опыт и лут поверх игры',
    lead: 'Панель поверх игры, которая считает ваш DPS, поднятое золото, опыт, убитых мобов и весь собранный лут — вживую, пока вы фармите.',
    on: 'Показать оверлей', off: 'Выключить оверлей', isOn: 'Оверлей включён', isOff: 'Оверлей выключен',
    calib: 'Выделить чат', reset: 'Новая сессия', noRegion: 'Покажите программе, где чат: нажмите «Выделить чат», обведите рамкой строки вкладки Stats и нажмите Enter.',
    keysBusy: 'Горячие клавиши Alt+Shift+S / Alt+Shift+R заняты другой программой — пользуйтесь кнопками здесь.',
    setup: 'Как настроить игру', chatCap: 'Настройки вкладки «Stats» в игре', steps: [
      ['Создайте новую вкладку чата', 'Назовите её «Stats» и поставьте галочки точно как на картинке ниже: «Нанесённый урон», «Полученный урон», «Лечение», «Опыт», «Подбор лута», «Прочее» и «Сохранять историю сообщений». Остальное выключите, чтобы другие сообщения не мешали.'],
      ['Зачем история сообщений', 'С галочкой «Сохранять историю сообщений» игра пишет файл chatlogs\\Stats (ГГГГ.ММ).htm, и программа сверяет с ним точные итоги.'],
      ['Покажите, где чат', 'Включите оверлей, обведите мышкой строки сообщений вкладки Stats (без кнопок вкладок) и нажмите Enter.'],
    ],
    shows: 'Что показывает', showsList: ['DPS за последние 10 секунд с графиком', 'Золото и опыт за сессию', 'Сколько и каких мобов убито', 'Весь лут, отдельно карты', 'Нанесённый и полученный урон, лечение, макс. удар, точность'],
    keys: 'Управление', keyRows: [['Alt+Shift+S', 'скрыть / показать панель'], ['Alt+Shift+R', 'заново выделить чат'], ['Заголовок панели', 'перетащить панель']],
    note: 'Игра должна быть в оконном режиме или «окно без рамки». Программа только читает экран и файлы истории чата — в игру не вмешивается, память не читает. Сессия сохраняется между запусками.',
    web: 'Оверлей работает только в программе RQ Tools для Windows.', dl: 'Скачать программу',
    pause: 'Пауза', resume: 'Продолжить', isPaused: 'На паузе — ничего не считается', save: 'Сохранить сессию', saveAsk: 'Как назвать сессию?', sessDefault: 'Сессия',
    savedTitle: 'Сохранённые сессии', noSaved: 'Здесь появятся сессии, которые вы сохраните кнопкой «Сохранить сессию» (здесь или на оверлее).',
    del: 'Удалить', delAsk: 'Удалить сессию «{name}»?', cancel: 'Отмена', ok: 'Сохранить', savedToast: 'Сессия сохранена',
    dur: 'Время', gold: 'Золото', exp: 'Опыт', kills: 'Мобов', items: 'Лута', cards: 'карт', avgDps: 'Ср. DPS', maxHit: 'Макс. удар', mobs: 'Мобы', loot: 'Лут', more: 'Подробнее', less: 'Свернуть',
    dealt: 'Нанесено', recv: 'Получено', heal: 'Лечение', peakDps: 'Пик DPS', accuracy: 'Точность', level: 'Уровень', on: 'по: ', perSession: 'за сессию', hitsOf: '{hits} из {tries} ударов',
    all: 'Все', cardsChip: 'Карты', other: 'Прочее', totalKilled: 'Всего убито', kinds: ['вид', 'вида', 'видов'], noMobs: 'Мобов не убито.', noLoot: 'Лута нет.',
    chartTitle: 'Урон в секунду за сессию', max: 'макс', start: 'начало', noChart: 'График есть только у сессий, сохранённых после обновления.',
    imp: 'Импорт лога чата', impTip: 'Выбрать файл истории чата игры (папка chatlogs) и сохранить его как сессии', fromLog: 'из лога',
    impNote: 'Оверлей не обязателен: экспортируйте историю вкладки чата в игре («Экспорт истории») или возьмите месячный файл из chatlogs — программа посчитает по нему ту же статистику. Длинный лог делится на сессии там, где был перерыв больше 30 мин.',
    impAdded: 'Добавлено сессий: {n}', impSkipped: 'уже были: {n}', impEmpty: 'В файле нет боя, лута или золота', impFail: 'Не удалось прочитать файл',
  },
  en: {
    title: 'Combat stats', sub: 'DPS, gold, exp and loot over the game',
    lead: 'A panel over the game that counts your DPS, gold picked up, exp, mobs killed and all the loot — live, while you farm.',
    on: 'Show the overlay', off: 'Turn the overlay off', isOn: 'Overlay is on', isOff: 'Overlay is off',
    calib: 'Select the chat', reset: 'New session', noRegion: 'Show the app where the chat is: press «Select the chat», draw a frame around the lines of the Stats tab and press Enter.',
    keysBusy: 'The hotkeys Alt+Shift+S / Alt+Shift+R are taken by another program — use the buttons here.',
    setup: 'Setting up the game', chatCap: 'The «Stats» tab settings in the game', steps: [
      ['Create a new chat tab', 'Name it «Stats» and tick exactly what the picture below shows: «Нанесённый урон», «Полученный урон», «Лечение», «Опыт», «Подбор лута», «Прочее» and «Сохранять историю сообщений». Leave the rest off so other messages do not get in the way.'],
      ['Why the message history', 'With «Сохранять историю сообщений» ticked the game writes chatlogs\\Stats (YYYY.MM).htm and the app checks the exact totals against it.'],
      ['Show where the chat is', 'Turn the overlay on, draw a frame around the message lines of the Stats tab (without the tab buttons) and press Enter.'],
    ],
    shows: 'What it shows', showsList: ['DPS over the last 10 seconds with a chart', 'Gold and exp this session', 'How many mobs of each kind were killed', 'All the loot, cards separately', 'Dealt and received damage, healing, max hit, accuracy'],
    keys: 'Controls', keyRows: [['Alt+Shift+S', 'hide / show the panel'], ['Alt+Shift+R', 'select the chat again'], ['Panel title', 'drag the panel']],
    note: 'The game must run in a window or a borderless window. The app only reads the screen and the chat history files — it never touches the game or its memory. The session is kept between starts.',
    web: 'The overlay works only in the RQ Tools app for Windows.', dl: 'Download app',
    pause: 'Pause', resume: 'Continue', isPaused: 'Paused — nothing is counted', save: 'Save the session', saveAsk: 'Name the session', sessDefault: 'Session',
    savedTitle: 'Saved sessions', noSaved: 'Sessions you save with «Save the session» (here or on the overlay) show up here.',
    del: 'Delete', delAsk: 'Delete the session «{name}»?', cancel: 'Cancel', ok: 'Save', savedToast: 'Session saved',
    dur: 'Time', gold: 'Gold', exp: 'Exp', kills: 'Mobs', items: 'Loot', cards: 'cards', avgDps: 'Avg DPS', maxHit: 'Max hit', mobs: 'Mobs', loot: 'Loot', more: 'Details', less: 'Collapse',
    dealt: 'Dealt', recv: 'Received', heal: 'Healing', peakDps: 'Peak DPS', accuracy: 'Accuracy', level: 'Level', on: 'on: ', perSession: 'this session', hitsOf: '{hits} of {tries} hits',
    all: 'All', cardsChip: 'Cards', other: 'Other', totalKilled: 'Killed', kinds: ['kind', 'kinds', 'kinds'], noMobs: 'No mobs killed.', noLoot: 'No loot.',
    chartTitle: 'Damage per second over the session', max: 'max', start: 'start', noChart: 'Only sessions saved after the update have the chart.',
    imp: 'Import a chat log', impTip: 'Pick a chat history file of the game (the chatlogs folder) and save it as sessions', fromLog: 'from log',
    impNote: 'No overlay needed: export a chat tab’s history in the game («Экспорт истории») or take the monthly file from chatlogs — the app counts the same stats from it. A long log is split into sessions where there was a break of over 30 min.',
    impAdded: 'Sessions added: {n}', impSkipped: 'already there: {n}', impEmpty: 'The file has no combat, loot or gold', impFail: 'Could not read the file',
  },
};
const STT = () => STATS_T[lang] || STATS_T.ru;
// the game's chat tab settings window: [label, ticked]; left column, right column, then the two full-width rows
const STATS_CHAT = [
  [['Рупор', 0], ['Локация', 0], ['Рядом', 0], ['Гильдия', 0], ['Группа', 0], ['Шепот', 0], ['Задания', 0], ['Торговый', 0]],
  [['Системные', 0], ['Нанесённый урон', 1], ['Полученный урон', 1], ['Лечение', 1], ['Опыт', 1], ['Подбор лута', 1], ['Прочее', 1], ['Поиск группы', 0]],
  [['Сохранять историю сообщений', 1], ['Отключить показ счетчика', 0]],
];
function statsChatPicture() {
  const cb = ([label, on]) => h('div', { class: 'st-cb' + (on ? ' on' : '') }, h('i'), label);
  return h('figure', { class: 'st-chat' },
    h('div', { class: 'st-chat-cols' }, STATS_CHAT.slice(0, 2).map(col => h('div', null, col.map(cb)))),
    h('div', { class: 'st-chat-wide' }, STATS_CHAT[2].map(cb)),
    h('figcaption', null, STT().chatCap));
}
let statsState = { on: false, hasRegion: true, keys: true, paused: false, sessions: [] };
const statsOpen = new Set(); // saved sessions shown in full

// settings → main.js: on / off and the language; called at start and when the language changes
function statsApply() {
  if (!IS_APP || !window.rqcApp.stats) return;
  window.rqcApp.stats({ on: !!SETTINGS.statsOn, lang });
}
// the language changed: the overlay opens in it next time (it has its own language switch too)
function statsLang() { if (IS_APP && window.rqcApp.stats) window.rqcApp.stats({ lang }); }
function statsSet(on) {
  SETTINGS.statsOn = on; saveSettings();
  window.rqcApp.stats({ on, lang });
}
if (IS_APP && window.rqcApp.onStats) {
  window.rqcApp.onStats(st => {
    // the result of «import a chat log»: open the new sessions and say how it went
    if (st.imported) {
      const r = st.imported, t = STT();
      delete st.imported;
      if (r.error) toast(t.impFail);
      else if (!r.canceled) {
        for (const id of r.ids || []) statsOpen.add(id);
        toast(r.added ? t.impAdded.replace('{n}', r.added) + (r.skipped ? ' · ' + t.impSkipped.replace('{n}', r.skipped) : '')
          : r.skipped ? t.impSkipped.replace('{n}', r.skipped) : t.impEmpty);
      }
    }
    statsState = { ...statsState, ...st };
    // the overlay's own ✕ turned it off
    if (!st.on && SETTINGS.statsOn) { SETTINGS.statsOn = false; saveSettings(); }
    drawStatsTool();
  });
  // app.js (lang) loads after this file: send once the page is ready
  window.addEventListener('DOMContentLoaded', statsApply);
}

function renderStatsTool(el) {
  el.append(h('div', { class: 'st-wrap', id: 'statsWrap' }));
  if (IS_APP && window.rqcApp.stats) window.rqcApp.stats({ action: 'state' });
  drawStatsTool();
}
function drawStatsTool() {
  const el = $('statsWrap');
  if (!el) return;
  const t = STT(), on = IS_APP && statsState.on;
  el.innerHTML = '';
  const ctl = !IS_APP || !window.rqcApp.stats
    ? h('div', { class: 'st-ctl web' }, h('div', { class: 'st-state' }, t.web),
      h('button', { class: 'btn primary', onclick: () => $('btnDownload').click() }, iconEl('download'), t.dl))
    : h('div', { class: 'st-ctl' + (on ? ' on' : '') },
      h('div', { class: 'st-state' + (on && statsState.paused ? ' paused' : '') }, h('i', { class: 'st-dot' }), on ? (statsState.paused ? t.isPaused : t.isOn) : t.isOff),
      h('div', { class: 'st-btns' },
        h('button', { class: 'btn' + (on ? '' : ' primary'), onclick: () => statsSet(!on) }, on ? t.off : t.on),
        on ? h('button', { class: 'btn' + (statsState.paused ? ' primary' : ''), onclick: () => window.rqcApp.stats({ action: 'pause', value: !statsState.paused }) }, statsState.paused ? t.resume : t.pause) : null,
        on ? h('button', { class: 'btn', onclick: statsSaveAsk }, t.save) : null,
        on ? h('button', { class: 'btn', onclick: () => window.rqcApp.stats({ action: 'calibrate' }) }, t.calib) : null,
        on ? h('button', { class: 'btn ghost', onclick: () => window.rqcApp.stats({ action: 'reset' }) }, t.reset) : null),
      on && !statsState.hasRegion ? h('div', { class: 'st-warn' }, t.noRegion) : null,
      on && statsState.keys === false ? h('div', { class: 'st-warn' }, t.keysBusy) : null);
  el.append(
    h('div', { class: 'st-head' }, h('h2', null, t.title), h('p', null, t.lead)),
    ctl,
    h('div', { class: 'st-grid' },
      h('section', { class: 'st-card' }, h('h3', null, t.setup),
        h('ol', { class: 'st-steps' }, t.steps.map(([b, s], i) => h('li', null, h('b', null, b), h('span', null, s), i === 0 ? statsChatPicture() : null)))),
      h('div', { class: 'st-col' },
        h('section', { class: 'st-card' }, h('h3', null, t.shows), h('ul', { class: 'st-list' }, t.showsList.map(s => h('li', null, s)))),
        h('section', { class: 'st-card' }, h('h3', null, t.keys),
          h('div', { class: 'st-keys' }, t.keyRows.map(([k, s]) => h('div', null, h('kbd', null, k), h('span', null, s))))))),
    IS_APP && window.rqcApp.stats ? statsSavedList() : '',
    h('div', { class: 'sn-note st-note' }, t.note));
}

// «Сохранить сессию»: ask for a name (a date by default); the session itself goes on
function statsSaveAsk() {
  const t = STT(), d = new Date(), p = n => String(n).padStart(2, '0');
  const def = `${t.sessDefault} ${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const wrap = h('div', { class: 'modal confirm-wrap' });
  const inp = h('input', { class: 'inp st-name', maxlength: 80, value: def });
  const done = save => {
    wrap.remove();
    if (save) { window.rqcApp.stats({ action: 'save', name: inp.value.trim() || def }); toast(t.savedToast); }
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.preventDefault(); done(false); } });
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) done(false); });
  wrap.append(h('div', { class: 'dialog confirm' },
    h('div', { class: 'confirm-text' }, t.saveAsk), inp,
    h('div', { class: 'confirm-foot' }, h('button', { class: 'btn', onclick: () => done(false) }, t.cancel), h('button', { class: 'btn primary', onclick: () => done(true) }, t.ok))));
  document.body.append(wrap);
  inp.focus(); inp.select();
}

// a saved session in full: the same numbers as the overlay (combat, DPS chart, mobs, loot)
const statsLootCat = new Map(); // session id → 'all' | 'card' | 'other'
const statsIcon = n => h('img', { class: 'st-ic', src: `../stats/overlay/icons/${n}.png`, alt: '', onerror: e => { e.target.remove(); } });
function statsKinds(n) {
  const [one, few, many] = STT().kinds;
  if (lang === 'en') return n === 1 ? one : many;
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
}
function statsSessBody(e) {
  const t = STT();
  const tries = (e.hits || 0) + (e.misses || 0);
  const tile = (icon, label, value, cls, sub) => h('div', { class: 'st-tile' },
    h('small', null, icon ? statsIcon(icon) : null, label), h('b', { class: cls || null }, value), sub ? h('span', null, sub) : null);
  const tiles = h('div', { class: 'st-tiles' },
    tile('sword', t.dealt, statsNum(e.dealt), 'st-dmg'),
    tile('shield', t.recv, statsNum(e.recv), 'st-recv'),
    tile('heal', t.heal, statsNum(e.heal), 'st-heal'),
    tile(null, t.maxHit, statsNum(e.maxHit && e.maxHit.amount), null, e.maxHit && e.maxHit.target ? t.on + e.maxHit.target : null),
    tile(null, t.avgDps, statsNum(e.avgDps), 'st-dmg', t.perSession),
    tile(null, t.peakDps, statsNum(e.peakDps), 'st-dmg'),
    tile(null, t.accuracy, tries ? Math.round(e.hits / tries * 100) + '%' : '—', null, tries ? t.hitsOf.replace('{hits}', statsNum(e.hits)).replace('{tries}', statsNum(tries)) : null),
    tile('level', t.level, e.level ? e.level + (e.levelsGained ? ` (+${e.levelsGained})` : '') : '—'));

  // DPS over the whole session (sessions saved before this was added have no chart)
  const tl = e.timeline && e.timeline.values && e.timeline.values.length ? e.timeline : null;
  let chart;
  if (tl) {
    const v = tl.values, mx = Math.max(...v, 1), w = 300 / v.length;
    const svg = `<svg viewBox="0 0 300 90" preserveAspectRatio="none"><defs><linearGradient id="stBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#b07a0c"/></linearGradient></defs>` +
      v.map((x, i) => { const bh = x / mx * 86; return `<rect x="${(i * w + w * .12).toFixed(2)}" y="${(90 - bh).toFixed(2)}" width="${(w * .76).toFixed(2)}" height="${bh.toFixed(2)}" fill="url(#stBar)"/>`; }).join('') + '</svg>';
    const plot = h('div', { class: 'st-plot' }); plot.innerHTML = svg;
    chart = h('div', { class: 'st-chart' },
      h('div', { class: 'st-chart-h' }, h('span', null, t.chartTitle), h('span', null, t.max + ' ', h('b', null, statsNum(mx)))),
      plot,
      h('div', { class: 'st-chart-x' }, h('span', null, t.start), h('span', null, statsDur(v.length * tl.stepMs))));
  } else chart = h('div', { class: 'st-chart none' }, t.noChart);

  // mobs: like the overlay list, with a bar for each mob's share
  const mobs = e.mobs || [], top = mobs.length ? Math.max(...mobs.map(m => m.count)) : 1;
  const mobBox = h('section', { class: 'st-box' },
    h('div', { class: 'st-box-h' }, h('h4', null, statsIcon('mobs'), t.mobs), h('span', null, t.totalKilled + ' ', h('b', null, statsNum(e.totalKills)), ` · ${mobs.length} ${statsKinds(mobs.length)}`)),
    mobs.length ? h('div', { class: 'st-mlist' }, mobs.map(m => h('div', { class: 'st-row' },
      h('span', { class: 'st-nm' }, statsPic(m.icon, true), m.name), h('b', null, statsNum(m.count)),
      h('i', { class: 'st-share' }, h('i', { style: `width:${(m.count / top * 100).toFixed(1)}%` })))))
      : h('div', { class: 'st-none' }, t.noMobs));

  // loot: all / cards / other, like the overlay chips
  const items = e.items || [], cat = statsLootCat.get(e.id) || 'all';
  const cards = items.filter(i => i.card).length;
  const chip = (k, label, n) => h('button', { class: 'st-chip' + (cat === k ? ' on' : ''), onclick: () => { statsLootCat.set(e.id, k); drawStatsTool(); } }, label, h('span', null, n));
  const shown = items.filter(i => cat === 'all' || (cat === 'card') === !!i.card);
  const lootBox = h('section', { class: 'st-box' },
    h('div', { class: 'st-box-h' }, h('h4', null, statsIcon('loot'), t.loot),
      h('div', { class: 'st-chips' }, chip('all', t.all, items.length), chip('card', t.cardsChip, cards), chip('other', t.other, items.length - cards))),
    shown.length ? h('div', { class: 'st-mlist' }, shown.map(i => h('div', { class: 'st-row' + (i.card ? ' card' : '') },
      h('span', { class: 'st-nm', style: i.rarity && !i.card ? `color:${i.rarity}` : null }, statsPic(i.icon), i.name), h('b', null, '×' + statsNum(i.qty)))))
      : h('div', { class: 'st-none' }, t.noLoot));

  return h('div', { class: 'st-sess-body' }, tiles, chart, h('div', { class: 'st-lists' }, mobBox, lootBox));
}

const statsDur = ms => { const s = Math.floor(ms / 1000), p = n => String(n).padStart(2, '0'); return `${Math.floor(s / 3600)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`; };
const statsNum = n => fmtNum(Math.round(n || 0), 0);
const statsPic = (p, mob) => p ? h('img', { class: 'st-pic' + (mob ? ' mob' : ''), src: '../data/' + p, alt: '', onerror: e => { e.target.style.visibility = 'hidden'; } }) : h('i', { class: 'st-pic none' });
function statsSavedList() {
  const t = STT(), list = statsState.sessions || [];
  const card = e => {
    const open = statsOpen.has(e.id);
    const fact = (label, value) => h('div', { class: 'st-fact' }, h('small', null, label), h('b', null, value));
    return h('div', { class: 'st-sess' + (open ? ' open' : '') },
      h('div', { class: 'st-sess-head', onclick: () => { if (open) statsOpen.delete(e.id); else statsOpen.add(e.id); drawStatsTool(); } },
        h('div', { class: 'st-sess-name' }, h('b', null, e.name),
          e.source === 'chat' ? h('small', { class: 'st-from-log', title: e.file }, h('i', null, t.fromLog), ' ' + e.file) : h('small', null, new Date(e.savedAt).toLocaleString())),
        h('div', { class: 'st-facts' },
          fact(t.dur, statsDur(e.durationMs)), fact(t.gold, statsNum(e.gold)), fact(t.exp, statsNum(e.exp)), fact(t.kills, statsNum(e.totalKills)),
          fact(t.items, statsNum(e.totalItems) + (e.cards ? ` (${e.cards} ${t.cards})` : '')), fact(t.avgDps, statsNum(e.avgDps))),
        h('button', { class: 'btn small ghost danger', title: t.del, onclick: async ev => {
          ev.stopPropagation();
          if (!await confirmBox(t.delAsk.replace('{name}', e.name), { ok: t.del, danger: true })) return;
          window.rqcApp.stats({ action: 'delete', id: e.id });
        } }, '✕')),
      open ? statsSessBody(e) : null);
  };
  return h('section', { class: 'st-card st-saved' },
    h('div', { class: 'st-saved-h' }, h('h3', null, t.savedTitle),
      h('button', { class: 'btn small', title: t.impTip, onclick: () => window.rqcApp.stats({ action: 'import' }) }, t.imp)),
    h('div', { class: 'st-imp-note' }, t.impNote),
    list.length ? h('div', { class: 'st-sess-list' }, list.map(card)) : h('div', { class: 'bs-empty' }, t.noSaved));
}
