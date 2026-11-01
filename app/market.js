/* Market prices. The installed app's scanner (market-scan.js) reads the in-game market from the screen and sends
   "item · price" to Supabase (server/008-market.sql); the site and the app show the latest and usual prices and a
   history chart. Items, names and icons: data/market-items.js (tools/update-market-items.mjs, from the wiki).
   Uses globals from app.js / builds.js / bosses.js at call time (h, T, tab, store, sb, toast, locale, fmtAgo…). */

const MARKET_T = {
  uk: {
    title: 'Ринок', sub: 'Ціни з ринку гри: карти, трофеї, розхідники, покращення', server: 'Сервер', pickServer: 'Оберіть сервер, щоб побачити ціни.',
    cats: { all: 'Усе', card: 'Карти', trophy: 'Трофеї', consumable: 'Розхідники', upgrade: 'Покращення' },
    now: 'Зараз', usual: 'Звичайна (7 днів)', npc: 'Торговцю', noData: 'Ще ніхто не сканував', updated: 'Оновлено',
    empty: 'Цін поки немає. Їх збирає сканер у програмі RQ Tools: увімкніть його і погортайте ринок у грі.', emptySearch: 'Нічого не знайдено',
    history: 'Ціна за днями', low: 'найнижча', med: 'середня', prices: 'цін',
    scanner: 'Сканер ринку', scanOn: 'Увімкнути сканер', scanOff: 'Вимкнути', scanHelp: 'Відкрийте ринок у грі й гортайте сторінки — програма сама читає ціни з екрана і ділиться ними з усіма. Гру вона не чіпає: лише дивиться на екран, як скріншот.',
    st: { off: 'Вимкнено', locating: 'Шукаю вікно ринку на екрані… Відкрийте ринок у грі.', scanning: 'Читаю ринок — гортайте сторінки', error: 'Помилка' },
    noOcr: 'У Windows немає розпізнавання тексту російською. Параметри → Час і мова → Мова → додайте «Русский».',
    pages: 'Сторінок', sent: 'Надіслано цін', needServer: 'Спершу оберіть сервер', webOnly: 'Сканер працює лише в програмі RQ Tools на ПК.',
    refresh: 'Оновити',
  },
  ru: {
    title: 'Рынок', sub: 'Цены с рынка игры: карты, трофеи, расходники, улучшение', server: 'Сервер', pickServer: 'Выберите сервер, чтобы увидеть цены.',
    cats: { all: 'Всё', card: 'Карты', trophy: 'Трофеи', consumable: 'Расходники', upgrade: 'Улучшение' },
    now: 'Сейчас', usual: 'Обычная (7 дней)', npc: 'Торговцу', noData: 'Ещё никто не сканировал', updated: 'Обновлено',
    empty: 'Цен пока нет. Их собирает сканер в программе RQ Tools: включите его и полистайте рынок в игре.', emptySearch: 'Ничего не найдено',
    history: 'Цена по дням', low: 'самая низкая', med: 'средняя', prices: 'цен',
    scanner: 'Сканер рынка', scanOn: 'Включить сканер', scanOff: 'Выключить', scanHelp: 'Откройте рынок в игре и листайте страницы — программа сама читает цены с экрана и делится ими со всеми. Игру она не трогает: только смотрит на экран, как скриншот.',
    st: { off: 'Выключено', locating: 'Ищу окно рынка на экране… Откройте рынок в игре.', scanning: 'Читаю рынок — листайте страницы', error: 'Ошибка' },
    noOcr: 'В Windows нет распознавания текста на русском. Параметры → Время и язык → Язык → добавьте «Русский».',
    pages: 'Страниц', sent: 'Отправлено цен', needServer: 'Сначала выберите сервер', webOnly: 'Сканер работает только в программе RQ Tools на ПК.',
    refresh: 'Обновить',
  },
  en: {
    title: 'Market', sub: 'In-game market prices: cards, trophies, consumables, upgrades', server: 'Server', pickServer: 'Choose a server to see prices.',
    cats: { all: 'All', card: 'Cards', trophy: 'Trophies', consumable: 'Consumables', upgrade: 'Upgrade' },
    now: 'Now', usual: 'Usual (7 days)', npc: 'Vendor', noData: 'Nobody has scanned it yet', updated: 'Updated',
    empty: 'No prices yet. The scanner in the RQ Tools app collects them: turn it on and page through the market in the game.', emptySearch: 'Nothing found',
    history: 'Price by day', low: 'lowest', med: 'median', prices: 'prices',
    scanner: 'Market scanner', scanOn: 'Turn the scanner on', scanOff: 'Turn off', scanHelp: 'Open the market in the game and turn the pages — the app reads the prices from the screen and shares them with everyone. It never touches the game: it only looks at the screen, like a screenshot.',
    st: { off: 'Off', locating: 'Looking for the market window… Open the market in the game.', scanning: 'Reading the market — turn the pages', error: 'Error' },
    noOcr: 'Windows has no Russian text recognition. Settings → Time & language → Language → add "Русский".',
    pages: 'Pages', sent: 'Prices sent', needServer: 'Choose a server first', webOnly: 'The scanner works only in the RQ Tools app on a PC.',
    refresh: 'Refresh',
  },
};
const MT = () => MARKET_T[lang] || MARKET_T.ru;
const MK_SERVERS = [['fenix', 'Fenix'], ['helios', 'Helios'], ['solus', 'Solus']];
const MI = window.RQ_MARKET_ITEMS || [];
const MI_BY = new Map(MI.map(i => [i.id, i]));
const MI_IMG = id => `../data/market-img/${id}.png`;
const mget = (k, def) => { try { const v = localStorage.getItem('rqc.' + k); return v == null ? def : JSON.parse(v); } catch { return def; } };
const MK = {
  server: mget('marketServer', null), cat: mget('marketCat', 'all'), q: '', sel: mget('marketSel', null),
  sum: null, sumServer: null, loadedAt: 0, loading: false, err: null, hist: new Map(),
  scan: { state: 'off', info: null, pages: 0, sent: 0, last: null },
};
const gold = v => (v == null ? '—' : Math.round(v).toLocaleString(locale()));

async function loadMarket(force) {
  if (!MK.server || !sbConfigured() || MK.loading) return;
  if (!force && MK.sumServer === MK.server && Date.now() - MK.loadedAt < 60e3) return;
  MK.loading = true;
  try {
    const rows = await sb('rpc/market_summary', { method: 'POST', body: JSON.stringify({ p_server: MK.server }) });
    MK.sum = new Map((rows || []).map(r => [r.item, r])); MK.sumServer = MK.server; MK.loadedAt = Date.now(); MK.err = null;
  } catch (e) { MK.err = e.message; }
  MK.loading = false;
  if (tab === 'market') { drawMarketList(); drawMarketDetail(); }
}

function renderMarket(el) {
  const t = MT();
  const seg = (items, cur, on) => h('div', { class: 'seg' }, items.map(([v, label]) => h('button', { class: v === cur ? 'on' : '', onclick: () => on(v) }, label)));
  const search = h('input', { class: 'inp', placeholder: T.search, value: MK.q, spellcheck: false });
  search.addEventListener('input', () => { MK.q = search.value; drawMarketList(); });
  el.append(h('div', { class: 'pb-bar' },
    h('span', { class: 'mk-l' }, t.server), seg(MK_SERVERS, MK.server, v => { MK.server = v; store.set('marketServer', v); MK.hist.clear(); renderCenter(); loadMarket(true); }),
    seg(Object.entries(t.cats), MK.cat, v => { MK.cat = v; store.set('marketCat', v); renderCenter(); }),
    search,
    h('button', { class: 'btn', title: t.refresh, onclick: () => loadMarket(true) }, '⟳')));
  if (window.rqcApp && window.rqcApp.marketScan) el.append(h('div', { id: 'marketScan' }));
  else el.append(h('div', { class: 'note mk-web' }, t.webOnly)); // the site only shows what the app's scanners collected
  el.append(h('div', { class: 'mk-wrap' }, h('div', { class: 'mk-list', id: 'marketList' }), h('div', { class: 'mk-detail', id: 'marketDetail' })));
  el.append(h('div', { class: 'note bt-src' }, MI.length + ' · royalquest.info'));
  drawMarketScan(); drawMarketList(); drawMarketDetail();
  loadMarket();
}

function drawMarketScan() {
  const box = document.getElementById('marketScan');
  if (!box) return;
  const t = MT(), S = MK.scan, on = S.state !== 'off' && S.state !== 'error';
  box.className = 'mk-scan' + (on ? ' on' : '');
  box.innerHTML = '';
  box.append(...[
    h('div', { class: 'mk-scan-head' }, h('b', null, t.scanner),
      h('span', { class: 'mk-dot ' + S.state }), h('span', { class: 'mk-st' }, S.state === 'error' && S.info === 'no-ru-ocr' ? t.noOcr : t.st[S.state] + (S.state === 'error' && S.info ? ': ' + S.info : '')),
      h('div', { class: 'spacer' }),
      on ? h('span', { class: 'mk-cnt' }, `${t.pages}: ${S.pages} · ${t.sent}: ${S.sent}`) : null,
      h('button', { class: 'btn small' + (on ? '' : ' primary'), onclick: () => {
        if (!on && !MK.server) { toast(t.needServer); return; }
        window.rqcApp.marketScan(!on);
        if (!on) { S.pages = 0; S.sent = 0; S.last = null; }
      } }, on ? t.scanOff : t.scanOn)),
    on ? null : h('div', { class: 'note' }, t.scanHelp),
    S.last ? h('div', { class: 'mk-last' }, S.last.rows.map(r => h('span', null, h('img', { src: MI_IMG(r.id), draggable: 'false' }), r.name, ' ', h('b', null, priceEl(r.price))))) : null].filter(Boolean));
}

function drawMarketList() {
  const el = document.getElementById('marketList');
  if (!el) return;
  const t = MT();
  el.innerHTML = '';
  if (!MK.server) { el.append(h('div', { class: 'mk-empty' }, t.pickServer)); return; }
  const q = normSearch(MK.q.trim());
  let list = MI.filter(i => (MK.cat === 'all' || i.cat === MK.cat) && (!q || normSearch(i.name).includes(q)));
  const sum = MK.sumServer === MK.server ? MK.sum : null;
  const data = i => sum && sum.get(i.id);
  // without a search only items that have prices, freshest first; with a search everything that matches
  if (!q) list = list.filter(data);
  list.sort((a, b) => (data(b) ? 1 : 0) - (data(a) ? 1 : 0) || (data(b) && data(a) ? new Date(data(b).cur_at) - new Date(data(a).cur_at) : 0) || a.name.localeCompare(b.name, 'ru'));
  if (!list.length) { el.append(h('div', { class: 'mk-empty' }, MK.err ? MK.err : q ? t.emptySearch : t.empty)); return; }
  const now = Date.now();
  for (const i of list.slice(0, 300)) {
    const d = data(i);
    el.append(h('div', { class: 'mk-row' + (MK.sel === i.id ? ' on' : '') + (d ? '' : ' none'), onclick: () => { MK.sel = i.id; store.set('marketSel', i.id); drawMarketList(); drawMarketDetail(); } },
      h('img', { class: 'mk-ic', src: MI_IMG(i.id), loading: 'lazy', draggable: 'false' }),
      h('div', { class: 'mk-name' }, i.name, h('small', null, t.cats[i.cat] + (d ? ' · ' + fmtAgo(now - new Date(d.cur_at)) : ''))),
      h('div', { class: 'mk-price' }, d ? h('b', null, priceEl(d.cur)) : h('span', { class: 'mk-na' }, '—'), d && d.med7 ? h('small', null, '≈ ', priceEl(d.med7)) : null)));
  }
}

async function drawMarketDetail() {
  const el = document.getElementById('marketDetail');
  if (!el) return;
  const t = MT(), i = MI_BY.get(MK.sel);
  el.innerHTML = '';
  if (!i || !MK.server) return;
  const d = MK.sumServer === MK.server && MK.sum ? MK.sum.get(i.id) : null;
  el.append(h('div', { class: 'mk-head' }, h('img', { class: 'mk-big', src: MI_IMG(i.id), draggable: 'false' }),
    h('div', null, h('h3', null, i.name), h('div', { class: 'mk-type' }, [t.cats[i.cat], i.type, i.event].filter(Boolean).join(' · ')))));
  el.append(h('div', { class: 'mk-kv' },
    h('div', null, h('small', null, t.now), h('b', { class: 'gold' }, d ? priceEl(d.cur) : '—'), d ? h('small', null, t.updated + ' ' + fmtAgo(Date.now() - new Date(d.cur_at))) : h('small', null, t.noData)),
    h('div', null, h('small', null, t.usual), h('b', null, d && d.med7 ? priceEl(d.med7) : '—'), d && d.n7 ? h('small', null, d.n7 + ' ' + t.prices) : null),
    h('div', null, h('small', null, t.npc), h('b', null, i.npc ? priceEl(i.npc) : '—'))));
  const chart = h('div', { class: 'mk-chart' });
  el.append(h('h4', null, t.history), chart);
  if (!d) return;
  const key = MK.server + ':' + i.id;
  let hist = MK.hist.get(key);
  if (!hist || Date.now() - hist.at > 120e3) {
    try { hist = { at: Date.now(), rows: await sb('rpc/market_history', { method: 'POST', body: JSON.stringify({ p_server: MK.server, p_item: i.id, p_days: 60 }) }) || [] }; MK.hist.set(key, hist); }
    catch (e) { chart.textContent = e.message; return; }
    if (MK.sel !== i.id) return;
  }
  chart.append(marketChart(hist.rows, t));
}

// daily lowest (gold) and median (pale) price as two lines
function marketChart(rows, t) {
  if (!rows.length) return h('div', { class: 'mk-empty' }, t.noData);
  const W = 600, H = 200, P = { l: 74, r: 10, t: 12, b: 28 };
  const vals = rows.flatMap(r => [r.low, r.med]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo *= 0.9; hi *= 1.1; }
  const x = k => P.l + (rows.length === 1 ? (W - P.l - P.r) / 2 : (k / (rows.length - 1)) * (W - P.l - P.r));
  const y = v => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = f => rows.map((r, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(f(r)).toFixed(1)}`).join(' ');
  const dots = f => rows.map((r, k) => `<circle cx="${x(k).toFixed(1)}" cy="${y(f(r)).toFixed(1)}" r="2.6"><title>${r.day}: ${gold(f(r))}</title></circle>`).join('');
  const day = s => new Date(s + 'T00:00:00Z').toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' });
  const svg = `<svg viewBox="0 0 ${W} ${H}" class="mk-svg" role="img">
    <line x1="${P.l}" x2="${W - P.r}" y1="${y(hi)}" y2="${y(hi)}" class="grid"/><line x1="${P.l}" x2="${W - P.r}" y1="${y(lo)}" y2="${y(lo)}" class="grid"/>
    <text x="${P.l - 6}" y="${y(hi) + 4}" text-anchor="end">${gold(hi)}</text><text x="${P.l - 6}" y="${y(lo) + 4}" text-anchor="end">${gold(lo)}</text>
    <text x="${P.l}" y="${H - 6}">${day(rows[0].day)}</text><text x="${W - P.r}" y="${H - 6}" text-anchor="end">${day(rows[rows.length - 1].day)}</text>
    <path d="${line(r => r.med)}" class="med"/><g class="med">${dots(r => r.med)}</g>
    <path d="${line(r => r.low)}" class="low"/><g class="low">${dots(r => r.low)}</g></svg>`;
  const wrap = h('div');
  wrap.innerHTML = svg;
  wrap.append(h('div', { class: 'mk-legend' }, h('span', { class: 'low' }, '— ' + t.low), h('span', { class: 'med' }, '— ' + t.med)));
  return wrap;
}

// scanner events from the app: a page read from the screen → send it, then refresh the list a bit later
let mkReload = null;
if (window.rqcApp && window.rqcApp.onMarket) window.rqcApp.onMarket(async ev => {
  const S = MK.scan;
  if (ev.type === 'status') { S.state = ev.state; S.info = ev.info; drawMarketScan(); return; }
  if (ev.type !== 'page' || !MK.server) return;
  S.pages++; S.last = ev;
  try {
    const added = await sb('rpc/market_submit', { method: 'POST', body: JSON.stringify({ p_server: MK.server, p_rows: ev.rows.map(r => ({ i: r.id, p: r.price })) }) });
    S.sent += +added || 0;
  } catch (e) { S.info = e.message; }
  drawMarketScan();
  clearTimeout(mkReload); mkReload = setTimeout(() => loadMarket(true), 4000);
});
