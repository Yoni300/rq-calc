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
    setup: 'Як налаштувати гру', steps: [
      ['Окрема вкладка чату', 'У налаштуваннях чату додайте вкладку «Stats» і ввімкніть у ній: «Нанесений урон», «Отриманий урон», «Лікування», «Досвід», «Підбір луту».'],
      ['Історія повідомлень', 'Поставте галочку «Зберігати історію повідомлень» — тоді гра пише файл chatlogs\\Stats (РРРР.ММ).htm, і програма звіряє з ним підсумки.'],
      ['Покажіть, де чат', 'Увімкніть оверлей, обведіть мишкою рядки повідомлень вкладки Stats (без кнопок вкладок) і натисніть Enter.'],
    ],
    shows: 'Що показує', showsList: ['DPS за останні 10 секунд із графіком', 'Золото й досвід за сесію', 'Скільки й яких мобів убито', 'Увесь лут, окремо карти', 'Нанесений і отриманий урон, лікування, макс. удар, влучність'],
    keys: 'Керування', keyRows: [['Alt+Shift+S', 'сховати / показати панель'], ['Alt+Shift+R', 'заново виділити чат'], ['Заголовок панелі', 'перетягнути панель']],
    note: 'Гра має бути у віконному режимі або «вікно без рамки». Програма лише читає екран і файли історії чату — у гру не втручається, пам’ять не читає. Сесія зберігається між запусками.',
    web: 'Оверлей працює лише в програмі RQ Tools для Windows.', dl: 'Скачати програму',
  },
  ru: {
    title: 'Статистика боя', sub: 'DPS, золото, опыт и лут поверх игры',
    lead: 'Панель поверх игры, которая считает ваш DPS, поднятое золото, опыт, убитых мобов и весь собранный лут — вживую, пока вы фармите.',
    on: 'Показать оверлей', off: 'Выключить оверлей', isOn: 'Оверлей включён', isOff: 'Оверлей выключен',
    calib: 'Выделить чат', reset: 'Новая сессия', noRegion: 'Покажите программе, где чат: нажмите «Выделить чат», обведите рамкой строки вкладки Stats и нажмите Enter.',
    keysBusy: 'Горячие клавиши Alt+Shift+S / Alt+Shift+R заняты другой программой — пользуйтесь кнопками здесь.',
    setup: 'Как настроить игру', steps: [
      ['Отдельная вкладка чата', 'В настройках чата добавьте вкладку «Stats» и включите в ней: «Нанесённый урон», «Полученный урон», «Лечение», «Опыт», «Подбор лута».'],
      ['История сообщений', 'Поставьте галочку «Сохранять историю сообщений» — тогда игра пишет файл chatlogs\\Stats (ГГГГ.ММ).htm, и программа сверяет с ним итоги.'],
      ['Покажите, где чат', 'Включите оверлей, обведите мышкой строки сообщений вкладки Stats (без кнопок вкладок) и нажмите Enter.'],
    ],
    shows: 'Что показывает', showsList: ['DPS за последние 10 секунд с графиком', 'Золото и опыт за сессию', 'Сколько и каких мобов убито', 'Весь лут, отдельно карты', 'Нанесённый и полученный урон, лечение, макс. удар, точность'],
    keys: 'Управление', keyRows: [['Alt+Shift+S', 'скрыть / показать панель'], ['Alt+Shift+R', 'заново выделить чат'], ['Заголовок панели', 'перетащить панель']],
    note: 'Игра должна быть в оконном режиме или «окно без рамки». Программа только читает экран и файлы истории чата — в игру не вмешивается, память не читает. Сессия сохраняется между запусками.',
    web: 'Оверлей работает только в программе RQ Tools для Windows.', dl: 'Скачать программу',
  },
  en: {
    title: 'Combat stats', sub: 'DPS, gold, exp and loot over the game',
    lead: 'A panel over the game that counts your DPS, gold picked up, exp, mobs killed and all the loot — live, while you farm.',
    on: 'Show the overlay', off: 'Turn the overlay off', isOn: 'Overlay is on', isOff: 'Overlay is off',
    calib: 'Select the chat', reset: 'New session', noRegion: 'Show the app where the chat is: press «Select the chat», draw a frame around the lines of the Stats tab and press Enter.',
    keysBusy: 'The hotkeys Alt+Shift+S / Alt+Shift+R are taken by another program — use the buttons here.',
    setup: 'Setting up the game', steps: [
      ['A separate chat tab', 'In the chat settings add a «Stats» tab with: dealt damage, received damage, healing, experience, loot pickup.'],
      ['Message history', 'Tick «Save message history» — the game then writes chatlogs\\Stats (YYYY.MM).htm and the app checks the totals against it.'],
      ['Show where the chat is', 'Turn the overlay on, draw a frame around the message lines of the Stats tab (without the tab buttons) and press Enter.'],
    ],
    shows: 'What it shows', showsList: ['DPS over the last 10 seconds with a chart', 'Gold and exp this session', 'How many mobs of each kind were killed', 'All the loot, cards separately', 'Dealt and received damage, healing, max hit, accuracy'],
    keys: 'Controls', keyRows: [['Alt+Shift+S', 'hide / show the panel'], ['Alt+Shift+R', 'select the chat again'], ['Panel title', 'drag the panel']],
    note: 'The game must run in a window or a borderless window. The app only reads the screen and the chat history files — it never touches the game or its memory. The session is kept between starts.',
    web: 'The overlay works only in the RQ Tools app for Windows.', dl: 'Download app',
  },
};
const STT = () => STATS_T[lang] || STATS_T.ru;
let statsState = { on: false, hasRegion: true, keys: true };

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
      h('div', { class: 'st-state' }, h('i', { class: 'st-dot' }), on ? t.isOn : t.isOff),
      h('div', { class: 'st-btns' },
        h('button', { class: 'btn' + (on ? '' : ' primary'), onclick: () => statsSet(!on) }, on ? t.off : t.on),
        on ? h('button', { class: 'btn', onclick: () => window.rqcApp.stats({ action: 'calibrate' }) }, t.calib) : null,
        on ? h('button', { class: 'btn ghost', onclick: () => window.rqcApp.stats({ action: 'reset' }) }, t.reset) : null),
      on && !statsState.hasRegion ? h('div', { class: 'st-warn' }, t.noRegion) : null,
      on && statsState.keys === false ? h('div', { class: 'st-warn' }, t.keysBusy) : null);
  el.append(
    h('div', { class: 'st-head' }, h('h2', null, t.title), h('p', null, t.lead)),
    ctl,
    h('div', { class: 'st-grid' },
      h('section', { class: 'st-card' }, h('h3', null, t.setup),
        h('ol', { class: 'st-steps' }, t.steps.map(([b, s]) => h('li', null, h('b', null, b), h('span', null, s))))),
      h('div', { class: 'st-col' },
        h('section', { class: 'st-card' }, h('h3', null, t.shows), h('ul', { class: 'st-list' }, t.showsList.map(s => h('li', null, s)))),
        h('section', { class: 'st-card' }, h('h3', null, t.keys),
          h('div', { class: 'st-keys' }, t.keyRows.map(([k, s]) => h('div', null, h('kbd', null, k), h('span', null, s))))))),
    h('div', { class: 'sn-note st-note' }, t.note));
}
