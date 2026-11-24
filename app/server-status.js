/* Is the game up? A top-bar button with a coloured dot and the number of players in the game (Steam); a click opens the
   last 24 hours as a chart. Two sources: players online from Steam (a crash shows as a sudden drop) and the game's own
   maintenance switch (the one the launcher checks). The app asks both every minute (main.js → window.rqcApp.server);
   the site and the history come from server-status.json (tools/update-server-status.mjs, every 5 minutes).
   A strip under the top bar says when the game is closed for maintenance or the number of players has suddenly fallen.
   Uses globals from app.js at call time. */

const SRV_T = {
  uk: {
    btn: 'онлайн', tip: 'Статус гри: гравців у Steam зараз', title: 'Статус гри', ok: 'Працює', maint: 'Технічні роботи', drop: 'Онлайн різко впав',
    unknown: 'Немає даних', online: 'гравців у грі через Steam', ago: 'оновлено {t} тому', fresh: 'оновлено щойно', now: 'щойно',
    wait: 'Графік з\'явиться, коли наберуться дані (оновлюються кожні кілька хвилин).', min: '{n} хв', h: '{n} год',
    hourAgo: 'годину тому: {n}', chart: 'Онлайн за добу', maintChart: 'техроботи',
    maintBar: 'Гра закрита на технічні роботи — так зараз каже лаунчер гри.',
    dropBar: 'Онлайн різко впав: {a} → {b} за {t}. Схоже, сервер упав.', hide: 'Сховати',
    note: 'Онлайн — тільки гравці, які зараз у грі через Steam (обидва сервери разом). Тих, хто грає через лаунчер BASE, Steam не рахує, а BASE свого онлайну не показує, тож усього гравців більше. Для статусу цього досить: коли сервер падає, вилітають усі, і онлайн у Steam різко падає теж, зазвичай за кілька хвилин. Техроботи — перемикач BASE, за яким лаунчер не пускає в гру.',
    stale: 'Дані давні — перевірте інтернет.',
  },
  ru: {
    btn: 'онлайн', tip: 'Статус игры: игроков в Steam сейчас', title: 'Статус игры', ok: 'Работает', maint: 'Технические работы', drop: 'Онлайн резко упал',
    unknown: 'Нет данных', online: 'игроков в игре через Steam', ago: 'обновлено {t} назад', fresh: 'обновлено только что', now: 'только что',
    wait: 'График появится, когда наберутся данные (обновляются каждые несколько минут).', min: '{n} мин', h: '{n} ч',
    hourAgo: 'час назад: {n}', chart: 'Онлайн за сутки', maintChart: 'техработы',
    maintBar: 'Игра закрыта на технические работы — так сейчас говорит лаунчер игры.',
    dropBar: 'Онлайн резко упал: {a} → {b} за {t}. Похоже, сервер упал.', hide: 'Скрыть',
    note: 'Онлайн — только игроки, которые сейчас в игре через Steam (оба сервера вместе). Тех, кто играет через лаунчер BASE, Steam не считает, а BASE свой онлайн не показывает, так что всего игроков больше. Для статуса этого хватает: когда сервер падает, вылетают все, и онлайн в Steam резко падает тоже, обычно за несколько минут. Техработы — переключатель BASE, по которому лаунчер не пускает в игру.',
    stale: 'Данные старые — проверьте интернет.',
  },
  en: {
    btn: 'online', tip: 'Game status: players in Steam now', title: 'Game status', ok: 'Up', maint: 'Maintenance', drop: 'Players suddenly dropped',
    unknown: 'No data', online: 'players in the game through Steam', ago: 'updated {t} ago', fresh: 'updated just now', now: 'just now',
    wait: 'The chart appears once there is some data (it is updated every few minutes).', min: '{n} min', h: '{n} h',
    hourAgo: 'an hour ago: {n}', chart: 'Players, last 24 hours', maintChart: 'maintenance',
    maintBar: 'The game is closed for maintenance — that is what the game launcher says right now.',
    dropBar: 'Players suddenly dropped: {a} → {b} in {t}. Looks like the server is down.', hide: 'Hide',
    note: 'Online = only the players in the game through Steam right now (both servers together). Steam does not count those who play through the BASE launcher, and BASE does not show its own number, so there are more players in total. That is enough for the status: when the server goes down everyone is kicked, and the Steam number drops sharply too, usually within a few minutes. Maintenance = the BASE switch the launcher uses to keep players out.',
    stale: 'The data is old — check your connection.',
  },
};
const SVT = () => SRV_T[lang] || SRV_T.ru;
const SERVER_URL = 'https://raw.githubusercontent.com/Yoni300/rq-calc/refs/heads/server-status/server-status.json';
const SRV_KEEP = 48 * 3600;
// hist: [time, players | null, 1 = can play / 0 = maintenance / null]; last: the newest answer { at, online, canRun }
// (live is read from the storage when the page is ready: app.js, which has `store`, loads after this file)
const SRV = { hist: [], live: [], last: null, loading: false };

const srvNow = () => Math.floor(Date.now() / 1000);
function srvSpan(sec) {
  const t = SVT();
  if (sec < 60) return t.now;
  return sec < 5400 ? fmtT(t.min, { n: Math.round(sec / 60) }) : fmtT(t.h, { n: Math.round(sec / 3600) });
}
// the file's points + the app's own minute points, in time order, without near duplicates
function srvPoints() {
  const all = [...SRV.hist, ...SRV.live].filter(p => Array.isArray(p) && p[0] > srvNow() - SRV_KEEP).sort((a, b) => a[0] - b[0]);
  const res = [];
  for (const p of all) if (!res.length || p[0] - res[res.length - 1][0] >= 30) res.push(p); else if (p[1] != null) res[res.length - 1] = p;
  return res;
}
function srvAdd(st) {
  if (!st || !st.at) return;
  if (!SRV.last || st.at >= SRV.last.at) SRV.last = st;
}

async function loadServerFile() {
  if (SRV.loading) return;
  SRV.loading = true;
  try {
    const r = await fetch(SERVER_URL + '?t=' + Math.floor(Date.now() / 120000), { cache: 'no-store' });
    if (r.ok) {
      const j = await r.json();
      SRV.hist = Array.isArray(j.hist) ? j.hist : [];
      srvAdd({ at: j.at, online: j.online, canRun: j.canRun, statuses: j.statuses || [] });
    }
  } catch { /* offline: the app still has its own answers */ }
  SRV.loading = false;
  drawServer();
}
// an answer from main.js (the app only)
function onServerAnswer(st) {
  if (!st) return;
  srvAdd(st);
  SRV.live = SRV.live.filter(p => p[0] > srvNow() - SRV_KEEP);
  SRV.live.push([st.at, st.online, st.canRun == null ? null : st.canRun ? 1 : 0]);
  store.set('srvLive', SRV.live);
  drawServer();
}

// 'ok' | 'maint' | 'drop' | 'unknown', with the numbers of a drop
function serverState() {
  const l = SRV.last, now = srvNow();
  if (!l || now - l.at > (window.RQC_WEB ? 25 : 15) * 60) return { k: 'unknown', stale: !!l };
  if (l.canRun === false) return { k: 'maint' };
  if (l.online != null) {
    // the most players during the 25 minutes before the newest answer
    const before = srvPoints().filter(p => p[1] != null && p[0] < l.at - 20 && p[0] >= l.at - 25 * 60);
    const top = before.reduce((m, p) => (p[1] > m[1] ? p : m), [0, 0]);
    if (top[1] >= 80 && l.online <= top[1] * 0.7) return { k: 'drop', a: top[1], b: l.online, t: l.at - top[0] };
  }
  return { k: 'ok' };
}

function drawServer() {
  const btn = $('btnServer');
  if (!btn) return;
  const t = SVT(), s = serverState(), l = SRV.last;
  btn.className = 'btn server-btn st-' + s.k;
  btn.innerHTML = '';
  btn.append(h('span', { class: 'srv-dot' }), h('span', { class: 'srv-n' }, l && l.online != null && s.k !== 'unknown' ? fmtNum(l.online) : '—'), h('span', { class: 'srv-w' }, t.btn));
  btn.title = t.title + ': ' + t[s.k] + (l && l.online != null && s.k !== 'unknown' ? ' · ' + t.online + ': ' + fmtNum(l.online) : '');
  drawServerBar(s);
  if (!$('serverMenu').hidden) drawServerMenu();
}

function drawServerBar(s) {
  const bar = $('serverBar');
  if (!bar) return;
  const t = SVT();
  // a hidden strip stays hidden for this event: maintenance until it ends, a drop until the players come back
  const key = s.k === 'maint' ? 'maint' : s.k === 'drop' ? 'drop' : '';
  if (!key) { if (store.get('srvBarHidden', '')) store.set('srvBarHidden', ''); bar.hidden = true; return; }
  if (store.get('srvBarHidden', '') === key) { bar.hidden = true; return; }
  bar.className = 'maint-bar server-bar ' + key;
  bar.innerHTML = '';
  bar.append(h('span', { class: 'mb-ic' }, s.k === 'maint' ? '🔧' : '⚠'),
    h('span', { class: 'mb-txt' }, h('b', null, s.k === 'maint' ? t.maintBar : fmtT(t.dropBar, { a: fmtNum(s.a), b: fmtNum(s.b), t: srvSpan(s.t) }))),
    h('button', { class: 'mb-x', title: t.hide, onclick: e => { e.stopPropagation(); store.set('srvBarHidden', key); bar.hidden = true; } }, '✕'));
  bar.onclick = e => { e.stopPropagation(); openServerMenu(); };
  bar.hidden = false;
}

// the last 24 hours: a line of players, maintenance as shaded stripes
function serverChart() {
  const W = 320, H = 86, P = 4, now = srvNow(), from = now - 24 * 3600;
  const pts = srvPoints().filter(p => p[0] >= from);
  const ns = pts.filter(p => p[1] != null).map(p => p[1]);
  if (ns.length < 2) return h('div', { class: 'srv-empty' }, SVT().wait);
  const svg = ['<svg class="srv-chart" viewBox="0 0 ' + W + ' ' + (H + 16) + '">'];
  if (ns.length) {
    const max = Math.max(...ns), top = Math.max(10, Math.ceil(max * 1.1));
    const x = tm => P + (tm - from) / (24 * 3600) * (W - 2 * P), y = n => P + (1 - n / top) * (H - 2 * P);
    // maintenance stripes
    for (let i = 0; i < pts.length; i++) {
      if (pts[i][2] !== 0) continue;
      const a = x(pts[i][0]), b = x(i + 1 < pts.length ? pts[i + 1][0] : now);
      svg.push(`<rect class="srv-m" x="${a.toFixed(1)}" y="0" width="${Math.max(1.5, b - a).toFixed(1)}" height="${H}"/>`);
    }
    // the line breaks where points are missing for more than 20 minutes
    let d = '', prev = null;
    for (const p of pts) {
      if (p[1] == null) { prev = null; continue; }
      d += (prev && p[0] - prev[0] <= 20 * 60 ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1);
      prev = p;
    }
    svg.push(`<line class="srv-ax" x1="${P}" y1="${y(max).toFixed(1)}" x2="${W - P}" y2="${y(max).toFixed(1)}"/>`);
    svg.push(`<path class="srv-ln" d="${d}"/>`);
    svg.push(`<text class="srv-tx" x="${W - P}" y="${(y(max) - 3).toFixed(1)}" text-anchor="end">${esc(fmtNum(max))}</text>`);
    // hours under the chart: every 6 hours
    for (let k = 0; k <= 4; k++) {
      const tm = from + k * 6 * 3600, lbl = new Date(tm * 1000).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
      svg.push(`<text class="srv-tx" x="${x(tm).toFixed(1)}" y="${H + 12}" text-anchor="${k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}">${esc(lbl)}</text>`);
    }
  }
  svg.push('</svg>');
  const el = h('div', { class: 'srv-chart-box' });
  el.innerHTML = svg.join('');
  return el;
}

function drawServerMenu() {
  const menu = $('serverMenu'), t = SVT(), s = serverState(), l = SRV.last;
  menu.innerHTML = '';
  menu.append(h('div', { class: 'news-head' }, t.title));
  const hourAgo = l && srvPoints().filter(p => p[1] != null && Math.abs(p[0] - (l.at - 3600)) <= 10 * 60).sort((a, b) => Math.abs(a[0] - (l.at - 3600)) - Math.abs(b[0] - (l.at - 3600)))[0];
  menu.append(h('div', { class: 'srv-row' },
    h('span', { class: 'srv-state st-' + s.k }, h('span', { class: 'srv-dot' }), t[s.k]),
    l ? h('span', { class: 'srv-ago' }, srvNow() - l.at < 60 ? t.fresh : fmtT(t.ago, { t: srvSpan(srvNow() - l.at) })) : null));
  if (s.k === 'unknown' && s.stale) menu.append(h('div', { class: 'srv-warn' }, t.stale));
  if (s.k === 'drop') menu.append(h('div', { class: 'srv-warn' }, fmtT(t.dropBar, { a: fmtNum(s.a), b: fmtNum(s.b), t: srvSpan(s.t) })));
  if (l && l.online != null) {
    menu.append(h('div', { class: 'srv-big' }, h('b', null, fmtNum(l.online)), h('span', null, t.online),
      hourAgo ? h('span', { class: 'srv-ago' }, fmtT(t.hourAgo, { n: fmtNum(hourAgo[1]) })) : null));
  }
  menu.append(h('div', { class: 'srv-cap' }, t.chart, h('span', { class: 'srv-mk' }, t.maintChart)), serverChart());
  menu.append(h('div', { class: 'srv-note' }, t.note));
}
function openServerMenu() {
  const menu = $('serverMenu');
  if (!menu.hidden) { menu.hidden = true; return; }
  for (const id of ['newsMenu', 'buildsMenu', 'toolsMenu']) if ($(id)) $(id).hidden = true;
  drawServerMenu();
  menu.hidden = false;
}

document.addEventListener('click', e => {
  const m = $('serverMenu');
  if (m && !m.hidden && !m.contains(e.target) && !$('btnServer').contains(e.target) && !$('serverBar').contains(e.target)) m.hidden = true;
});
document.addEventListener('DOMContentLoaded', () => {
  SRV.live = store.get('srvLive', []);
  // the newest of the app's own answers is shown at once, until a fresh one comes
  for (const p of SRV.live) srvAdd({ at: p[0], online: p[1], canRun: p[2] == null ? null : !!p[2], statuses: [] });
  $('btnServer').addEventListener('click', openServerMenu);
  const appBridge = window.rqcApp && window.rqcApp.server;
  if (appBridge) {
    window.rqcApp.onServer(onServerAnswer);
    window.rqcApp.server().then(onServerAnswer, () => {});
  }
  loadServerFile();
  setInterval(loadServerFile, 5 * 60 * 1000);
  // "updated N minutes ago" and the old-data check move on by themselves
  setInterval(drawServer, 30 * 1000);
  drawServer();
});
