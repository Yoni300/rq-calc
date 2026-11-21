'use strict';
/* Boss alerts and card scanner results in the screen corner (main.js opens this page in a small always-on-top window).
   Messages stack up (newest at the bottom), close themselves after a while, a click opens the timer. */
const stack = document.getElementById('stack');
const WIDTH = 380, SHOW_FOR = { soon: 12000, up: 25000 }, MAX = 4;

function fit() {
  // the window follows the messages; 0 hides it
  requestAnimationFrame(() => window.rqcAlert.size(WIDTH, stack.children.length ? Math.ceil(stack.getBoundingClientRect().height) + 8 : 0));
}
function close(card) {
  if (card.closing) return;
  card.closing = true;
  card.classList.add('out');
  setTimeout(() => { card.remove(); fit(); }, 260);
}

window.rqcAlert.onAlert(a => {
  // a newer message about the same boss replaces the older one
  let replaced = false;
  for (const c of [...stack.children]) if (c.dataset.key === a.key) { c.remove(); replaced = true; }
  if (a.remove) { fit(); return; }
  // a sticky message (the card scanner's total) stays until it is reset: older ordinary ones make room first
  while (stack.children.length >= MAX) ([...stack.children].find(c => !c.dataset.sticky) || stack.firstElementChild).remove();

  const card = document.createElement('div');
  card.className = 'card ' + a.kind + (a.sticky ? ' sticky' : '') + (a.sticky && replaced ? ' still' : '');
  card.dataset.key = a.key;
  if (a.sticky) card.dataset.sticky = '1';
  const pic = document.createElement('div');
  pic.className = 'pic';
  if (a.img) { const im = document.createElement('img'); im.src = a.img; pic.append(im); }
  const text = document.createElement('div');
  text.className = 'text';
  const t = document.createElement('div'); t.className = 'title'; t.textContent = a.title;
  const s = document.createElement('div'); s.className = 'sub'; s.textContent = a.sub || '';
  text.append(t);
  // card scanner: the big line with the result («190 знаков ≈ 10 450 000»)
  if (a.big) { const b = document.createElement('div'); b.className = 'big'; b.textContent = a.big; text.append(b); }
  text.append(s);
  // optional buttons («Установить»): do their thing in main.js and close the message (a sticky one is redrawn instead)
  const actions = a.actions || (a.action ? [a.action] : []);
  if (actions.length) {
    const row = document.createElement('div');
    row.className = 'acts';
    for (const act of actions) {
      const b = document.createElement('button');
      b.className = 'act'; b.textContent = act.label;
      b.addEventListener('click', e => { e.stopPropagation(); window.rqcAlert.action(act.id); if (!a.sticky) close(card); });
      row.append(b);
    }
    text.append(row);
  }
  if (a.sticky) {
    card.append(pic, text);
    stack.append(card);
    fit();
    return;
  }
  const x = document.createElement('button');
  x.className = 'x'; x.textContent = '✕';
  x.addEventListener('click', e => { e.stopPropagation(); close(card); });
  const bar = document.createElement('i');
  bar.className = 'bar';
  const ms = a.ms || SHOW_FOR[a.kind] || 15000;
  bar.style.animationDuration = ms + 'ms';
  card.append(pic, text, x, bar);
  // a click opens the boss timer (card scanner messages only close)
  card.addEventListener('click', () => { if (!a.noOpen) window.rqcAlert.open(); close(card); });
  stack.append(card);
  fit();
  setTimeout(() => close(card), ms);
});
