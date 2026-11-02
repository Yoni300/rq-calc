/* "Новости игры": Royal Quest announcements from Steam. A top-bar button (with the number of unread posts) opens the list;
   the post opens beside it with its pictures, lists and tables. tools/update-steam-news.mjs (run every 20 minutes by
   .github/workflows/steam-news.yml) keeps the file on the `steam-news` branch up to date. Uses globals from app.js at call time. */

const SNEWS_T = {
  uk: { btn: 'Новини', title: 'Новини гри', sub: 'Оголошення Royal Quest зі Steam', tip: 'Новини гри (Steam)', empty: 'Новин поки немає', fail: 'Не вдалося завантажити новини. Перевірте інтернет.', retry: 'Ще раз', steam: 'Відкрити в Steam', pick: 'Оберіть новину зліва', search: 'Пошук у новинах…', fresh: 'нова', note: 'Новини Royal Quest зі Steam, оновлюються самі' },
  ru: { btn: 'Новости', title: 'Новости игры', sub: 'Объявления Royal Quest из Steam', tip: 'Новости игры (Steam)', empty: 'Новостей пока нет', fail: 'Не удалось загрузить новости. Проверьте интернет.', retry: 'Ещё раз', steam: 'Открыть в Steam', pick: 'Выберите новость слева', search: 'Поиск по новостям…', fresh: 'новая', note: 'Новости Royal Quest из Steam, обновляются сами' },
  en: { btn: 'News', title: 'Game news', sub: 'Royal Quest announcements from Steam', tip: 'Game news (Steam)', empty: 'No news yet', fail: 'Could not load the news. Check your connection.', retry: 'Try again', steam: 'Open in Steam', pick: 'Pick a post on the left', search: 'Search the news…', fresh: 'new', note: 'Royal Quest news from Steam, updated automatically' },
};
const STX = () => SNEWS_T[lang] || SNEWS_T.ru;
const STEAM_NEWS_URL = 'https://raw.githubusercontent.com/Yoni300/rq-calc/refs/heads/steam-news/steam-news.json';
const SN = { items: null, sel: null, q: '', err: false, loading: false, prevSeen: 0 };

// the posts: Russian for the Russian and Ukrainian interface (Steam has no Ukrainian text), English for English
const snText = it => (lang === 'en' ? it.en || it.ru : it.ru || it.en) || { t: '', b: '' };

function snSeen() {
  let s = store.get('steamSeen', null);
  if (s == null) { s = Math.floor(Date.now() / 1000) - 3 * 86400; store.set('steamSeen', s); } // first visit: the last 3 days count as new
  return s;
}
async function loadSteamNews() {
  if (SN.loading) return;
  if (!SN.items) SN.items = store.get('steamNewsCache', null); // shown at once, refreshed below
  SN.loading = true;
  try {
    // a new address every 5 minutes, so neither the browser nor GitHub serve an old copy for long
    const r = await fetch(STEAM_NEWS_URL + '?t=' + Math.floor(Date.now() / 300000), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    SN.items = (j.items || []).filter(it => it && it.id && (it.ru || it.en));
    SN.err = false;
    try { store.set('steamNewsCache', SN.items); } catch { /* storage full: fine, it's only a cache */ }
  } catch { SN.err = !SN.items; }
  SN.loading = false;
  if (tab === 'steam') snMarkRead();
  drawSteamButton();
  if (tab === 'steam') { drawSteamList(); drawSteamPost(); }
}
function drawSteamButton() {
  const btn = $('btnSteam');
  if (!btn) return;
  const seen = snSeen(), unread = (SN.items || []).filter(it => it.at > seen).length;
  btn.innerHTML = svgIcon('news') + `<span>${esc(STX().btn)}</span>` + (unread ? `<span class="news-badge">${unread > 9 ? '9+' : unread}</span>` : '');
  btn.title = STX().tip;
  btn.classList.toggle('on', tab === 'steam');
}

// ---------- Steam's BBCode → safe HTML (everything is escaped first; links and pictures only http(s)) ----------
function steamHtml(src) {
  let s = esc(src).replace(/'/g, '&#39;');
  const url = u => { u = String(u || '').replace(/&quot;/g, '').replace(/&amp;/g, '&').trim(); return /^https?:\/\/[^\s<>]+$/i.test(u) ? esc(u) : null; };
  const link = (u, text) => `<a href="${u}" target="_blank" rel="noopener">${text}</a>`;
  s = s.replace(/\[img(?:\s+src=([^\]]*))?\]([\s\S]*?)\[\/img\]/gi, (m, a, b) => { const u = url(a || b); return u ? `<img class="sn-pic" src="${u}" loading="lazy" alt="">` : ''; });
  s = s.replace(/\[previewyoutube=([\w-]{6,})[^\]]*\]\[\/previewyoutube\]/gi, (m, id) => link(`https://www.youtube.com/watch?v=${id}`, '▶ YouTube'));
  s = s.replace(/\[url=([^\]]*)\]([\s\S]*?)\[\/url\]/gi, (m, u, t) => { const x = url(u); return x ? link(x, t) : t; });
  s = s.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (m, u) => { const x = url(u); return x ? link(x, x) : u; });
  const TAGS = { p: 'p', b: 'b', i: 'i', u: 'u', s: 's', strike: 's', h1: 'h3', h2: 'h4', h3: 'h5', list: 'ul', olist: 'ol', '*': 'li', quote: 'blockquote', code: 'pre', c: 'code', table: 'table', tr: 'tr', td: 'td', th: 'th', spoiler: 'mark' };
  s = s.replace(/\[(\/?)([a-z0-9*]+)(?:[\s=][^\]]*)?\]/gi, (m, close, tag) => {
    tag = tag.toLowerCase();
    if (tag === 'hr') return close ? '' : '<hr>';
    const t = TAGS[tag];
    return t ? `<${close}${t}>` : ''; // unknown tags go away, their text stays
  });
  // line breaks next to blocks (paragraphs, lists, tables) would only add empty lines
  s = s.replace(/\s*\n\s*(?=<\/?(?:p|ul|ol|li|table|tr|td|th|h3|h4|h5|blockquote|pre|hr)\b)/g, '')
    .replace(/(<\/?(?:p|ul|ol|li|table|tr|td|th|h3|h4|h5|blockquote|pre)>|<hr>)\s*\n\s*/g, '$1');
  return s.replace(/\r?\n/g, '<br>');
}

// ---------- the page ----------
// opening the page reads every post
function snMarkRead() {
  const newest = Math.max(0, ...(SN.items || []).map(it => it.at));
  if (newest > snSeen()) store.set('steamSeen', newest);
}
function renderSteamNews(el) {
  const t = STX();
  SN.prevSeen = snSeen(); // the "new" marks stay while the page is open
  snMarkRead();
  const search = h('input', { class: 'inp', placeholder: t.search, value: SN.q, spellcheck: false });
  search.addEventListener('input', () => { SN.q = search.value; drawSteamList(); });
  el.append(h('div', { class: 'bs-wrap sn-wrap' },
    h('div', { class: 'bs-side' }, search, h('div', { class: 'bs-list sn-list', id: 'snList' }), h('div', { class: 'sn-note' }, t.note)),
    h('div', { class: 'bs-detail sn-post', id: 'snPost' })));
  if (!SN.items && !SN.loading) loadSteamNews();
  drawSteamList();
  drawSteamPost();
  drawSteamButton();
}
const snDate = sec => new Date(sec * 1000).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
function drawSteamList() {
  const el = $('snList');
  if (!el) return;
  const t = STX();
  el.innerHTML = '';
  if (!SN.items) {
    el.append(SN.err ? h('div', { class: 'bs-empty' }, t.fail, ' ', h('button', { class: 'btn small', onclick: () => { SN.err = false; drawSteamList(); loadSteamNews(); } }, t.retry)) : h('div', { class: 'bs-empty' }, '…'));
    return;
  }
  const q = SN.q.trim().toLowerCase();
  const list = SN.items.filter(it => !q || (snText(it).t + ' ' + snText(it).b).toLowerCase().includes(q));
  if (!list.length) { el.append(h('div', { class: 'bs-empty' }, t.empty)); return; }
  if (!SN.sel || !SN.items.some(it => it.id === SN.sel)) SN.sel = SN.items[0].id;
  for (const it of list) {
    const x = snText(it);
    el.append(h('div', { class: 'bs-row sn-row' + (it.id === SN.sel ? ' on' : ''), onclick: () => { SN.sel = it.id; drawSteamList(); drawSteamPost(); if (innerWidth <= 900) $('snPost')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
      it.img ? h('img', { class: 'sn-thumb', src: it.img, loading: 'lazy', draggable: 'false', onerror: hideImg }) : h('span', { class: 'sn-thumb ph' }, iconEl('news')),
      h('div', { class: 'bs-name' }, x.t, h('small', null, snDate(it.at), it.at > SN.prevSeen ? h('span', { class: 'sn-new' }, t.fresh) : null))));
  }
}
function drawSteamPost() {
  const el = $('snPost');
  if (!el) return;
  const t = STX(), it = (SN.items || []).find(x => x.id === SN.sel);
  el.innerHTML = '';
  if (!it) { el.append(h('div', { class: 'bs-empty big' }, SN.items ? t.pick : '…')); return; }
  const x = snText(it);
  if (it.img) el.append(h('img', { class: 'sn-cover', src: it.img, draggable: 'false', onerror: hideImg }));
  el.append(h('h2', { class: 'sn-title' }, x.t), h('div', { class: 'bs-meta' }, snDate(it.at)));
  const body = h('div', { class: 'sn-body' });
  body.innerHTML = steamHtml(x.b);
  for (const img of body.querySelectorAll('img')) img.addEventListener('error', hideImg);
  el.append(body, h('div', { class: 'bs-foot' }, h('a', { href: it.url + (lang === 'en' ? '' : '?l=russian'), target: '_blank', rel: 'noopener' }, t.steam + ' ↗')));
  el.scrollTop = 0;
}

document.addEventListener('DOMContentLoaded', () => {
  $('btnSteam')?.addEventListener('click', () => switchTool('steam'));
  loadSteamNews();
  setInterval(loadSteamNews, 10 * 60 * 1000); // new posts show up without a reload
});
