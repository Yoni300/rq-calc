'use strict';
/* «Шрифты»: an editor for the game's text formatting (the shop name and the banner over the head, game update of
   24.11.2026): the player writes the text, wraps parts of it in tags with the buttons, sees how it looks and copies
   the code into the game. Nothing here talks to the game.
   Tags (the developers' post): <font=alias[,size%|,width%/height%]> (40–200 %), <color=r,g,b[,a]> / <color=#RRGGBB[AA]>,
   <outline[=r,g,b,a | =#RRGGBBAA]>, <b>, <i>, <u[=offset]>, <strike[=offset]>, each closed with </tag>.
   The aliases and their sizes are the game's ui/fonts.txt. The game's own font files are not free to share, so the
   preview uses look-alike free fonts (data/fonts, SIL OFL): Philosopher for AGPresquire, Alegreya SC for the RoyalQuest
   title font; Alegreya italic is the game's own italic. Uses globals from app.js at call time. */

const FONT_T = {
  uk: { title: 'Шрифти', sub: 'Назва крамниці й банер з кольорами', code: 'Код для гри', copy: 'Копіювати код', copied: 'Код скопійовано — вставте його в гру',
    save: 'Зберегти', clear: 'Очистити', strip: 'Прибрати оформлення', font: 'Шрифт', size: 'Розмір', width: 'Ширина окремо', apply: 'Застосувати',
    color: 'Колір', alpha: 'Прозорість', gradient: 'Градієнт', outline: 'Обведення', bold: 'Жирний', thin: 'Тонкий', thinTip: 'Прибрати жирний', shorten: 'Скоротити код', shortenTip: 'Ті самі кольори поруч зливаються, порожні теги зникають — менше набирати', steps: 'Кольорів', every: 'кожна літера', typeTitle: 'Наберіть у грі', typeHint: 'Гра не вставляє текст через Ctrl+V, тому код треба набрати вручну, символ у символ. Поле в грі приймає лише {limit} символів, тому закривальні теги тут не пишуться (гра їх не потребує), а зайве закреслено. Крапка · — це пробіл. Що коротший код, то швидше: градієнт на 3–4 кольори набирати набагато легше, ніж на кожну літеру.', italic: 'Курсив', under: 'Підкреслення', strike: 'Закреслення',
    sel: 'Кнопки змінюють виділений шматок коду, а якщо нічого не виділено — увесь текст.',
    preview: 'Як це виглядатиме', bgNight: 'Ніч', bgDay: 'День', bgStone: 'Камінь', mine: 'Мої написи', mineEmpty: 'Тут будуть збережені написи.',
    use: 'Взяти', del: 'Видалити', examples: 'Приклади', tags: 'Усі команди', count: 'Код: {c} симв. · текст: {t}',
    note: 'Шрифти в попередньому перегляді схожі на ігрові, але не ті самі: у грі літери трохи інші. Якщо гра обріже довгий код (наприклад, градієнт), зробіть текст коротшим.',
    warnFont: 'Шрифту «{v}» у грі немає', warnSize: 'Розмір {v} — у грі від 40 до 200 %', warnColor: 'Не зрозумів колір «{v}»', warnClose: 'Зайвий закривальний тег {v}', warnOpen: 'Не закрито: {v}',
    limit: 'Ліміт гри', limitTip: 'Скільки символів приймає поле в грі. Перевірте: наберіть цифри 1234567890… і подивіться, на якій зупиниться.',
    openTags: 'Без закривальних тегів', openTip: 'Закривальні теги в кінці й перед новим кольором не набираються: гра показує текст так само, а код коротший.',
    left: 'ще {n} влізе', over: 'на {n} довше, ніж приймає гра', fits: 'влазить',
    ph: 'Напишіть текст, виділіть шматок і натисніть кнопку…',
    help: [
      ['<font=title,140>…</font>', 'шрифт і розмір у відсотках (40–200)'], ['<font=default,120/80>…</font>', 'ширина / висота окремо'],
      ['<color=#FF0000>…</color>', 'колір (можна 255,0,0 або з прозорістю #FF0000CC)'], ['<outline>…</outline>', 'чорне обведення; <outline=#FFFFFF80> — свій колір'],
      ['<b>…</b>  <i>…</i>', 'жирний і курсив'], ['<u>…</u>  <strike>…</strike>', 'підкреслення й закреслення (<u=5> — нижче)']] },
  ru: { title: 'Шрифты', sub: 'Название магазина и баннер с цветами', code: 'Код для игры', copy: 'Копировать код', copied: 'Код скопирован — вставьте его в игру',
    save: 'Сохранить', clear: 'Очистить', strip: 'Убрать оформление', font: 'Шрифт', size: 'Размер', width: 'Ширина отдельно', apply: 'Применить',
    color: 'Цвет', alpha: 'Прозрачность', gradient: 'Градиент', outline: 'Обводка', bold: 'Жирный', thin: 'Тонкий', thinTip: 'Убрать жирный', shorten: 'Сократить код', shortenTip: 'Одинаковые цвета рядом сливаются, пустые теги исчезают — меньше набирать', steps: 'Цветов', every: 'каждая буква', typeTitle: 'Наберите в игре', typeHint: 'Игра не вставляет текст через Ctrl+V, поэтому код нужно набрать вручную, символ в символ. Поле в игре принимает только {limit} символов, поэтому закрывающие теги здесь не пишутся (игре они не нужны), а лишнее зачёркнуто. Точка · — это пробел. Чем короче код, тем быстрее: градиент на 3–4 цвета набирать намного легче, чем на каждую букву.', italic: 'Курсив', under: 'Подчёркивание', strike: 'Зачёркивание',
    sel: 'Кнопки меняют выделенный кусок кода, а если ничего не выделено — весь текст.',
    preview: 'Как это будет выглядеть', bgNight: 'Ночь', bgDay: 'День', bgStone: 'Камень', mine: 'Мои надписи', mineEmpty: 'Здесь будут сохранённые надписи.',
    use: 'Взять', del: 'Удалить', examples: 'Примеры', tags: 'Все команды', count: 'Код: {c} симв. · текст: {t}',
    note: 'Шрифты в предпросмотре похожи на игровые, но не те же: в игре буквы немного другие. Если игра обрежет длинный код (например, градиент), сделайте текст короче.',
    warnFont: 'Шрифта «{v}» в игре нет', warnSize: 'Размер {v} — в игре от 40 до 200 %', warnColor: 'Не понял цвет «{v}»', warnClose: 'Лишний закрывающий тег {v}', warnOpen: 'Не закрыт: {v}',
    limit: 'Лимит игры', limitTip: 'Сколько символов принимает поле в игре. Проверьте: наберите цифры 1234567890… и посмотрите, на какой остановится.',
    openTags: 'Без закрывающих тегов', openTip: 'Закрывающие теги в конце и перед новым цветом не набираются: игра показывает текст так же, а код короче.',
    left: 'ещё {n} влезет', over: 'на {n} длиннее, чем принимает игра', fits: 'влезает',
    ph: 'Напишите текст, выделите кусок и нажмите кнопку…',
    help: [
      ['<font=title,140>…</font>', 'шрифт и размер в процентах (40–200)'], ['<font=default,120/80>…</font>', 'ширина / высота отдельно'],
      ['<color=#FF0000>…</color>', 'цвет (можно 255,0,0 или с прозрачностью #FF0000CC)'], ['<outline>…</outline>', 'чёрная обводка; <outline=#FFFFFF80> — свой цвет'],
      ['<b>…</b>  <i>…</i>', 'жирный и курсив'], ['<u>…</u>  <strike>…</strike>', 'подчёркивание и зачёркивание (<u=5> — ниже)']] },
  en: { title: 'Fonts', sub: 'Colored shop name and banner', code: 'Code for the game', copy: 'Copy code', copied: 'Code copied — paste it in the game',
    save: 'Save', clear: 'Clear', strip: 'Remove formatting', font: 'Font', size: 'Size', width: 'Separate width', apply: 'Apply',
    color: 'Color', alpha: 'Opacity', gradient: 'Gradient', outline: 'Outline', bold: 'Bold', thin: 'Thin', thinTip: 'Remove bold', shorten: 'Shorten code', shortenTip: 'Equal colors side by side merge, empty tags go: less to type', steps: 'Colors', every: 'every letter', typeTitle: 'Type it in the game', typeHint: 'The game does not paste with Ctrl+V, so the code has to be typed by hand, exactly. The game field takes only {limit} characters, so closing tags are left out here (the game does not need them) and what does not fit is struck out. A dot · is a space. The shorter the code, the faster: a 3–4 color gradient is much easier to type than one color per letter.', italic: 'Italic', under: 'Underline', strike: 'Strikethrough',
    sel: 'The buttons change the selected part of the code, or the whole text when nothing is selected.',
    preview: 'How it will look', bgNight: 'Night', bgDay: 'Day', bgStone: 'Stone', mine: 'My texts', mineEmpty: 'Saved texts appear here.',
    use: 'Use', del: 'Delete', examples: 'Examples', tags: 'All commands', count: 'Code: {c} chars · text: {t}',
    note: 'The preview uses fonts that look like the game\'s, not the same ones: letters differ a little in the game. If the game cuts a long code (a gradient, say), make the text shorter.',
    warnFont: 'The game has no font «{v}»', warnSize: 'Size {v}: the game takes 40 to 200 %', warnColor: 'Can\'t read the color «{v}»', warnClose: 'Extra closing tag {v}', warnOpen: 'Not closed: {v}',
    limit: 'Game limit', limitTip: 'How many characters the game field takes. Check it: type the digits 1234567890… and see where it stops.',
    openTags: 'No closing tags', openTip: 'Closing tags at the end and before a new color are not typed: the game shows the same text and the code is shorter.',
    left: '{n} more fit', over: '{n} longer than the game takes', fits: 'fits',
    ph: 'Write the text, select a part and press a button…',
    help: [
      ['<font=title,140>…</font>', 'font and size in percent (40–200)'], ['<font=default,120/80>…</font>', 'width / height separately'],
      ['<color=#FF0000>…</color>', 'color (also 255,0,0 or with opacity #FF0000CC)'], ['<outline>…</outline>', 'black outline; <outline=#FFFFFF80> for your own color'],
      ['<b>…</b>  <i>…</i>', 'bold and italic'], ['<u>…</u>  <strike>…</strike>', 'underline and strikethrough (<u=5> sits lower)']] },
};
const FTX = () => FONT_T[lang] || FONT_T.ru;

// the game's ui/fonts.txt: alias → face and size in px; `o` = the alias draws its own outline
// faces: n/b = AGPresquire normal/bold, i/bi = Alegreya italic/bold italic, t = RoyalQuest, a = Arial
const FT_FONTS = {
  default: { f: 'n', s: 17 }, defaultItalic: { f: 'i', s: 17 }, defaultBold: { f: 'b', s: 17 }, defaultBoldItalic: { f: 'bi', s: 17 },
  defaultBoldSmallOutline: { f: 'b', s: 22, o: 1 }, title: { f: 't', s: 22, o: 1 }, titleItalic: { f: 'i', s: 22, o: 1 }, titledMediumOutline: { f: 't', s: 22, o: 1 },
  serif: { f: 'a', s: 17 }, chatfont: { f: 'a', s: 17 }, hint: { f: 'n', s: 17 }, small: { f: 'n', s: 14 }, small2: { f: 'n', s: 14 }, smallBold: { f: 'b', s: 14 },
  names: { f: 'a', s: 13 }, message: { f: 'n', s: 17 }, journal_article_subtitle: { f: 'b', s: 22 }, journal_article_text: { f: 'n', s: 17 }, journal_article_text_bold: { f: 'b', s: 17 },
};
// the look-alike faces; `k` evens out the size (the free fonts are a little narrower)
const FT_FACES = {
  n: { family: '"RQ Philosopher", Georgia, serif', weight: 400, k: 1.07 },
  b: { family: '"RQ Philosopher", Georgia, serif', weight: 700, k: 1.1, ls: '.02em' },
  i: { family: '"RQ Alegreya", Georgia, serif', weight: 400, style: 'italic', k: 1.05 },
  bi: { family: '"RQ Alegreya", Georgia, serif', weight: 700, style: 'italic', k: 1.05 },
  t: { family: '"RQ Alegreya SC", Georgia, serif', weight: 500, k: 1.05, ls: '.1em' },
  a: { family: 'Arial, "Liberation Sans", Arimo, sans-serif', weight: 400, k: 1 },
};
const FT_SWATCHES = ['#FFFFFF', '#FFD700', '#FF9F1C', '#FF4040', '#FF5EC4', '#B36BFF', '#5DA9FF', '#3FE0D0', '#7CFC00', '#A0A0A0', '#000000'];
const FT_MAX_SAVED = 40;

const FT = {
  code: bget('fontCode', ''), bg: bget('fontBg', 'night'), zoom: bget('fontZoom', 2),
  alias: 'title', size: 100, wide: false, width: 100,
  color: '#FFD700', alpha: 255, gsteps: bget('fontSteps', 2), limit: bget('fontLimit', 32), open: bget('fontOpen', true), color2: '#FF4040', ocolor: '#000000', oalpha: 255,
};

// ---------- the tag reader: code → runs of text with their look, plus what looks wrong ----------
const ftHex2 = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0').toUpperCase();
function ftParseColor(v) {
  if (v == null) return null;
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4), 16), a: m[2] ? parseInt(m[2], 16) : 255 };
  m = v.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d{1,3}))?$/);
  if (m && [m[1], m[2], m[3], m[4] ?? '0'].every(x => +x <= 255)) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 255 };
  return null;
}
const ftCss = c => `rgba(${c.r},${c.g},${c.b},${+(c.a / 255).toFixed(3)})`;
const FT_TAG = /<(\/?)(font|color|outline|b|i|u|strike)(?:=([^<>]*))?>/gi;

function ftParse(code) {
  const t = FTX(), warn = [];
  const st = { font: [], color: [], outline: [], b: [], i: [], u: [], strike: [] };
  const runs = [];
  const top = k => st[k][st[k].length - 1];
  const look = () => {
    const f = top('font') || { alias: 'default', w: 100, h: 100 };
    let alias = f.alias;
    // <b>/<i> switch to the alias's Bold/Italic twin when the game has one (default → defaultBold), else nothing changes
    const b = st.b.length > 0, i = st.i.length > 0;
    if (b || i) {
      const base = alias.replace(/(Bold)?(Italic)?$/, '');
      const wantB = b || /Bold/.test(alias.slice(base.length)), wantI = i || /Italic$/.test(alias);
      for (const c of [base + (wantB ? 'Bold' : '') + (wantI ? 'Italic' : ''), base + (b ? 'Bold' : ''), base + (i ? 'Italic' : '')]) if (FT_FONTS[c]) { alias = c; break; }
    }
    return { alias, w: f.w, h: f.h, color: top('color'), outline: top('outline'), u: top('u'), strike: top('strike') };
  };
  let last = 0, m;
  const text = s => { if (s) runs.push({ text: s, look: look() }); };
  FT_TAG.lastIndex = 0;
  while ((m = FT_TAG.exec(code))) {
    const [all, close, nameRaw, arg] = m, name = nameRaw.toLowerCase();
    let entry = true;
    if (!close) {
      if (name === 'font') {
        const [alias, sz] = (arg || '').split(',').map(s => s.trim());
        const real = FT_FONTS[alias] ? alias : Object.keys(FT_FONTS).find(k => k.toLowerCase() === (alias || '').toLowerCase());
        if (!real) warn.push(fmtT(t.warnFont, { v: alias || '' }));
        let w = 100, hh = 100;
        if (sz) {
          const p = sz.split('/').map(Number);
          if (p.some(x => !isFinite(x) || x < 40 || x > 200)) warn.push(fmtT(t.warnSize, { v: sz }));
          w = clamp(p[0] || 100, 40, 200); hh = p.length > 1 ? clamp(p[1] || 100, 40, 200) : w;
        }
        entry = { alias: real || (top('font') || { alias: 'default' }).alias, w, h: hh };
      } else if (name === 'color' || name === 'outline') {
        const c = arg == null ? (name === 'outline' ? { r: 0, g: 0, b: 0, a: 255 } : null) : ftParseColor(arg);
        if (!c) { warn.push(fmtT(t.warnColor, { v: arg ?? '' })); entry = top(name) || null; } else entry = c;
      } else if (name === 'u' || name === 'strike') entry = { off: arg != null && isFinite(+arg) ? clamp(+arg, 0, 99) : 0 };
    }
    // an opening tag the game does not know stays as text
    text(code.slice(last, m.index));
    last = m.index + all.length;
    if (close) { if (st[name].length) st[name].pop(); else warn.push(fmtT(t.warnClose, { v: all })); }
    else st[name].push(entry);
  }
  text(code.slice(last));
  const open = Object.entries(st).filter(([, a]) => a.length).map(([k]) => `<${k}>`);
  // with «no closing tags» (FT.open) a tag left open is how the game code is meant to be
  if (open.length && !FT.open) warn.push(fmtT(t.warnOpen, { v: open.join(' ') }));
  return { runs, warn: [...new Set(warn)] };
}

// ---------- the preview ----------
function ftRender(code, zoom) {
  const box = h('div', { class: 'ft-line', translate: 'no' });
  const { runs, warn } = ftParse(code);
  for (const r of runs) {
    const L = r.look, F = FT_FONTS[L.alias] || FT_FONTS.default, face = FT_FACES[F.f];
    const px = F.s * face.k * zoom * L.h / 100;
    const shadows = [];
    if (L.outline) {
      const w = Math.max(1, Math.round(px * 0.07)), c = ftCss(L.outline);
      for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) shadows.push(`${x * w}px ${y * w}px 0 ${c}`);
    } else if (F.o) shadows.push(`0 0 ${Math.max(2, px * 0.12)}px rgba(0,0,0,.9)`, `0 1px 1px rgba(0,0,0,.8)`);
    else shadows.push('0 1px 2px rgba(0,0,0,.65)');
    const deco = [L.u && 'underline', L.strike && 'line-through'].filter(Boolean).join(' ');
    const css = [`font-family:${face.family}`, `font-weight:${face.weight}`, `font-style:${face.style || 'normal'}`, `font-size:${px.toFixed(1)}px`,
      `color:${L.color ? ftCss(L.color) : '#fff'}`, `text-shadow:${shadows.join(',')}`, face.ls ? `letter-spacing:${face.ls}` : '',
      deco ? `text-decoration:${deco};text-decoration-thickness:${Math.max(1, px / 14).toFixed(1)}px;text-decoration-skip-ink:none` : '',
      L.u ? `text-underline-offset:${((L.u.off || 0) * zoom / 2 + 1).toFixed(1)}px` : ''].filter(Boolean).join(';');
    const span = h('span', { style: css }, r.text);
    if (L.w !== L.h) { span.classList.add('ft-stretch'); span.dataset.k = L.w / L.h; }
    box.append(span);
  }
  if (!runs.length) box.append(h('span', { class: 'ft-empty' }, '…'));
  return { box, warn, chars: runs.reduce((n, r) => n + [...r.text].length, 0) };
}
// width ≠ height: the game stretches the letters; CSS scales the span and makes room for the new width
function ftStretch(root) {
  for (const s of root.querySelectorAll('.ft-stretch')) {
    const k = +s.dataset.k; // offsetWidth is the width before the transform
    s.style.transform = `scaleX(${k})`;
    s.style.marginRight = `${(s.offsetWidth * (k - 1)).toFixed(1)}px`;
  }
}

// ---------- editing the code ----------
const ftArea = () => document.getElementById('ftCode');
function ftSel() {
  const ta = ftArea(), v = ta.value;
  let s = ta.selectionStart, e = ta.selectionEnd;
  if (s === e) { s = 0; e = v.length; }
  return { ta, v, s, e, part: v.slice(s, e) };
}
function ftSet(v, s, e) {
  const ta = ftArea();
  ta.value = v; FT.code = v; store.set('fontCode', v);
  ta.focus(); ta.setSelectionRange(s, e);
  ftDraw();
}
function ftWrap(open, close) {
  const { v, s, e, part } = ftSel();
  if (!part.trim()) return;
  ftSet(v.slice(0, s) + open + part + close + v.slice(e), s, s + open.length + part.length + close.length);
}
const ftStripTags = s => s.replace(FT_TAG, '');
function ftStrip(only) {
  const { v, s, e, part } = ftSel();
  const out = only ? part.replace(new RegExp(`</?${only}(?:=[^<>]*)?>`, 'gi'), '') : ftStripTags(part);
  ftSet(v.slice(0, s) + out + v.slice(e), s, s + out.length);
  return out;
}
// «Тонкий»: bold goes away — the <b> tags and the bold fonts in the selection (defaultBold → default)
// B / I / U / S switch on and off: a selection that already has the tag (inside it or wrapped by it) loses it, else gets it
const ftTagRe = (tag, g) => new RegExp(String.raw`<(/?)${tag}(?:=[^<>]*)?>`, g ? 'gi' : 'i');
// the tag around the selection: [index of its opening tag, its length, index of its closing tag or -1] or null
function ftAround(tag, v, s, e) {
  let depth = 0, open = null;
  const re = ftTagRe(tag, true); let m;
  while ((m = re.exec(v)) && m.index < s) {
    if (m[1]) { depth--; if (depth <= 0) { depth = 0; open = null; } } else { depth++; if (depth === 1) open = [m.index, m[0].length]; }
  }
  if (!open) return null;
  re.lastIndex = Math.max(e, open[0] + open[1]);
  let close = -1; depth = 1;
  while ((m = re.exec(v))) { if (m[1]) { if (--depth === 0) { close = m.index; break; } } else depth++; }
  return [open[0], open[1], close, close >= 0 ? (v.slice(close).match(ftTagRe(tag)) || [''])[0].length : 0];
}
function ftTagOn(tag) {
  const ta = ftArea();
  if (!ta) return false;
  const { v, s, e, part } = ftSel();
  return ftTagRe(tag).test(part) || !!ftAround(tag, v, s, e);
}
function ftToggle(tag) {
  const { v, s, e, part } = ftSel();
  if (ftTagRe(tag).test(part)) {
    const out = part.replace(ftTagRe(tag, true), '');
    ftSet(v.slice(0, s) + out + v.slice(e), s, s + out.length);
  } else {
    const a = ftAround(tag, v, s, e);
    if (!a) return ftWrap(`<${tag}>`, `</${tag}>`);
    const [o, ol, c, cl] = a;
    let nv = v;
    if (c >= 0) nv = nv.slice(0, c) + nv.slice(c + cl);
    nv = nv.slice(0, o) + nv.slice(o + ol);
    ftSet(nv, s - ol, e - ol);
  }
}
// two opening tags mean the same: <color=255,0,0> = <color=#FF0000>, <outline> = <outline=#000000FF>, <font=title,100> = <font=title>
function ftSameTag(a, b) {
  const parse = x => { const m = x.match(/^<([a-z]+)(?:=([^<>]*))?>$/i); return m ? [m[1].toLowerCase(), m[2]] : [x, null]; };
  const [ta, va] = parse(a), [tb, vb] = parse(b);
  if (ta !== tb) return false;
  if (ta === 'color' || ta === 'outline') {
    const black = { r: 0, g: 0, b: 0, a: 255 };
    const ca = va == null && ta === 'outline' ? black : ftParseColor(va), cb = vb == null && tb === 'outline' ? black : ftParseColor(vb);
    return !!ca && !!cb && ca.r === cb.r && ca.g === cb.g && ca.b === cb.b && ca.a === cb.a;
  }
  const norm = v => String(v ?? '').replace(/\s/g, '').toLowerCase().replace(/,100(\/100)?$/, '');
  return norm(va) === norm(vb);
}
// color / outline / font switch like B: the same one again takes it off, another one takes the old one's place
function ftToggleValue(tag, open) {
  const { v, s, e, part } = ftSel();
  const close = `</${tag}>`, re = ftTagRe(tag, true);
  const opens = [...part.matchAll(re)].filter(m => !m[1]).map(m => m[0]);
  if (opens.length) {
    const bare = part.replace(re, '');
    const out = opens.every(o => ftSameTag(o, open)) ? bare : open + bare + close;
    return ftSet(v.slice(0, s) + out + v.slice(e), s, s + out.length);
  }
  const a = ftAround(tag, v, s, e);
  if (!a) return ftWrap(open, close);
  const [o, ol, c, cl] = a;
  if (ftSameTag(v.slice(o, o + ol), open)) {
    let nv = v;
    if (c >= 0) nv = nv.slice(0, c) + nv.slice(c + cl);
    nv = nv.slice(0, o) + nv.slice(o + ol);
    return ftSet(nv, s - ol, e - ol);
  }
  const d = open.length - ol;
  ftSet(v.slice(0, o) + open + v.slice(o + ol), s + d, e + d);
}
// the B / I / U / S buttons light up when the selection already has the tag
function ftMarkTags() {
  for (const b of document.querySelectorAll('.ft-tools [data-tag]')) b.classList.toggle('on', ftTagOn(b.dataset.tag));
}
function ftThin() {
  const { v, s, e, part } = ftSel();
  const out = part.replace(/<\/?b>/gi, '').replace(/<font=([A-Za-z_]+?)Bold(Italic)?(?=[,>])/g, (m, base, it) => {
    const thin = base + (it || '');
    return FT_FONTS[thin] ? `<font=${thin}` : m;
  }).replace(/<font=defaultBoldSmallOutline(?=[,>])/g, '<font=default').replace(/<font=smallBold(?=[,>])/g, '<font=small');
  ftSet(v.slice(0, s) + out + v.slice(e), s, s + out.length);
}
const ftColorCode = (hex, a) => hex.toUpperCase() + (a < 255 ? ftHex2(a) : '');
// a color per letter from the first color to the second, over the selection (its old colors go)
function ftGradient() {
  const { v, s, e, part } = ftSel();
  const clean = part.replace(/<\/?color(?:=[^<>]*)?>/gi, '');
  const parts = clean.split(/(<[^<>]*>)/);
  const letters = parts.filter((p, i) => i % 2 === 0).join('').replace(/\s/g, '').length;
  if (!letters) return;
  const a = ftParseColor(FT.color), b = ftParseColor(FT.color2);
  let n = 0;
  const out = parts.map((p, i) => (i % 2 ? p : [...p].map(ch => {
    if (/\s/.test(ch)) return ch;
    // FT.gsteps colors over the letters (0 = a color per letter); equal neighbours merge in ftShorten
    const idx = n++, steps = FT.gsteps && FT.gsteps < letters ? FT.gsteps : letters;
    const k = steps > 1 ? Math.floor(idx * steps / letters) / (steps - 1) : 0;
    const c = '#' + ftHex2(a.r + (b.r - a.r) * k) + ftHex2(a.g + (b.g - a.g) * k) + ftHex2(a.b + (b.b - a.b) * k);
    return `<color=${ftColorCode(c, FT.alpha)}>${ch}</color>`;
  }).join(''))).join('');
  const short = ftShorten(out);
  ftSet(v.slice(0, s) + short + v.slice(e), s, s + short.length);
}
// what is typed in the game (its field takes 32 characters): shortened; each color in its shorter spelling
// (#000000 → 0,0,0); with «no closing tags» a tag is not closed at the end or before the next tag of its kind
// (<color=A>x</color><color=B>y</color> → <color=A>x<color=B>y): the newer tag wins anyway
function ftGameCode(code) {
  code = ftShorten(code).replace(/<(color|outline)=#([0-9a-f]{6})([0-9a-f]{2})?>/gi, (m, tag, rgb, a) => {
    const nums = [0, 2, 4].map(i => parseInt(rgb.slice(i, i + 2), 16));
    if (a) nums.push(parseInt(a, 16));
    const dec = nums.join(',');
    return dec.length < rgb.length + 1 + (a ? 2 : 0) ? `<${tag}=${dec}>` : m;
  });
  if (!FT.open) return code;
  let prev;
  do {
    prev = code;
    code = code.replace(/<\/(color|font|outline)>((?:\s|<\/?(?:font|color|outline|b|i|u|strike)(?:=[^<>]*)?>)*?)<\1=/gi, '$2<$1=').replace(/(?:<\/(?:font|color|outline|b|i|u|strike)>)+(\s*)$/i, '$1');
  } while (code !== prev);
  return code.replace(/\s+$/, '');
}
// less to type: <color=X>a</color> <color=X>b</color> → <color=X>a b</color>, and <b></b> goes
function ftShorten(code) {
  let prev;
  do {
    prev = code;
    code = code.replace(/<(color|font|outline)=([^<>]*)>([^<>]*)<\/\1>(\s*)<\1=\2>/gi, '<$1=$2>$3$4')
      .replace(/<(font|color|outline|b|i|u|strike)(?:=[^<>]*)?><\/\1>/gi, '');
  } while (code !== prev);
  return code;
}

// ready texts to start from, each fits the game's 32 characters once typed (closing tags dropped):
// Russian shop words for a Russian/Ukrainian page, English otherwise
function ftExamples() {
  const ru = lang !== 'en';
  return [
    `<font=title><color=#FFD700>${ru ? 'Лавка' : 'Shop'}</color></font>`,
    `<color=0,255,0><outline>${ru ? 'Продам' : 'Selling'}</outline></color>`,
    `<b>${ru ? 'Скупка' : 'Buying'} <color=255,0,0>${ru ? 'дёшево' : 'cheap'}</color></b>`,
    `<strike>1000</strike> <u>${ru ? '800 з' : '800 g'}</u>`,
    `<font=default,200/80>${ru ? 'Широко' : 'Wide'}</font>`,
    `<i><color=#B36BFF>${ru ? 'недорого' : 'fair price'}</color></i>`,
  ];
}

function renderFontTool(el) {
  const t = FTX();
  const seg = (items, cur, on) => h('div', { class: 'seg' }, items.map(([v, label]) => h('button', { class: v === cur ? 'on' : '', onclick: () => on(v) }, label)));
  const num = (min, max, key, label, onInput) => {
    const out = h('b', null, FT[key] + '%');
    const r = h('input', { type: 'range', min, max, value: FT[key] });
    r.addEventListener('input', () => { FT[key] = +r.value; out.textContent = r.value + '%'; onInput && onInput(); });
    return h('label', { class: 'ft-num' }, h('span', null, label), r, out);
  };
  const colorIn = (key, onChange) => {
    const c = h('input', { type: 'color', value: FT[key].toLowerCase(), class: 'ft-color' });
    c.addEventListener('input', () => { FT[key] = c.value.toUpperCase(); onChange && onChange(); });
    return c;
  };
  const alphaIn = key => {
    const r = h('input', { type: 'range', min: 0, max: 255, value: FT[key], class: 'ft-alpha', title: t.alpha });
    r.addEventListener('input', () => { FT[key] = +r.value; });
    return r;
  };
  const tbtn = (label, title, on, cls, tag) => h('button', { class: 'btn small ' + (cls || ''), title, 'data-tag': tag, onmousedown: e => e.preventDefault(), onclick: on }, label);

  // font
  const fsel = h('select', { class: 'ft-sel' }, Object.keys(FT_FONTS).map(k => h('option', { value: k, selected: k === FT.alias }, k)));
  fsel.addEventListener('change', () => { FT.alias = fsel.value; });
  const widthRow = num(40, 200, 'width', t.width.replace(/ .*/, ''));
  widthRow.hidden = !FT.wide;
  const wideChk = h('input', { type: 'checkbox', checked: FT.wide });
  wideChk.addEventListener('change', () => { FT.wide = wideChk.checked; widthRow.hidden = !FT.wide; });
  const fontTag = () => {
    const sz = FT.wide ? `${FT.width}/${FT.size}` : FT.size !== 100 ? String(FT.size) : '';
    return `<font=${FT.alias}${sz ? ',' + sz : ''}>`;
  };
  // swatches set the first color
  const from = h('span', { class: 'ft-from', style: 'background:' + FT.color });
  const c1 = colorIn('color', () => { from.style.background = FT.color; }), c2 = colorIn('color2'), oc = colorIn('ocolor');
  const swatches = h('div', { class: 'ft-swatches' }, FT_SWATCHES.map(c => h('button', { class: 'ft-sw', style: `background:${c}`, title: c, onmousedown: e => e.preventDefault(),
    onclick: () => { FT.color = c; c1.value = c.toLowerCase(); from.style.background = c; ftToggleValue('color', `<color=${ftColorCode(c, FT.alpha)}>`); } })));

  const ta = h('textarea', { id: 'ftCode', class: 'inp ft-code', spellcheck: false, placeholder: t.ph, rows: 4 });
  ta.value = FT.code;
  ta.addEventListener('input', () => { FT.code = ta.value; store.set('fontCode', ta.value); ftDraw(); });
  for (const ev of ['select', 'keyup', 'mouseup', 'focus']) ta.addEventListener(ev, () => ftMarkTags());

  const tools = h('div', { class: 'ft-tools' },
    h('div', { class: 'ft-row' },
      tbtn(h('b', null, t.bold), t.bold, () => ftToggle('b'), 'ft-tg', 'b'),
      tbtn(t.thin, t.thinTip, () => ftThin()),
      tbtn(h('i', null, 'I'), t.italic, () => ftToggle('i'), 'ft-tg', 'i'),
      tbtn(h('u', null, 'U'), t.under, () => ftToggle('u'), 'ft-tg', 'u'),
      tbtn(h('s', null, 'S'), t.strike, () => ftToggle('strike'), 'ft-tg', 'strike'),
      tbtn(t.strip, t.strip, () => ftStrip(), 'ghost ft-right')),
    h('div', { class: 'ft-row' },
      h('span', { class: 'ft-lab' }, t.font), fsel,
      num(40, 200, 'size', t.size),
      h('label', { class: 'ft-chk' }, wideChk, t.width), widthRow,
      tbtn(t.apply, t.font, () => ftToggleValue('font', fontTag()), 'primary')),
    h('div', { class: 'ft-row' },
      h('span', { class: 'ft-lab' }, t.color), c1, alphaIn('alpha'),
      tbtn(t.apply, t.color, () => ftToggleValue('color', `<color=${ftColorCode(FT.color, FT.alpha)}>`), 'primary'),
      swatches),
    h('div', { class: 'ft-row' },
      h('span', { class: 'ft-lab' }, t.gradient), from, h('span', { class: 'ft-grad' }, '→'), c2,
      (() => {
        const sel = h('select', { class: 'ft-sel ft-steps', title: t.steps }, [2, 3, 4, 5, 6, 0].map(n => h('option', { value: n, selected: n === FT.gsteps }, n ? `${t.steps}: ${n}` : t.every)));
        sel.addEventListener('change', () => { FT.gsteps = +sel.value; store.set('fontSteps', FT.gsteps); });
        return sel;
      })(),
      tbtn(t.apply, t.gradient, ftGradient, 'primary'),
      h('span', { class: 'ft-lab ft-gap' }, t.outline), oc, alphaIn('oalpha'),
      tbtn(t.apply, t.outline, () => {
        const plain = FT.ocolor.toUpperCase() === '#000000' && FT.oalpha === 255;
        ftToggleValue('outline', plain ? '<outline>' : `<outline=${ftColorCode(FT.ocolor, 255)}${ftHex2(FT.oalpha)}>`);
      }, 'primary')),
    h('div', { class: 'hint' }, t.sel));

  const bgs = [['night', t.bgNight], ['day', t.bgDay], ['stone', t.bgStone]];
  el.append(
    h('div', { class: 'ft-wrap' },
      h('div', { class: 'ft-main' },
        h('div', { class: 'ft-stage-head' }, h('h3', null, t.preview),
          seg(bgs, FT.bg, v => { FT.bg = v; store.set('fontBg', v); renderCenter(); }),
          seg([[1, '1×'], [1.5, '1.5×'], [2, '2×'], [3, '3×']], FT.zoom, v => { FT.zoom = v; store.set('fontZoom', v); ftDraw(); })),
        h('div', { id: 'ftStage', class: 'ft-stage bg-' + FT.bg }),
        h('div', { class: 'ft-code-head' }, h('h3', null, t.code), h('span', { id: 'ftCount', class: 'ft-count' })),
        ta,
        h('div', { id: 'ftWarn', class: 'ft-warn' }),
        h('div', { class: 'ft-type-box' },
          h('div', { class: 'ft-type-head' }, h('b', null, t.typeTitle), h('span', { id: 'ftLeft', class: 'ft-left' }),
            (() => {
              const n = h('input', { type: 'number', min: 8, max: 999, value: FT.limit, class: 'inp ft-limit' });
              n.addEventListener('input', () => { if (+n.value >= 8) { FT.limit = +n.value; store.set('fontLimit', FT.limit); ftDrawType(); } });
              return h('label', { class: 'ft-chk', title: t.limitTip }, t.limit, n);
            })(),
            (() => {
              const c = h('input', { type: 'checkbox', checked: FT.open });
              c.addEventListener('change', () => { FT.open = c.checked; store.set('fontOpen', FT.open); ftDraw(); });
              return h('label', { class: 'ft-chk', title: t.openTip }, c, t.openTags);
            })()),
          h('div', { id: 'ftType', class: 'ft-type', translate: 'no' }),
          h('div', { class: 'hint', id: 'ftTypeHint' }, fmtT(t.typeHint, { limit: FT.limit }))),
        h('div', { class: 'ft-actions' },
          h('button', { class: 'btn primary', onclick: () => FT.code.trim() && copyText(ftGameCode(FT.code), t.copied) }, iconEl('code'), ' ', t.copy),
          h('button', { class: 'btn', onclick: () => { if (!FT.code.trim()) return; const list = bget('fontSaved', []).filter(x => x !== FT.code); list.unshift(FT.code); store.set('fontSaved', list.slice(0, FT_MAX_SAVED)); ftDrawSaved(); } }, t.save),
          h('button', { class: 'btn', title: t.shortenTip, onclick: () => { const v = ftShorten(FT.code); ftSet(v, 0, 0); } }, t.shorten),
          h('button', { class: 'btn ghost', onclick: () => ftSet('', 0, 0) }, t.clear)),
        tools),
      h('div', { class: 'ft-side' },
        h('h3', null, t.mine), h('div', { id: 'ftSaved', class: 'ft-list' }),
        h('h3', null, t.examples), h('div', { id: 'ftExamples', class: 'ft-list' }),
        h('details', { class: 'ft-help' }, h('summary', null, t.tags),
          h('div', { translate: 'no' }, t.help.map(([c, d]) => h('div', { class: 'ft-help-row' }, h('code', null, c), h('span', null, d))),
            h('div', { class: 'ft-help-row' }, h('code', null, 'font='), h('span', null, Object.keys(FT_FONTS).join(', '))))),
        h('div', { class: 'note ft-note' }, t.note))));
  ftDraw();
  ftDrawSaved();
}

function ftDraw() {
  const stage = document.getElementById('ftStage');
  if (!stage) return;
  const t = FTX();
  const { box, warn, chars } = ftRender(FT.code, FT.zoom);
  stage.innerHTML = '';
  stage.append(box);
  requestAnimationFrame(() => ftStretch(box));
  if (document.fonts) document.fonts.ready.then(() => ftStretch(box));
  document.getElementById('ftCount').textContent = fmtT(t.count, { c: [...FT.code].length, t: chars });
  const w = document.getElementById('ftWarn');
  w.innerHTML = '';
  for (const s of warn) w.append(h('div', null, '⚠ ' + s));
  ftDrawType();
  ftMarkTags();
}
// the code to type by hand, big: tags in color, every space shown as a dot
function ftDrawType() {
  const el = document.getElementById('ftType');
  if (!el) return;
  el.innerHTML = '';
  const code = ftGameCode(FT.code), t = FTX(), n = [...code].length, left = document.getElementById('ftLeft');
  el.classList.toggle('over', n > FT.limit);
  if (left) {
    left.textContent = `${n} / ${FT.limit} · ` + (n > FT.limit ? fmtT(t.over, { n: n - FT.limit }) : n === FT.limit ? t.fits : fmtT(t.left, { n: FT.limit - n }));
    left.classList.toggle('bad', n > FT.limit);
  }
  if (!code) { el.append(h('span', { class: 'ft-empty' }, '…')); return; }
  // the characters past the game's limit are struck out: the game would not take them
  let pos = 0;
  const cut = (txt, cls) => {
    const out = [];
    const a = [...txt], keep = Math.max(0, Math.min(a.length, FT.limit - pos));
    if (keep) out.push(h('span', { class: cls }, a.slice(0, keep).join('')));
    if (keep < a.length) out.push(h('span', { class: (cls || '') + ' cut' }, a.slice(keep).join('')));
    pos += a.length;
    return out;
  };
  for (const [i, p] of code.split(/(<\/?(?:font|color|outline|b|i|u|strike)(?:=[^<>]*)?>)/i).entries()) {
    if (!p) continue;
    if (i % 2) el.append(...cut(p, 'tg' + (p[1] === '/' ? ' cl' : '')));
    else for (const part of p.split(/( +)/)) {
      if (!part) continue;
      el.append(...(part[0] === ' ' ? cut('·'.repeat(part.length), 'sp') : cut(part, '')));
    }
  }
}

// a row: the text drawn small, a click puts it in the editor
function ftItem(code, del) {
  const t = FTX();
  const { box } = ftRender(code, 1.2);
  const row = h('div', { class: 'ft-item', title: code, onclick: () => { ftSet(code, 0, 0); ftArea().setSelectionRange(0, 0); } },
    h('div', { class: 'ft-item-pic' }, box),
    del ? h('button', { class: 'btn small ghost danger', title: t.del, onclick: e => { e.stopPropagation(); del(); } }, '×') : null);
  requestAnimationFrame(() => ftStretch(box));
  return row;
}
function ftDrawSaved() {
  const t = FTX(), el = document.getElementById('ftSaved'), ex = document.getElementById('ftExamples');
  if (!el) return;
  const list = bget('fontSaved', []);
  el.innerHTML = '';
  if (!list.length) el.append(h('div', { class: 'hint' }, t.mineEmpty));
  list.forEach((code, i) => el.append(ftItem(code, () => { const l = bget('fontSaved', []); l.splice(i, 1); store.set('fontSaved', l); ftDrawSaved(); })));
  ex.innerHTML = '';
  for (const code of ftExamples()) ex.append(ftItem(code));
}
