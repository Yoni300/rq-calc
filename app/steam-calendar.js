/* Calendar of maintenance, events and offers (from the Steam news, read by tools/steam-calendar.mjs) and a strip under
   the top bar when maintenance is running or starts within a day. Times are shown in the viewer's own time zone.
   Uses globals from app.js and steam-news.js at call time. */

const SCAL_T = {
  uk: {
    title: 'Календар', sub: 'Техроботи, івенти й акції з новин', news: 'Новини', now: 'Зараз іде', soon: 'Скоро', past: 'Нещодавно завершилося',
    kinds: { maint: 'Техроботи', event: 'Івент', season: 'Сезон', shop: 'Акція', sale: 'Знижки', obt: 'ОБТ' },
    left: 'ще {t}', in: 'через {t}', ago: '{t} тому', approx: 'орієнтовно', noEnd: 'кінець не вказано', running: 'вже йде',
    post: 'Новина', empty: 'Поки нічого не заплановано', note: 'Дати взято з тексту новин Steam і показано за вашим часом. Якщо щось не так — відкрийте новину.',
    d: 'д', h: 'год', m: 'хв', maintNow: 'Іде профілактика', maintSoon: 'Профілактика', maintName: 'Профілактика', nightName: 'Нічні техроботи', until: 'до', today: 'сьогодні', tomorrow: 'завтра', hide: 'Сховати',
  },
  ru: {
    title: 'Календарь', sub: 'Техработы, ивенты и акции из новостей', news: 'Новости', now: 'Сейчас идёт', soon: 'Скоро', past: 'Недавно закончилось',
    kinds: { maint: 'Техработы', event: 'Ивент', season: 'Сезон', shop: 'Акция', sale: 'Скидки', obt: 'ОБТ' },
    left: 'ещё {t}', in: 'через {t}', ago: '{t} назад', approx: 'ориентировочно', noEnd: 'конец не указан', running: 'уже идёт',
    post: 'Новость', empty: 'Пока ничего не запланировано', note: 'Даты взяты из текста новостей Steam и показаны по вашему времени. Если что-то не так — откройте новость.',
    d: 'д', h: 'ч', m: 'мин', maintNow: 'Идёт профилактика', maintSoon: 'Профилактика', maintName: 'Профилактика', nightName: 'Ночные технические работы', until: 'до', today: 'сегодня', tomorrow: 'завтра', hide: 'Скрыть',
  },
  en: {
    title: 'Calendar', sub: 'Maintenance, events and offers from the news', news: 'News', now: 'Running now', soon: 'Coming up', past: 'Recently ended',
    kinds: { maint: 'Maintenance', event: 'Event', season: 'Season', shop: 'Offer', sale: 'Sale', obt: 'Test server' },
    left: '{t} left', in: 'in {t}', ago: '{t} ago', approx: 'approximately', noEnd: 'end not given', running: 'running',
    post: 'Post', empty: 'Nothing planned yet', note: 'Dates come from the text of the Steam news and are shown in your time. If something looks wrong, open the post.',
    d: 'd', h: 'h', m: 'min', maintNow: 'Maintenance is on', maintSoon: 'Maintenance', maintName: 'Maintenance', nightName: 'Night maintenance', until: 'until', today: 'today', tomorrow: 'tomorrow', hide: 'Hide',
  },
};
const CTX = () => SCAL_T[lang] || SCAL_T.ru;
const CAL_ICON = { maint: '🔧', event: '🎉', season: '🗺️', shop: '🎁', sale: '🏷️', obt: '🧪' };
const nowSec = () => Math.floor(Date.now() / 1000);

// «3 д 4 ч», «5 ч 20 мин», «12 мин»
function calSpan(sec) {
  const t = CTX(), m = Math.max(1, Math.round(sec / 60)), d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d) return `${d} ${t.d}` + (hh ? ` ${hh} ${t.h}` : '');
  if (hh) return `${hh} ${t.h}` + (mm ? ` ${mm} ${t.m}` : '');
  return `${mm} ${t.m}`;
}
const calFmt = (s, t) => s.replace('{t}', t);
function calWhen(sec, dayOnly) {
  const d = new Date(sec * 1000);
  return dayOnly ? d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
    : d.toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
const calTime = sec => new Date(sec * 1000).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
// the game runs on Moscow time: when the viewer's clock differs, the times are also given in MSK
const MSK_OFF = 180;
const mskTime = sec => { const d = new Date((sec + MSK_OFF * 60) * 1000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
const isMsk = sec => -new Date(sec * 1000).getTimezoneOffset() === MSK_OFF;
const mskRange = (a, b) => isMsk(a) ? '' : ` (${mskTime(a)}${b ? '–' + mskTime(b) : ''} МСК)`;
// maintenance names come from Russian posts; the rest are the game's own names
const calName = e => e.kind === 'maint' ? (/ночн/i.test(e.name) ? CTX().nightName : CTX().maintName) : e.name;
// a maintenance without an end still blocks the game for a few hours
const calEnd = e => e.end ?? (e.kind === 'maint' && e.start ? e.start + 6 * 3600 : null);

function calGroups() {
  const now = nowSec(), cal = SN.cal || [];
  const now_ = [], soon = [], past = [];
  for (const e of cal) {
    const end = calEnd(e);
    if (e.start != null && e.start > now) soon.push(e);
    else if (end == null || end > now) now_.push(e);
    else if (now - end < 7 * 86400) past.push(e);
  }
  now_.sort((a, b) => (calEnd(a) ?? Infinity) - (calEnd(b) ?? Infinity));
  soon.sort((a, b) => a.start - b.start);
  past.sort((a, b) => calEnd(b) - calEnd(a));
  return { now: now_, soon, past };
}

// the page header: Calendar | News
function snViewSwitch() {
  const t = CTX();
  return h('div', { class: 'sn-switch' },
    h('button', { class: 'bs-cat' + (tab === 'cal' ? ' on' : ''), onclick: () => switchTool('calendar') }, '📅 ' + t.title),
    h('button', { class: 'bs-cat' + (tab === 'steam' ? ' on' : ''), onclick: () => switchTool('steam') }, '📰 ' + t.news));
}
function renderCalendar(el) {
  el.append(snViewSwitch(), h('div', { class: 'cal-wrap', id: 'calWrap' }));
  if (!SN.cal && !SN.loading) loadSteamNews();
  drawCalendar();
}
function calCard(e, where) {
  const t = CTX(), now = nowSec(), end = calEnd(e);
  const period = (e.start != null ? calWhen(e.start, e.sd) : t.running) + ' — ' + (e.end != null ? calWhen(e.end, e.ed) : t.noEnd);
  let count = '';
  if (where === 'soon') count = calFmt(t.in, calSpan(e.start - now));
  else if (where === 'now') count = end != null ? calFmt(t.left, calSpan(end - now)) : '';
  else count = calFmt(t.ago, calSpan(now - end));
  const pct = where === 'now' && e.start != null && end != null ? Math.min(100, Math.max(0, (now - e.start) / (end - e.start) * 100)) : null;
  const post = (SN.items || []).find(x => x.id === e.post);
  return h('div', { class: `cal-card k-${e.kind} ${where}` },
    h('div', { class: 'cal-ic' }, CAL_ICON[e.kind] || '📌'),
    h('div', { class: 'cal-main' },
      h('div', { class: 'cal-name' }, h('b', null, calName(e)), h('span', { class: 'cal-kind' }, t.kinds[e.kind] || e.kind), e.approx ? h('span', { class: 'cal-approx', title: t.approx }, '≈') : null),
      h('div', { class: 'cal-when' }, period, e.kind === 'maint' && e.start != null ? mskRange(e.start, e.end) : ''),
      pct != null ? h('div', { class: 'cal-bar' }, h('i', { style: `width:${pct.toFixed(1)}%` })) : null),
    h('div', { class: 'cal-side' },
      count ? h('div', { class: 'cal-count' }, count) : null,
      post ? h('button', { class: 'btn small ghost', onclick: () => { SN.sel = post.id; switchTool('steam'); } }, t.post) : null));
}
function drawCalendar() {
  const el = $('calWrap');
  if (!el) return;
  const t = CTX(), st = STX();
  el.innerHTML = '';
  if (!SN.cal) {
    el.append(SN.err ? h('div', { class: 'bs-empty' }, st.fail, ' ', h('button', { class: 'btn small', onclick: () => { SN.err = false; drawCalendar(); loadSteamNews(); } }, st.retry)) : h('div', { class: 'bs-empty' }, '…'));
    return;
  }
  const g = calGroups();
  if (!g.now.length && !g.soon.length && !g.past.length) el.append(h('div', { class: 'bs-empty big' }, t.empty));
  for (const [k, label] of [['soon', t.soon], ['now', t.now], ['past', t.past]]) {
    if (!g[k].length) continue;
    el.append(h('h3', { class: 'cal-h' }, label), h('div', { class: 'cal-list' }, g[k].map(e => calCard(e, k))));
  }
  el.append(h('div', { class: 'sn-note cal-note' }, t.note));
}

// ---------- the maintenance strip under the top bar ----------
function drawMaintBar() {
  const bar = $('maintBar');
  if (!bar) return;
  const t = CTX(), now = nowSec();
  const m = (SN.cal || []).filter(e => e.kind === 'maint' && e.start && calEnd(e) > now && e.start - now < 86400).sort((a, b) => a.start - b.start)[0];
  if (!m || store.get('maintBarHidden', 0) === m.start) { bar.hidden = true; return; }
  const on = m.start <= now, end = calEnd(m);
  const day = new Date(m.start * 1000).toDateString() === new Date().toDateString() ? t.today : t.tomorrow;
  const range = calTime(m.start) + (m.end ? '–' + calTime(m.end) : '') + mskRange(m.start, m.end);
  bar.innerHTML = '';
  bar.append(h('span', { class: 'mb-ic' }, '🔧'),
    h('span', { class: 'mb-txt' }, on ? h('b', null, t.maintNow) : h('b', null, `${t.maintSoon} ${day} ${range}`),
      ' · ', on ? (m.end ? `${t.until} ${calTime(m.end)} (${calFmt(t.left, calSpan(end - now))})` : t.noEnd) : calFmt(t.in, calSpan(m.start - now))),
    h('button', { class: 'mb-x', title: t.hide, onclick: e => { e.stopPropagation(); store.set('maintBarHidden', m.start); bar.hidden = true; } }, '✕'));
  bar.onclick = () => switchTool('calendar');
  bar.hidden = false;
}

document.addEventListener('DOMContentLoaded', () => {
  // the countdowns move on without a reload
  setInterval(() => { drawMaintBar(); if (tab === 'cal') drawCalendar(); }, 30 * 1000);
});
