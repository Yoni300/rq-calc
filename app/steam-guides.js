'use strict';
/* «Гайды»: the players' guides for Royal Quest Online on Steam Community, as a catalog: picture, title, author, rating,
   categories, a short description. A click opens the guide itself on Steam (its text is its author's and stays there).
   data/steam-guides.js comes from tools/update-steam-guides.mjs. Uses globals from app.js at call time. */

const GUIDES_T = {
  uk: { title: 'Гайди', sub: 'Гайди гравців зі Steam', search: 'Пошук у гайдах…', all: 'Усі', ru: 'RU', en: 'EN', other: 'Інші',
    best: 'Найкращі', fresh: 'Нові', popular: 'Популярні', cats: 'Усі теми', by: 'автор {a}', views: '{n} переглядів', votes: '{n} оцінок',
    open: 'Відкрити в Steam', empty: 'Нічого не знайдено', note: 'Гайди написали гравці, вони відкриваються в Steam. Список від {d}.' },
  ru: { title: 'Гайды', sub: 'Гайды игроков из Steam', search: 'Поиск по гайдам…', all: 'Все', ru: 'RU', en: 'EN', other: 'Другие',
    best: 'Лучшие', fresh: 'Новые', popular: 'Популярные', cats: 'Все темы', by: 'автор {a}', views: '{n} просмотров', votes: '{n} оценок',
    open: 'Открыть в Steam', empty: 'Ничего не найдено', note: 'Гайды написали игроки, они открываются в Steam. Список от {d}.' },
  en: { title: 'Guides', sub: 'Player guides from Steam', search: 'Search the guides…', all: 'All', ru: 'RU', en: 'EN', other: 'Other',
    best: 'Top rated', fresh: 'Newest', popular: 'Most viewed', cats: 'All topics', by: 'by {a}', views: '{n} views', votes: '{n} ratings',
    open: 'Open on Steam', empty: 'Nothing found', note: 'Guides are written by players and open on Steam. List from {d}.' },
};
const GTX = () => GUIDES_T[lang] || GUIDES_T.ru;
// this file loads before app.js defines `store`: the saved choices are read with bosses.js's bget
const GD = { q: '', lang: bget('guidesLang', 'all'), sort: bget('guidesSort', 'best'), cat: '' };

// what the reader sees: an English title and description in the English interface when the guide is not in English
const gdText = g => (lang === 'en' && g.en ? g.en : { t: g.title, d: g.desc });
const gdUrl = g => `https://steamcommunity.com/sharedfiles/filedetails/?id=${g.id}&l=${lang === 'en' ? 'english' : 'russian'}`;

function renderGuides(el) {
  const t = GTX(), G = window.RQ_GUIDES || { items: [], cats: {} };
  const seg = (items, cur, on) => h('div', { class: 'seg' }, items.map(([v, label]) => h('button', { class: v === cur ? 'on' : '', onclick: () => on(v) }, label)));
  const search = h('input', { class: 'inp', placeholder: t.search, value: GD.q, spellcheck: false });
  search.addEventListener('input', () => { GD.q = search.value; drawGuides(); });
  // topics that have guides, most used first
  const used = {};
  for (const g of G.items) for (const c of g.cats) used[c] = (used[c] || 0) + 1;
  const cats = Object.keys(used).sort((a, b) => used[b] - used[a]);
  el.append(
    h('div', { class: 'pb-bar' },
      seg([['all', t.all], ['ru', t.ru], ['en', t.en], ['other', t.other]], GD.lang, v => { GD.lang = v; store.set('guidesLang', v); renderCenter(); }),
      seg([['best', t.best], ['fresh', t.fresh], ['popular', t.popular]], GD.sort, v => { GD.sort = v; store.set('guidesSort', v); renderCenter(); }),
      search),
    h('div', { class: 'bs-cats gd-cats' },
      [['', t.cats], ...cats.map(c => [c, (G.cats[c] || {})[lang] || c])].map(([c, label]) =>
        h('button', { class: 'bs-cat' + (GD.cat === c ? ' on' : ''), onclick: () => { GD.cat = c; renderCenter(); } }, label, c ? h('small', null, ' ' + used[c]) : null))),
    // guide titles are the authors' own words: app/game-names.js must not touch them
    h('div', { class: 'gd-list', id: 'guideList', translate: 'no' }),
    h('div', { class: 'note gd-note' }, fmtT(t.note, { d: G.at ? new Date(G.at).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) : '—' })));
  drawGuides();
}

function drawGuides() {
  const el = document.getElementById('guideList');
  if (!el) return;
  const t = GTX(), G = window.RQ_GUIDES || { items: [], cats: {} };
  el.innerHTML = '';
  const list = G.items.filter(g => (GD.lang === 'all' || (GD.lang === 'other' ? g.lang !== 'ru' && g.lang !== 'en' : g.lang === GD.lang))
    && (!GD.cat || g.cats.includes(GD.cat))
    && matches(GD.q, g.title, g.desc, g.author, g.en && g.en.t, g.en && g.en.d));
  // Steam's order is «best rated»; the others sort by date and by visitors
  if (GD.sort === 'fresh') list.sort((a, b) => (b.upd || b.at || 0) - (a.upd || a.at || 0));
  else if (GD.sort === 'popular') list.sort((a, b) => b.visitors - a.visitors);
  if (!list.length) { el.append(h('div', { class: 'hint pb-msg' }, t.empty)); return; }
  const date = s => (s ? new Date(s * 1000).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  for (const g of list) {
    const x = gdText(g);
    el.append(h('a', { class: 'gd-card', href: gdUrl(g), target: '_blank', rel: 'noopener', title: t.open + (x.t !== g.title ? '\n' + g.title : '') },
      g.img ? h('img', { class: 'gd-pic', src: `../data/guides/${g.img}`, loading: 'lazy', draggable: 'false', alt: '', onerror: hideImg }) : h('span', { class: 'gd-pic ph' }, iconEl('guide')),
      h('div', { class: 'gd-body' },
        h('div', { class: 'gd-title' }, x.t),
        h('div', { class: 'gd-meta' },
          h('span', { class: 'gd-stars', title: fmtT(t.votes, { n: fmtNum(g.votes, 0) }) }, '★'.repeat(g.stars) + '☆'.repeat(5 - g.stars)),
          ` ${fmtT(t.by, { a: g.author })} · ${date(g.upd || g.at)} · ${fmtT(t.views, { n: fmtNum(g.visitors, 0) })}`,
          g.lang !== lang && !(lang === 'uk' && g.lang === 'ru') ? h('span', { class: 'gd-lang' }, g.lang.toUpperCase()) : null),
        x.d ? h('div', { class: 'gd-desc' }, x.d) : null,
        g.cats.length ? h('div', { class: 'gd-tags' }, g.cats.map(c => h('span', null, (G.cats[c] || {})[lang] || c))) : null)));
  }
}
