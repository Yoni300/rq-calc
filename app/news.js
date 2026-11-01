/* "What's new": a bell in the top bar. A number on it shows changes made since the player last opened the list;
   the list (data/changelog.js) has the date and time of every change. Uses globals from app.js at call time. */

const NEWS_T = {
  uk: { title: 'Що нового', tip: 'Що нового', empty: 'Поки нічого' },
  ru: { title: 'Что нового', tip: 'Что нового', empty: 'Пока ничего' },
  en: { title: "What's new", tip: "What's new", empty: 'Nothing yet' },
};
const NT = () => NEWS_T[lang] || NEWS_T.ru;
const NEWS = (window.RQ_CHANGELOG || []).map(e => ({ ...e, t: Date.parse(e.at) })).filter(e => !isNaN(e.t)).sort((a, b) => b.t - a.t);

// first visit: the changes of the last 3 days count as new
function newsSeen() {
  let s = store.get('newsSeen', null);
  if (s == null) { s = Date.now() - 3 * 864e5; store.set('newsSeen', s); }
  return s;
}
function drawNewsBell() {
  const btn = $('btnNews');
  if (!btn) return;
  const unread = NEWS.filter(e => e.t > newsSeen()).length;
  btn.innerHTML = svgIcon('bell') + (unread ? `<span class="news-badge">${unread > 9 ? '9+' : unread}</span>` : '');
  btn.title = NT().tip;
}
function openNews() {
  const t = NT(), seen = newsSeen();
  const menu = $('newsMenu');
  if (!menu.hidden) { menu.hidden = true; return; }
  const day = ms => new Date(ms).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const time = ms => new Date(ms).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  menu.innerHTML = '';
  menu.append(h('div', { class: 'news-head' }, t.title));
  if (!NEWS.length) menu.append(h('div', { class: 'news-empty' }, t.empty));
  let lastDay = '';
  for (const e of NEWS) {
    const d = day(e.t);
    if (d !== lastDay) { lastDay = d; menu.append(h('div', { class: 'news-day' }, d)); }
    menu.append(h('div', { class: 'news-item' + (e.t > seen ? ' new' : '') },
      h('span', { class: 'news-time' }, time(e.t)), h('span', null, e[lang] || e.ru)));
  }
  menu.hidden = false;
  if (NEWS.length) store.set('newsSeen', NEWS[0].t);
  drawNewsBell();
}
document.addEventListener('click', e => {
  const m = $('newsMenu');
  if (m && !m.hidden && !m.contains(e.target) && !$('btnNews').contains(e.target)) m.hidden = true;
});
