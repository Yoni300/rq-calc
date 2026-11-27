'use strict';
/* «Рынок игроков»: players' buy and sell listings for one game server (server/009-player-market.sql).
   A listing is an item set up like in the calculator (upgrade, stamp and its color, cards, personal or not) or a
   card, a price in gold, the character's nickname, an optional Discord name and a short note (010-market-note.sql). Deals happen in the game: the page
   only shows who sells or buys what. The device that posted a listing keeps its secret (localStorage
   rqc.mkMine = [{ id, s, server }]) and only it can renew, reprice or take the listing down.
   Uses globals from app.js at call time (h, img, ctx, T, lang, store, sb, openModal, closeModal, itemTip, …). */

const MARKET_T = {
  ru: {
    title: 'Рынок игроков', sub: 'Купить и продать вещи у игроков',
    all: 'Все', sell: 'Продают', buy: 'Покупают', mine: 'Мои', add: 'Объявление', refresh: 'Обновить',
    search: 'Поиск предмета или карты…', loading: 'Загружаю объявления…', loadErr: 'Не удалось загрузить объявления: {e}',
    noServer: 'Рынок работает только с сервером RQ Tools — здесь он не подключён.',
    empty: 'Объявлений пока нет. Будьте первым: кнопка «Объявление».', emptyQ: 'Ничего не нашлось.',
    pick: 'Выберите предмет слева, чтобы увидеть, кто его продаёт и покупает.',
    sellN: 'Продают', buyN: 'Покупают', from: 'от', upTo: 'до', none: 'никто',
    sellThis: 'Продать такой', buyThis: 'Купить такой',
    copyNick: 'Скопировать ник', nickCopied: 'Ник скопирован — напишите ему в игре', discordCopied: 'Discord скопирован',
    report: 'Пожаловаться', reportAsk: 'Пожаловаться на это объявление? Три жалобы от разных людей скрывают его.', reported: 'Жалоба отправлена',
    my: 'Ваше', personal: 'Персональная', notPersonal: 'Не персональная', qty: 'Количество', pcs: 'шт.',
    ago: 'выставлено {t}', left: 'ещё {t}', expired: 'истекло', hidden: 'скрыто жалобами',
    // add dialog
    addTitle: 'Новое объявление', iSell: 'Продаю', iBuy: 'Покупаю', items: 'Предметы', cards: 'Карты', setup: 'Настройка',
    pickItem: 'Выберите предмет или карту в списке.', price: 'Цена за штуку', pricePh: 'например 150к или 1.5кк', priceIs: '= {v} золота',
    priceBad: 'Укажите цену в золоте', nick: 'Ник персонажа', nickPh: 'как в игре', nickBad: 'Ник: от 2 до 24 символов',
    discord: 'Discord', discordPh: 'необязательно', personalTip: 'Отметьте, если вещь персональная',
    note: 'Заметка', notePh: 'необязательно, например: торг уместен, обмен на карту',
    buyAnyTip: 'Для покупки: заточка, печать и карты — какой вы хотите получить предмет.',
    publish: 'Выставить', cancel: 'Отмена', published: 'Объявление выставлено на 14 дней',
    errLimit: 'У вас уже 30 объявлений — снимите или дождитесь, пока старые закончатся.',
    errFast: 'Слишком много объявлений подряд. Попробуйте через несколько минут.',
    errDup: 'Такое объявление у вас уже есть — измените его цену во вкладке «Мои».', errSend: 'Не удалось выставить: {e}',
    // mine
    mineEmpty: 'Здесь будут ваши объявления с этого устройства.', renew: 'Продлить на 14 дней', renewed: 'Продлено на 14 дней',
    save: 'Сохранить', takeDown: 'Снять', takeDownAsk: 'Снять объявление?', takenDown: 'Объявление снято', saved: 'Сохранено',
    rules: 'Только за игровое золото: продажа вещей за реальные деньги запрещена правилами игры. Сделка проходит в игре — RQ Tools не проверяет игроков, будьте внимательны. Объявление живёт 14 дней, у одного игрока — до 30 объявлений.',
    toList: 'К списку',
    servers: { fenix: 'Феникс', helios: 'Гелиос' },
  },
  uk: {
    title: 'Ринок гравців', sub: 'Купити й продати речі в гравців',
    all: 'Усі', sell: 'Продають', buy: 'Купують', mine: 'Мої', add: 'Оголошення', refresh: 'Оновити',
    search: 'Пошук предмета або карти…', loading: 'Завантажую оголошення…', loadErr: 'Не вдалося завантажити оголошення: {e}',
    noServer: 'Ринок працює лише із сервером RQ Tools — тут він не підключений.',
    empty: 'Оголошень поки немає. Будьте першим: кнопка «Оголошення».', emptyQ: 'Нічого не знайшлося.',
    pick: 'Виберіть предмет ліворуч, щоб побачити, хто його продає й купує.',
    sellN: 'Продають', buyN: 'Купують', from: 'від', upTo: 'до', none: 'ніхто',
    sellThis: 'Продати такий', buyThis: 'Купити такий',
    copyNick: 'Скопіювати нік', nickCopied: 'Нік скопійовано — напишіть йому в грі', discordCopied: 'Discord скопійовано',
    report: 'Поскаржитися', reportAsk: 'Поскаржитися на це оголошення? Три скарги від різних людей ховають його.', reported: 'Скаргу надіслано',
    my: 'Ваше', personal: 'Персональна', notPersonal: 'Не персональна', qty: 'Кількість', pcs: 'шт.',
    ago: 'виставлено {t}', left: 'ще {t}', expired: 'минуло', hidden: 'приховано скаргами',
    addTitle: 'Нове оголошення', iSell: 'Продаю', iBuy: 'Купую', items: 'Предмети', cards: 'Карти', setup: 'Налаштування',
    pickItem: 'Виберіть предмет або карту в списку.', price: 'Ціна за штуку', pricePh: 'наприклад 150к або 1.5кк', priceIs: '= {v} золота',
    priceBad: 'Вкажіть ціну в золоті', nick: 'Нік персонажа', nickPh: 'як у грі', nickBad: 'Нік: від 2 до 24 символів',
    discord: 'Discord', discordPh: 'необов\'язково', personalTip: 'Позначте, якщо річ персональна',
    note: 'Нотатка', notePh: 'необов’язково, наприклад: торг доречний, обмін на карту',
    buyAnyTip: 'Для купівлі: заточка, печатка й карти — яким ви хочете отримати предмет.',
    publish: 'Виставити', cancel: 'Скасувати', published: 'Оголошення виставлено на 14 днів',
    errLimit: 'У вас уже 30 оголошень — зніміть або дочекайтеся, поки старі закінчаться.',
    errFast: 'Забагато оголошень поспіль. Спробуйте за кілька хвилин.',
    errDup: 'Таке оголошення у вас уже є — змініть його ціну у вкладці «Мої».', errSend: 'Не вдалося виставити: {e}',
    mineEmpty: 'Тут будуть ваші оголошення з цього пристрою.', renew: 'Продовжити на 14 днів', renewed: 'Продовжено на 14 днів',
    save: 'Зберегти', takeDown: 'Зняти', takeDownAsk: 'Зняти оголошення?', takenDown: 'Оголошення знято', saved: 'Збережено',
    rules: 'Лише за ігрове золото: продаж речей за реальні гроші заборонений правилами гри. Угода відбувається в грі — RQ Tools не перевіряє гравців, будьте уважні. Оголошення живе 14 днів, в одного гравця — до 30 оголошень.',
    toList: 'До списку',
    servers: { fenix: 'Фенікс', helios: 'Геліос' },
  },
  en: {
    title: 'Player market', sub: 'Buy and sell items between players',
    all: 'All', sell: 'Selling', buy: 'Buying', mine: 'Mine', add: 'New listing', refresh: 'Refresh',
    search: 'Search an item or a card…', loading: 'Loading listings…', loadErr: 'Could not load the listings: {e}',
    noServer: 'The market needs the RQ Tools server, which is not connected here.',
    empty: 'No listings yet. Be the first: the «New listing» button.', emptyQ: 'Nothing found.',
    pick: 'Pick an item on the left to see who sells and who buys it.',
    sellN: 'Selling', buyN: 'Buying', from: 'from', upTo: 'up to', none: 'nobody',
    sellThis: 'Sell one', buyThis: 'Buy one',
    copyNick: 'Copy nickname', nickCopied: 'Nickname copied — message them in the game', discordCopied: 'Discord copied',
    report: 'Report', reportAsk: 'Report this listing? Three reports from different people hide it.', reported: 'Report sent',
    my: 'Yours', personal: 'Personal', notPersonal: 'Not personal', qty: 'Count', pcs: 'pcs',
    ago: 'listed {t}', left: '{t} left', expired: 'expired', hidden: 'hidden by reports',
    addTitle: 'New listing', iSell: 'I sell', iBuy: 'I buy', items: 'Items', cards: 'Cards', setup: 'Setup',
    pickItem: 'Pick an item or a card in the list.', price: 'Price per piece', pricePh: 'e.g. 150k or 1.5kk', priceIs: '= {v} gold',
    priceBad: 'Enter the price in gold', nick: 'Character name', nickPh: 'as in the game', nickBad: 'Name: 2 to 24 characters',
    discord: 'Discord', discordPh: 'optional', personalTip: 'Tick it if the item is personal',
    note: 'Note', notePh: 'optional, e.g. open to offers, trade for a card',
    buyAnyTip: 'When buying: the upgrade, stamp and cards are how you want the item to be.',
    publish: 'Post', cancel: 'Cancel', published: 'Listing posted for 14 days',
    errLimit: 'You already have 30 listings: take some down or wait until old ones end.',
    errFast: 'Too many listings in a row. Try again in a few minutes.',
    errDup: 'You already have this listing: change its price on the «Mine» tab.', errSend: 'Could not post: {e}',
    mineEmpty: 'Your listings from this device appear here.', renew: 'Renew for 14 days', renewed: 'Renewed for 14 days',
    save: 'Save', takeDown: 'Take down', takeDownAsk: 'Take the listing down?', takenDown: 'Listing taken down', saved: 'Saved',
    rules: 'In-game gold only: selling items for real money is against the game rules. The deal happens in the game; RQ Tools does not check players, so be careful. A listing lives 14 days, one player can have up to 30.',
    toList: 'Back to the list',
    servers: { fenix: 'Fenix', helios: 'Helios' },
  },
};
const MKX = () => MARKET_T[lang] || MARKET_T.ru;

const MK_SERVERS = ['fenix', 'helios'];
// bget (bosses.js): app.js and its `store` load after this file
const MK = {
  server: MK_SERVERS.includes(bget('mkServer', '')) ? bget('mkServer', '') : (MK_SERVERS.includes(bget('settings', {}).cardServer) ? bget('settings', {}).cardServer : 'fenix'),
  view: bget('mkView', 'all'), q: '', sel: null, pane: 'list', // pane: phones show the list or one item
  lots: [], at: 0, loading: false, err: '',
  mine: bget('mkMine', []), mineRows: null, mineLoading: false,
};
const mkSaveMine = () => store.set('mkMine', MK.mine);
const mkMineIds = () => new Set(MK.mine.map(m => m.id));

// ---------- numbers, time ----------
const mkNum = n => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
// 150к, 1.5кк, 2kk, 3ккк, 1,5m, «1 500 000» → gold
function mkParsePrice(s) {
  const m = String(s || '').toLowerCase().replace(/[\s_']/g, '').replace(',', '.').match(/^(\d+(?:\.\d+)?)([kк]{1,3}|[mм]|[bб])?$/);
  if (!m) return null;
  const suf = m[2] || '';
  const mul = /^[mм]$/.test(suf) ? 1e6 : /^[bб]$/.test(suf) ? 1e9 : 10 ** (3 * suf.length);
  const v = Math.round(parseFloat(m[1]) * mul);
  return v >= 1 && v <= 1e12 ? v : null;
}
function mkRel(ms) {
  const rtf = new Intl.RelativeTimeFormat(lang === 'uk' ? 'uk' : lang === 'en' ? 'en' : 'ru', { numeric: 'auto' });
  const s = Math.round(ms / 1000), a = Math.abs(s);
  if (a < 60) return rtf.format(0, 'minute'); // «в эту минуту», not «через 1 минуту» when the clocks differ a little
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
const mkGold = n => h('span', { class: 'mk-gold' }, mkNum(n), h('i', { class: 'mk-coin' }));

// ---------- what a listing is ----------
const mkRef = (kind, id) => (kind === 'card' ? ctx.cards.get(id) : ctx.equipment.get(id)) || null;
const mkKey = (kind, id) => kind + ':' + id;
// the listing as a calculator equipment entry (for itemTip)
const mkEntry = l => ({ itemId: l.item_id, upgrade: l.upgrade || 0, cards: (l.cards || []).map(c => c || null), stampVariantId: l.stamp || undefined });
function mkCardTip(c) {
  const lines = c.bonuses.map(cb => bonusText({ typeId: cb.typeId, vars: cardBonusVarsForDisplay(cb) }));
  return `<div class="tt-item"><div class="tt-title">${tinyIcon(c.imageId)}${esc(c.name)}</div><div class="tt-sub"><span>${esc(cardTypeLabel(c))}</span></div>`
    + `<div class="tt-sec">${lines.map(x => `<div>${esc(x)}</div>`).join('')}</div></div>`;
}
const mkTip = l => {
  const ref = mkRef(l.kind, l.item_id);
  if (!ref) return '';
  return l.kind === 'card' ? mkCardTip(ref) : itemTip(ref, mkEntry(l));
};
const mkSubOf = (kind, ref) => (kind === 'card' ? cardTypeLabel(ref) : `${ctx.eqTypes.get(ref.typeId).name} · ${T.lvl} ${ref.level}`);
// chips under a listing: +upgrade, stamp, cards, personal, count
function mkChips(l) {
  const t = MKX(), out = [];
  if (l.kind === 'item') {
    if (l.upgrade) out.push(h('span', { class: 'chip mk-up' }, '+' + l.upgrade));
    const v = l.stamp && ctx.stampVariants.get(l.stamp);
    if (v) out.push(h('span', { class: 'chip stamp' }, h('i', { class: 'dot', style: `background:${v.color?.Argb || '#999'}` }), ctx.stamps.get(v.stampId).name));
    for (const id of l.cards || []) { const c = id && ctx.cards.get(id); if (c) out.push(h('span', { class: 'chip card' }, c.name)); }
    if (l.personal) out.push(h('span', { class: 'chip mk-pers' }, t.personal));
  }
  if (l.qty > 1) out.push(h('span', { class: 'chip' }, `${l.qty} ${t.pcs}`));
  return out;
}

// ---------- loading ----------
async function mkLoad() {
  if (!sbConfigured()) return;
  MK.loading = true; MK.err = ''; mkDrawBody();
  const server = MK.server;
  try {
    const rows = await sb('rpc/market_board', { method: 'POST', body: JSON.stringify({ p_server: server }) });
    if (server !== MK.server) return;
    MK.lots = (rows || []).filter(l => mkRef(l.kind, l.item_id));
    MK.at = Date.now();
  } catch (e) { MK.err = String(e.message || e); }
  MK.loading = false; mkDrawBody();
}
async function mkLoadMine() {
  if (!sbConfigured() || !MK.mine.length) { MK.mineRows = []; mkDrawBody(); return; }
  MK.mineLoading = true; mkDrawBody();
  try {
    const rows = await sb('rpc/market_mine', { method: 'POST', body: JSON.stringify({ p_ids: MK.mine.map(m => m.id), p_secrets: MK.mine.map(m => m.s) }) });
    MK.mineRows = (rows || []).filter(l => mkRef(l.kind, l.item_id));
    // the server deleted listings that ended long ago: forget them here too
    const alive = new Set((rows || []).map(r => r.id));
    if (MK.mine.some(m => !alive.has(m.id))) { MK.mine = MK.mine.filter(m => alive.has(m.id)); mkSaveMine(); }
  } catch (e) { MK.err = String(e.message || e); }
  MK.mineLoading = false; mkDrawBody();
}
const mkErrText = e => {
  const t = MKX(), s = String(e && e.message || e);
  if (/too many listings/.test(s)) return t.errLimit;
  if (/too fast/.test(s)) return t.errFast;
  if (/duplicate/.test(s)) return t.errDup;
  return t.errSend.replace('{e}', s.replace(/^\d+: /, '').slice(0, 160));
};

// ---------- the page ----------
function renderMarket(el) {
  const t = MKX();
  const seg = (items, cur, on) => h('div', { class: 'seg' }, items.map(([v, label]) => h('button', { class: v === cur ? 'on' : '', onclick: () => on(v) }, label)));
  const search = h('input', { class: 'inp', placeholder: t.search, value: MK.q, spellcheck: false });
  search.addEventListener('input', () => { MK.q = search.value; MK.pane = 'list'; mkDrawBody(); });
  el.append(h('div', { class: 'mk-wrap' },
    h('div', { class: 'pb-bar mk-bar' },
      seg(MK_SERVERS.map(s => [s, t.servers[s]]), MK.server, v => { MK.server = v; store.set('mkServer', v); MK.lots = []; MK.at = 0; MK.sel = null; MK.pane = 'list'; renderCenter(); }),
      seg([['all', t.all], ['sell', t.sell], ['buy', t.buy], ['mine', `${t.mine}${MK.mine.length ? ' · ' + MK.mine.length : ''}`]], MK.view,
        v => { MK.view = v; store.set('mkView', v); if (v === 'mine') MK.mineRows = null; renderCenter(); }),
      MK.view === 'mine' ? h('div', { class: 'spacer' }) : search,
      h('button', { class: 'btn', title: t.refresh, onclick: () => (MK.view === 'mine' ? mkLoadMine() : mkLoad()) }, '⟳'),
      sbConfigured() ? h('button', { class: 'btn primary', onclick: () => openMarketAdd() }, '+ ' + t.add) : null),
    h('div', { id: 'mkBody' }),
    h('div', { class: 'note mk-rules' }, t.rules)));
  mkDrawBody();
  if (!sbConfigured()) return;
  if (MK.view === 'mine') { if (!MK.mineRows && !MK.mineLoading) mkLoadMine(); }
  else if (!MK.loading && Date.now() - MK.at > 60000) mkLoad();
}

// items that have listings: [{ key, kind, id, ref, sell: [...], buy: [...], last }]
function mkGroups() {
  const map = new Map();
  for (const l of MK.lots) {
    const key = mkKey(l.kind, l.item_id);
    let g = map.get(key);
    if (!g) map.set(key, g = { key, kind: l.kind, id: l.item_id, ref: mkRef(l.kind, l.item_id), sell: [], buy: [], last: 0 });
    g[l.side].push(l);
    g.last = Math.max(g.last, Date.parse(l.created_at));
  }
  for (const g of map.values()) { g.sell.sort((a, b) => a.price - b.price); g.buy.sort((a, b) => b.price - a.price); }
  return [...map.values()].sort((a, b) => b.last - a.last);
}

function mkDrawBody() {
  const body = $('mkBody'); if (!body) return;
  const t = MKX();
  body.innerHTML = '';
  if (!sbConfigured()) { body.append(h('div', { class: 'hint mk-empty' }, t.noServer)); return; }
  if (MK.view === 'mine') { mkDrawMine(body); return; }
  if (MK.err && !MK.lots.length) { body.append(h('div', { class: 'hint mk-empty' }, t.loadErr.replace('{e}', MK.err))); return; }
  if (MK.loading && !MK.lots.length) { body.append(h('div', { class: 'hint mk-empty' }, t.loading)); return; }
  let groups = mkGroups();
  if (MK.view !== 'all') groups = groups.filter(g => g[MK.view].length);
  if (MK.q) groups = groups.filter(g => matches(MK.q, g.ref.name, mkSubOf(g.kind, g.ref)));
  if (!groups.length) { body.append(h('div', { class: 'hint mk-empty' }, MK.lots.length ? t.emptyQ : t.empty)); return; }
  if (!groups.some(g => g.key === MK.sel)) MK.sel = groups[0].key;
  const list = h('div', { class: 'bs-list mk-list' });
  for (const g of groups) {
    const line = (label, arr, best, word) => h('div', { class: 'mk-line' + (arr.length ? '' : ' off') }, `${label}: `,
      arr.length ? [h('b', null, arr.length), ` · ${word} `, mkGold(best)] : t.none);
    list.append(h('div', { class: 'bs-row mk-row' + (g.key === MK.sel ? ' on' : ''), onclick: () => { MK.sel = g.key; MK.pane = 'view'; mkDrawBody(); window.scrollTo(0, 0); } },
      img(g.ref.imageId),
      h('div', { class: 'mk-row-t' },
        h('div', { class: 'mk-name' }, g.ref.name),
        MK.view !== 'buy' ? line(t.sellN, g.sell, g.sell[0]?.price, t.from) : null,
        MK.view !== 'sell' ? line(t.buyN, g.buy, g.buy[0]?.price, t.upTo) : null)));
  }
  const g = groups.find(x => x.key === MK.sel);
  body.append(h('div', { class: 'bs-wrap mk-grid' + (MK.pane === 'view' ? ' view' : '') }, list, h('div', { class: 'bs-detail mk-detail' }, mkDetail(g))));
}

function mkDetail(g) {
  const t = MKX();
  const mine = mkMineIds();
  const lotRow = l => h('div', { class: 'mk-lot' + (mine.has(l.id) ? ' mine' : ''), tip: () => mkTip(l) },
    h('div', { class: 'mk-lot-main' },
      h('div', { class: 'mk-price' }, mkGold(l.price)),
      h('div', { class: 'mk-chips' }, mkChips(l)),
      l.note ? h('div', { class: 'mk-note' }, l.note) : null),
    h('div', { class: 'mk-who' },
      h('button', { class: 'mk-nick', title: t.copyNick, onclick: () => copyText(l.nick, t.nickCopied) }, l.nick, h('span', { class: 'bt-copy' }, '⧉')),
      l.discord ? h('button', { class: 'mk-discord', title: 'Discord', onclick: () => copyText(l.discord, t.discordCopied) }, 'Discord: ', h('b', null, l.discord)) : null,
      h('div', { class: 'mk-meta' }, t.ago.replace('{t}', mkRel(Date.parse(l.created_at) - Date.now()))),
      mine.has(l.id) ? h('span', { class: 'mk-badge' }, t.my)
        : h('button', { class: 'mk-report', title: t.report, onclick: () => mkReport(l) }, '⚑')));
  const side = (title, arr) => h('div', { class: 'mk-side' },
    h('h4', null, title, h('span', { class: 'mk-count' }, arr.length)),
    arr.length ? arr.map(lotRow) : h('div', { class: 'hint' }, t.none));
  return [
    h('button', { class: 'btn small ghost bs-tolist mk-tolist', onclick: () => { MK.pane = 'list'; mkDrawBody(); } }, '☰ ' + t.toList),
    h('div', { class: 'mk-head' }, img(g.ref.imageId),
      h('div', null, h('div', { class: 'mk-head-nm' }, g.ref.name), h('div', { class: 'mk-head-sub' }, mkSubOf(g.kind, g.ref))),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn small', onclick: () => openMarketAdd({ side: 'sell', kind: g.kind, id: g.id }) }, t.sellThis),
      h('button', { class: 'btn small', onclick: () => openMarketAdd({ side: 'buy', kind: g.kind, id: g.id }) }, t.buyThis)),
    h('div', { class: 'mk-sides' },
      MK.view !== 'buy' ? side(t.sellN, g.sell) : null,
      MK.view !== 'sell' ? side(t.buyN, g.buy) : null),
  ];
}

async function mkReport(l) {
  const t = MKX();
  if (!(await confirmBox(t.reportAsk, { ok: t.report, danger: true }))) return;
  try { await sb('rpc/market_report', { method: 'POST', body: JSON.stringify({ p_id: l.id }) }); toast(t.reported); }
  catch (e) { toast(String(e.message || e).slice(0, 120)); }
}

// ---------- my listings ----------
function mkDrawMine(body) {
  const t = MKX();
  if (MK.mineLoading && !MK.mineRows) { body.append(h('div', { class: 'hint mk-empty' }, t.loading)); return; }
  const rows = (MK.mineRows || []).slice().sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!rows.length) { body.append(h('div', { class: 'hint mk-empty' }, t.mineEmpty)); return; }
  const edit = async (l, args, msg) => {
    const key = MK.mine.find(m => m.id === l.id);
    if (!key) return;
    try {
      await sb('rpc/market_edit', { method: 'POST', body: JSON.stringify({ p_id: l.id, p_secret: key.s, p_price: null, p_qty: null, p_renew: false, p_delete: false, ...args }) });
      if (args.p_delete) { MK.mine = MK.mine.filter(m => m.id !== l.id); mkSaveMine(); }
      toast(msg); MK.at = 0; mkLoadMine();
    } catch (e) { toast(mkErrText(e)); }
  };
  const list = h('div', { class: 'mk-mine' });
  for (const l of rows) {
    const ref = mkRef(l.kind, l.item_id);
    const left = Date.parse(l.expires_at) - Date.now();
    const price = h('input', { class: 'inp mk-price-in', value: mkNum(l.price), spellcheck: false });
    const note = h('input', { class: 'inp mk-note-in', value: l.note || '', placeholder: t.note, maxLength: 120, spellcheck: false });
    const status = l.hidden ? h('span', { class: 'mk-st bad' }, t.hidden)
      : left <= 0 ? h('span', { class: 'mk-st bad' }, t.expired)
      : h('span', { class: 'mk-st' }, t.left.replace('{t}', mkRel(left).replace(/^(через|за|in) /, '')));
    list.append(h('div', { class: 'mk-mine-row', tip: () => mkTip(l) },
      img(ref.imageId),
      h('div', { class: 'mk-mine-t' },
        h('div', { class: 'mk-name' }, ref.name),
        h('div', { class: 'mk-chips' }, h('span', { class: 'chip mk-side-' + l.side }, l.side === 'sell' ? t.iSell : t.iBuy),
          h('span', { class: 'chip' }, t.servers[l.server] || l.server), mkChips(l)),
        h('div', { class: 'mk-meta' }, l.nick, l.discord ? ' · Discord ' + l.discord : '', ' · ', status)),
      h('div', { class: 'mk-mine-a' },
        h('div', { class: 'mk-price-edit' }, note, price, h('button', { class: 'btn small', onclick: () => {
          const v = mkParsePrice(price.value);
          if (!v) { toast(t.priceBad); return; }
          edit(l, { p_price: v, p_note: note.value.trim() }, t.saved);
        } }, t.save)),
        h('div', { class: 'mk-mine-btns' },
          h('button', { class: 'btn small', onclick: () => edit(l, { p_renew: true }, t.renewed) }, t.renew),
          h('button', { class: 'btn small danger', onclick: async () => { if (await confirmBox(t.takeDownAsk, { ok: t.takeDown, danger: true })) edit(l, { p_delete: true }, t.takenDown); } }, t.takeDown)))));
  }
  body.append(list);
}

// ---------- new listing ----------
let MKD = null; // the draft in the open dialog
function openMarketAdd(pre = {}) {
  const t = MKX();
  MKD = {
    side: pre.side || 'sell', kind: pre.kind || 'item', id: pre.id || null, server: MK.server,
    upgrade: 0, stamp: null, cards: [], personal: false, qty: 1, price: '',
    nick: store.get('mkNick', '') || store.get('bossNick', ''), discord: store.get('mkDiscord', ''), note: '',
    listKind: pre.kind || 'item', q: '', pane: pre.id ? 'detail' : 'list',
  };
  if (MKD.id) mkPick(MKD.kind, MKD.id, true);
  const search = h('input', { class: 'inp', placeholder: T.search, spellcheck: false });
  search.addEventListener('input', () => { MKD.q = search.value; mkDrawAddList(); });
  const pane = p => {
    MKD.pane = p;
    const d = document.querySelector('.dialog.mk-add');
    if (!d) return;
    d.classList.toggle('ed-detail', p === 'detail');
    d.querySelectorAll('.ed-switch button').forEach((b, i) => b.classList.toggle('on', (i === 1) === (p === 'detail')));
  };
  MKD.setPane = pane;
  openModal(h('div', { class: 'dialog ed mk-add' + (MKD.pane === 'detail' ? ' ed-detail' : '') },
    h('div', { class: 'dialog-head' }, h('h3', null, t.addTitle), h('button', { class: 'btn small ghost', onclick: closeModal }, '✕')),
    h('div', { class: 'seg ed-switch' },
      h('button', { class: MKD.pane === 'list' ? 'on' : '', onclick: () => pane('list') }, t.items + ' / ' + t.cards),
      h('button', { class: MKD.pane === 'detail' ? 'on' : '', onclick: () => pane('detail') }, t.setup)),
    h('div', { class: 'dialog-body' },
      h('div', { class: 'picker' },
        h('div', { class: 'seg mk-kind', id: 'mkKind' }),
        search, h('div', { class: 'list', id: 'mkAddList' })),
      h('div', { class: 'detail', id: 'mkAddDetail' })),
    h('div', { class: 'dialog-foot' },
      h('div', { class: 'mk-foot-note' }, t.rules),
      h('button', { class: 'btn', onclick: closeModal }, t.cancel),
      h('button', { class: 'btn primary', id: 'mkPublish', onclick: mkPublish }, t.publish))));
  mkDrawAddList(); mkDrawAddDetail();
  setTimeout(() => { if (!matchMedia('(hover: none)').matches) search.focus(); document.querySelector('#mkAddList .li.on')?.scrollIntoView({ block: 'center' }); }, 0);
}
function mkPick(kind, id, keep = false) {
  const ref = mkRef(kind, id);
  if (!ref) return;
  const same = MKD.kind === kind && MKD.id === id;
  MKD.kind = kind; MKD.id = id;
  if (!keep && !same) { MKD.upgrade = 0; MKD.stamp = null; MKD.personal = false; }
  if (kind === 'item') {
    const n = ctx.cardCount(ref);
    MKD.cards = Array.from({ length: n }, (_, i) => (same ? MKD.cards[i] : null) || null);
    if (ref.primaryCardId && n) MKD.cards[0] = ref.primaryCardId;
    MKD.upgrade = clamp(MKD.upgrade, 0, ctx.maxUpgrade(ref));
    if (ctx.slots.get(ctx.eqTypes.get(ref.typeId).slotId).isWeapon == null) { MKD.upgrade = 0; MKD.cards = []; MKD.stamp = null; }
  } else { MKD.cards = []; MKD.upgrade = 0; MKD.stamp = null; MKD.personal = false; }
}
function mkDrawAddList() {
  const list = $('mkAddList'), kindEl = $('mkKind'); if (!list) return;
  const t = MKX();
  kindEl.innerHTML = '';
  for (const [k, label] of [['item', t.items], ['card', t.cards]])
    kindEl.append(h('button', { class: MKD.listKind === k ? 'on' : '', onclick: () => { MKD.listKind = k; mkDrawAddList(); } }, label));
  list.innerHTML = '';
  let rows;
  if (MKD.listKind === 'card') {
    rows = [...ctx.cards.values()].filter(c => c.inVersion && !c.isLegacy && matches(MKD.q, c.name, cardTypeLabel(c)))
      .map(cardOption).sort(cardOrder).map(o => ({ kind: 'card', ref: ctx.cards.get(o.id), sub: o.group, lv: '' }));
  } else {
    rows = [...ctx.equipment.values()].filter(i => i.inVersion && matches(MKD.q, i.name, ctx.eqTypes.get(i.typeId).name))
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'ru'))
      .map(i => ({ kind: 'item', ref: i, sub: ctx.eqTypes.get(i.typeId).name, lv: i.level }));
  }
  if (!rows.length) list.append(h('div', { class: 'hint', style: 'padding:10px' }, T.noItems));
  for (const r of rows.slice(0, 400)) {
    const on = MKD.kind === r.kind && MKD.id === r.ref.id;
    list.append(h('div', { class: 'li' + (on ? ' on' : ''), tip: () => (r.kind === 'card' ? mkCardTip(r.ref) : itemTip(r.ref)),
      onclick: () => { mkPick(r.kind, r.ref.id); mkDrawAddList(); mkDrawAddDetail(); MKD.setPane('detail'); } },
      img(r.ref.imageId), h('div', null, h('div', { class: 't' }, r.ref.name), h('div', { class: 's' }, r.sub)), h('div', { class: 'lv' }, r.lv)));
  }
}
function mkDrawAddDetail() {
  const el = $('mkAddDetail'); if (!el) return;
  const t = MKX();
  el.innerHTML = '';
  const redraw = () => { mkDrawAddDetail(); };
  el.append(h('div', { class: 'mk-sidesel' },
    h('div', { class: 'seg' },
      h('button', { class: MKD.side === 'sell' ? 'on' : '', onclick: () => { MKD.side = 'sell'; redraw(); } }, t.iSell),
      h('button', { class: MKD.side === 'buy' ? 'on' : '', onclick: () => { MKD.side = 'buy'; redraw(); } }, t.iBuy)),
    h('div', { class: 'seg' }, MK_SERVERS.map(s => h('button', { class: MKD.server === s ? 'on' : '', onclick: () => { MKD.server = s; redraw(); } }, t.servers[s])))));
  const ref = MKD.id && mkRef(MKD.kind, MKD.id);
  if (!ref) { el.append(h('div', { class: 'hint' }, t.pickItem)); mkDrawForm(el); return; }
  const e = { itemId: ref.id, upgrade: MKD.upgrade, cards: MKD.cards, stampVariantId: MKD.stamp || undefined };
  const color = MKD.kind === 'item' ? stampColorOf(e) : null;
  el.append(h('div', { class: 'head', tip: () => (MKD.kind === 'card' ? mkCardTip(ref) : itemTip(ref, e)) }, img(ref.imageId), h('div', null,
    h('div', { class: 'nm', style: color ? 'color:' + color : null }, (MKD.upgrade ? `+${MKD.upgrade} ` : '') + ref.name),
    h('div', { class: 'sub' }, mkSubOf(MKD.kind, ref)))));
  if (MKD.kind === 'item') {
    const slot = ctx.slots.get(ctx.eqTypes.get(ref.typeId).slotId);
    if (MKD.side === 'buy' && slot.isWeapon != null) el.append(h('div', { class: 'hint mk-buy-tip' }, t.buyAnyTip));
    if (slot.isWeapon != null) {
      const max = ctx.maxUpgrade(ref);
      el.append(h('h4', null, T.upgrade), h('div', { class: 'upg' },
        Array.from({ length: max + 1 }, (_, i) => h('button', { class: MKD.upgrade === i ? 'on' : '', onclick: () => { MKD.upgrade = i; redraw(); } }, '+' + i))));
      // stamp and its color, as in the calculator; any class's stamp fits any item it is made for
      const stamps = ctx.stampsForItem(ref, ch.classId).filter(s => !s.isLegacy);
      if (stamps.length) {
        const curV = MKD.stamp ? ctx.stampVariants.get(MKD.stamp) : null;
        const variantFor = s => (curV && s.variants.find(v => v.colorId === curV.colorId)) || s.variants[s.variants.length - 1];
        const options = stamps.map(s => { const v = variantFor(s); return { id: s.id, name: s.name, dot: v.color?.Argb, sub: ctx.stampBonuses(v.id, ref).map(bonusText).join('\n') }; });
        const cur = curV ? options.find(o => o.id === curV.stampId) : null;
        el.append(h('h4', null, T.stamp), pickerButton(cur ? { ...cur, dot: curV.color?.Argb, sub: ctx.stampBonuses(curV.id, ref).map(bonusText).join('\n') } : null,
          anchor => openPopover(anchor, options, cur?.id, id => { MKD.stamp = id == null ? null : variantFor(ctx.stamps.get(id)).id; redraw(); })));
        if (curV) {
          el.append(h('div', { class: 'colors' }, ctx.stamps.get(curV.stampId).variants.map(v => h('button', {
            class: v.id === curV.id ? 'on' : '', style: `background:${v.color?.Argb || '#888'}`,
            tip: () => ctx.stampBonuses(v.id, ref).map(bonusText).map(esc).join('\n'),
            onclick: () => { MKD.stamp = v.id; redraw(); },
          }))));
        }
      }
      const n = ctx.cardCount(ref);
      if (n) {
        el.append(h('h4', null, T.cards));
        for (let i = 0; i < n; i++) {
          const fixed = i === 0 && ref.primaryCardId;
          const curId = MKD.cards[i] || null;
          const options = ctx.cardsForItem(ref, i).filter(c => !c.isLegacy || c.id === curId).map(cardOption).sort(cardOrder);
          const curCard = curId ? ctx.cards.get(curId) : null;
          const cur = curCard ? cardOption(curCard) : null;
          if (cur && fixed) cur.name += ` (${T.fixedCard})`;
          el.append(h('div', { class: 'card-row' }, h('div', { class: 'n' }, i + 1),
            h('div', null, pickerButton(cur, fixed ? null : anchor => openPopover(anchor, options, curId, id => { MKD.cards[i] = id; redraw(); })))));
        }
      }
    }
    el.append(h('label', { class: 'check mk-pcheck', title: t.personalTip },
      h('input', { type: 'checkbox', checked: MKD.personal, onchange: ev => { MKD.personal = ev.target.checked; } }), t.personal));
  }
  mkDrawForm(el);
}
// price, count, nickname, Discord
function mkDrawForm(el) {
  const t = MKX();
  const priceOut = h('span', { class: 'mk-price-out' });
  const showPrice = () => {
    const v = mkParsePrice(MKD.price);
    priceOut.textContent = v ? t.priceIs.replace('{v}', mkNum(v)) : (MKD.price ? t.priceBad : '');
    priceOut.classList.toggle('bad', !!MKD.price && !v);
  };
  const price = h('input', { class: 'inp', placeholder: t.pricePh, value: MKD.price, spellcheck: false, inputMode: 'decimal' });
  price.addEventListener('input', () => { MKD.price = price.value; showPrice(); });
  const qty = h('input', { class: 'inp mk-qty', type: 'number', min: 1, max: 9999, value: MKD.qty });
  qty.addEventListener('input', () => { MKD.qty = clamp(Math.round(+qty.value || 1), 1, 9999); });
  const nick = h('input', { class: 'inp', placeholder: t.nickPh, value: MKD.nick, maxLength: 24, spellcheck: false });
  nick.addEventListener('input', () => { MKD.nick = nick.value; });
  const discord = h('input', { class: 'inp', placeholder: t.discordPh, value: MKD.discord, maxLength: 40, spellcheck: false });
  discord.addEventListener('input', () => { MKD.discord = discord.value; });
  const note = h('input', { class: 'inp', placeholder: t.notePh, value: MKD.note, maxLength: 120, spellcheck: false });
  note.addEventListener('input', () => { MKD.note = note.value; });
  showPrice();
  el.append(h('div', { class: 'mk-form' },
    h('div', { class: 'field' }, h('label', null, t.price), h('div', null, price, priceOut)),
    h('div', { class: 'field' }, h('label', null, t.qty), qty),
    h('div', { class: 'field' }, h('label', null, t.nick), nick),
    h('div', { class: 'field' }, h('label', null, t.discord), discord),
    h('div', { class: 'field' }, h('label', null, t.note), note)));
}
async function mkPublish() {
  const t = MKX();
  if (!MKD || !MKD.id) { toast(t.pickItem); return; }
  const price = mkParsePrice(MKD.price);
  if (!price) { toast(t.priceBad); return; }
  const nick = MKD.nick.trim();
  if (nick.length < 2 || nick.length > 24) { toast(t.nickBad); return; }
  const discord = MKD.discord.trim();
  store.set('mkNick', nick); store.set('mkDiscord', discord);
  const secret = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
  const btn = $('mkPublish'); if (btn) btn.disabled = true;
  const item = MKD.kind === 'item';
  try {
    const r = await sb('rpc/market_add', { method: 'POST', body: JSON.stringify({
      p_server: MKD.server, p_side: MKD.side, p_kind: MKD.kind, p_item: MKD.id,
      p_upgrade: item ? MKD.upgrade : 0, p_stamp: item ? MKD.stamp : null,
      p_cards: item ? MKD.cards.map(c => c || 0) : [], p_personal: item ? MKD.personal : false,
      p_qty: MKD.qty, p_price: price, p_nick: nick, p_discord: discord || null, p_secret: secret, p_note: MKD.note.trim() || null,
    }) });
    MK.mine.push({ id: r.id, s: secret, server: MKD.server }); mkSaveMine();
    toast(t.published);
    // show the new listing on its server's board
    if (MK.server !== MKD.server) { MK.server = MKD.server; store.set('mkServer', MK.server); MK.lots = []; }
    MK.sel = mkKey(MKD.kind, MKD.id); MK.mineRows = null;
    if (MK.view === 'mine') { MK.view = 'all'; store.set('mkView', 'all'); }
    MK.at = 0;
    closeModal(); // re-renders the page, which loads the board
    if (window.rqcTrack) window.rqcTrack('market-add');
  } catch (e) { toast(mkErrText(e)); if (btn) btn.disabled = false; }
}
