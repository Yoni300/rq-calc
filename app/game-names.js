'use strict';
/* Game names on screen in the chosen language. The app keeps working with the Russian names (data, search keys, links,
   the group timer, the wiki); this layer only swaps the text people see. data/names-<lang>.js (tools/update-game-names.mjs)
   maps a Russian name to the game's English one. A watcher on the page translates every text and tooltip
   as it appears, so each tool needs no code of its own. The Russian original stays in the tooltip. */

// languages with a dictionary (Ukrainian keeps the game's Russian names, the user's choice)
const GN_LANGS = ['en'];
const GN = { lang: 'ru', dict: null, memo: new Map(), orig: new Map(), mine: new WeakMap(), attrs: new Map() };
const GN_CYR = /[А-Яа-яЁё]/;
const gnKey = s => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
// pieces of combined texts: «ур. 9 · элита · Торговый путь», «Знак КАРП, Гиблые болота», «Рецепт: …», «(Склеп)»
const GN_SEP = /(\s·\s|,\s|:\s|\s—\s|\s–\s|\s\/\s|[()«»"“”])/;
const GN_RUN = /[А-Яа-яЁё][А-Яа-яЁё'’ -]*[А-Яа-яЁё]|[А-Яа-яЁё]/g;
const gnKeepSpace =(from, to) => from.match(/^\s*/)[0] + to + from.match(/\s*$/)[0];

// bonuses written out on the wiki: «+10 к Удаче на 15 мин.», «-20% к Атаке». The stat comes from the dictionary as «к удаче»,
// the word order from its «{bonus}» / «{for}» entries; units from «{мин}», «{сек}», «{ч}»
const GN_BONUS = /^([+\-−]?\s?[\d.,?]+%?)\s+к\s+([А-Яа-яЁё][А-Яа-яЁё ]*?)(?:\s+на\s+(\d+)\s*(мин|сек|ч|час)[А-Яа-я]*\.?)?(\.?)$/i;
// a text in the dictionary's language; a piece that is not a known game name stays as it was. Pure: the dictionary
// tool (tools/update-game-names.mjs) runs it too, to list what is still missing.
function gnTranslate(dict, s) {
  const one = p => { const t = dict[gnKey(p)]; return t ? gnKeepSpace(p, t) : null; };
  const bonus = p => {
    const m = p.trim().match(GN_BONUS);
    const stat = m && dict[gnKey('к ' + m[2])];
    if (!stat || !dict['{bonus}']) return null;
    let out = dict['{bonus}'].replace('{n}', m[1]).replace('{s}', stat);
    if (m[3]) {
      const unit = dict['{' + m[4].toLowerCase().replace('час', 'ч') + '}'];
      if (!unit || !dict['{for}']) return null;
      out += dict['{for}'].replace('{d}', unit.replace('{n}', m[3]));
    }
    return gnKeepSpace(p, out + m[5]);
  };
  // the last resort inside a piece: each run of Russian words on its own («Stamp Защиты от Земли», «☠ Пружинка»)
  const words = p => p.replace(GN_RUN, w => dict[gnKey(w)] || w);
  const whole = one(s) ?? bonus(s);
  if (whole != null) return whole;
  // a Russian sentence (a wiki description) is translated whole or not at all: «Quests, которые можно…» reads worse than
  // either. Russian, not Ukrainian: a Ukrainian sentence of ours may hold game names to translate
  const cyrWords = s.match(/[А-Яа-яЁёІіЇїЄєҐґ'’]+/g) || [];
  if (cyrWords.length >= 6 && cyrWords.length >= 0.7 * s.split(/\s+/).length && !/[ІіЇїЄєҐґ]/.test(s)) return s;
  return s.split(GN_SEP).map(p => (GN_CYR.test(p) ? one(p) ?? bonus(p) ?? words(p) : p)).join('');
}
// one text in the current language
function gameName(s) {
  if (!GN.dict || typeof s !== 'string' || !GN_CYR.test(s)) return s;
  let r = GN.memo.get(s);
  if (r !== undefined) return r;
  r = gnTranslate(GN.dict, s);
  if (GN.memo.size > 50000) GN.memo.clear();
  GN.memo.set(s, r);
  return r;
}

// ---------- the page ----------
const gnSkip = el => !el || el.closest('script,style,textarea,input,[contenteditable],.gn-raw,[translate="no"]');
function gnTextNode(n) {
  if (GN.mine.get(n) === n.data) return;            // our own translation
  const el = n.parentElement;
  if (!GN_CYR.test(n.data) || gnSkip(el)) return;
  const orig = n.data, t = gameName(orig);
  if (t === orig) return;
  GN.orig.set(n, orig); GN.mine.set(n, t);
  n.data = t;
  // the Russian name as the game client shows it, on hover
  if (!el.hasAttribute('title') && orig.trim().length > 1) { el.setAttribute('title', orig.trim()); el.dataset.gnTitle = '1'; }
}
function gnAttrs(el) {
  for (const a of ['title', 'placeholder']) {
    const v = el.getAttribute(a);
    if (!v || !GN_CYR.test(v) || (a === 'title' && el.dataset.gnTitle)) continue;
    const saved = GN.attrs.get(el);
    if (saved && saved[a + '_t'] === v) continue;
    const t = gameName(v);
    if (t === v) continue;
    const s = saved || {};
    s[a] = v; s[a + '_t'] = t;
    GN.attrs.set(el, s);
    el.setAttribute(a, t);
  }
}
function gnWalk(root) {
  if (!GN.dict || !root) return;
  if (root.nodeType === 3) return gnTextNode(root);
  if (root.nodeType !== 1 || gnSkip(root)) return;
  if (root.hasAttribute('title') || root.hasAttribute('placeholder')) gnAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n; (n = w.nextNode());) {
    if (n.nodeType === 3) gnTextNode(n);
    else if (n.hasAttribute('title') || n.hasAttribute('placeholder')) gnAttrs(n);
  }
}
// translated nodes that left the page are forgotten now and then
function gnPrune() { for (const n of GN.orig.keys()) if (!n.isConnected) GN.orig.delete(n); for (const e of GN.attrs.keys()) if (!e.isConnected) GN.attrs.delete(e); }
const gnObserver = new MutationObserver(list => {
  for (const m of list) {
    if (m.type === 'childList') m.addedNodes.forEach(gnWalk);
    else if (m.type === 'characterData') gnTextNode(m.target);
    else if (m.type === 'attributes' && m.target.nodeType === 1) gnAttrs(m.target);
  }
  if (GN.orig.size > 30000) gnPrune();
});
// back to the Russian texts (switching to Russian, or before another language)
function gnRestore() {
  for (const [n, orig] of GN.orig) if (n.isConnected && GN.mine.get(n) === n.data) {
    n.data = orig;
    const el = n.parentElement;
    if (el && el.dataset.gnTitle) { el.removeAttribute('title'); delete el.dataset.gnTitle; }
  }
  for (const [el, s] of GN.attrs) for (const a of ['title', 'placeholder']) if (s[a] != null && el.getAttribute(a) === s[a + '_t']) el.setAttribute(a, s[a]);
  GN.orig.clear(); GN.attrs.clear(); GN.memo.clear();
}
// the dictionary file is loaded only for the language that needs it (the same ?v= as this file, so an update reloads it)
function gnLoad(lng) {
  const have = (window.RQC_GAME_NAMES || {})[lng];
  if (have) return Promise.resolve(have);
  return new Promise(ok => {
    const me = document.querySelector('script[src*="game-names.js"]');
    const v = me && me.src.includes('?') ? me.src.slice(me.src.indexOf('?')) : '';
    const s = document.createElement('script');
    s.src = `../data/names-${lng}.js${v}`;
    s.onload = () => ok((window.RQC_GAME_NAMES || {})[lng] || null);
    s.onerror = () => ok(null);
    document.head.append(s);
  });
}
// app.js calls this whenever it draws the top bar (on start and on every language switch)
async function syncGameNames() {
  const want = typeof lang === 'string' ? lang : 'ru';
  if (want === GN.lang) return;
  GN.lang = want;
  gnObserver.disconnect();
  gnRestore();
  GN.dict = null;
  if (!GN_LANGS.includes(want)) return;
  const dict = await gnLoad(want);
  if (GN.lang !== want || !dict) return; // switched again meanwhile
  GN.dict = dict; GN.memo.clear();
  gnWalk(document.body);
  gnObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder'] });
}
