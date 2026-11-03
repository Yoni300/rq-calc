'use strict';
/* global ctx, ch, T, buildName, IMG, DOLL_POS, MODEL_BGS, modelBg, allowedSets, slotLockedByTwoHander, recalc, lastResult,
   fmtNum, fmtStat, descNote, h, openModal, closeModal, toast, buildLink, copyText */

// Build card: a picture of the current build (character window, key numbers) to post in Discord or on the forum.
// Drawn on a canvas at 2x, so the PNG stays sharp after Discord shrinks it.
const CARD_W = 1200, CARD_H = 675, CARD_SCALE = 2;
const CARD_FONT = { display: '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif', body: '"Segoe UI", system-ui, sans-serif' };
const CARD_C = {
  bg: '#0b0a08', fg: '#eee4cf', muted: '#a89a80', dim: '#6f6553',
  gold: '#e6b85c', gold2: '#c9963f', gold3: '#8a6428', goldHi: '#ffe2a0', onGold: '#1d1407', card: '#c3a0ff',
};

function cardImage(src) {
  return new Promise(res => {
    if (!src) return res(null);
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}
function cardRound(g, x, y, w, hh, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r);
  g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// shrinks the font until the text fits the width
function cardFit(g, text, font, size, maxW, minSize = 12) {
  let s = size;
  for (; s > minSize; s--) { g.font = font(s); if (g.measureText(text).width <= maxW) break; }
  g.font = font(s);
  return s;
}
// background-size: auto <k>% + background-position: <px>% <py>% (as on the gear tab)
function cardCover(g, im, x, y, w, hh, size, pos) {
  const k = parseFloat(String(size).split(' ')[1]) / 100 || 1;
  const [px, py] = String(pos).split(' ').map(v => parseFloat(v) / 100);
  const dh = hh * k, dw = im.width * dh / im.height;
  g.drawImage(im, x + (w - dw) * (px || 0), y + (hh - dh) * (py || 0), dw, dh);
}

async function drawBuildCard() {
  const r = lastResult || recalc();
  const cls = ctx.classes.get(ch.classId);
  const gender = ctx.genders.find(x => x.Id === ch.genderId);
  const sets = allowedSets(ch);
  const keys = new Set(ctx.slotKeys());
  const costumeE = ch.equipment['14:0'];
  const costume = costumeE && ctx.equipment.get(costumeE.itemId);
  const costumeImg = costume && costume.costumeImageId && (costume.genderId == null || costume.genderId === ch.genderId) ? costume.costumeImageId : null;
  const figureId = costumeImg || gender?.Image_Id;
  const bg = MODEL_BGS.find(b => b.id === modelBg) || MODEL_BGS[0];

  // every picture first, so drawing is one pass
  const slotList = Object.entries(DOLL_POS).filter(([key]) => keys.has(key)).map(([key, pos]) => {
    const slot = ctx.slots.get(+key.split(':')[0]);
    const e = ch.equipment[key];
    const item = e && ctx.equipment.get(e.itemId);
    return { key, pos, slot, e, item };
  });
  const [bgIm, figIm, artIm, clsIm, ...slotIms] = await Promise.all([
    cardImage(`bg/${bg.id}.jpg`),
    costumeImg ? cardImage(`../data/costumes/${costumeImg}.png`).then(im => im || cardImage(IMG(figureId))) : cardImage(IMG(figureId)),
    cardImage(IMG(cls.artImageId)),
    cardImage(IMG(cls.imageId)),
    ...slotList.map(s => cardImage(IMG(s.item ? s.item.imageId : s.slot.imageId))),
  ]);

  const cv = document.createElement('canvas');
  cv.width = CARD_W * CARD_SCALE; cv.height = CARD_H * CARD_SCALE;
  const g = cv.getContext('2d');
  g.scale(CARD_SCALE, CARD_SCALE);
  g.imageSmoothingQuality = 'high';
  g.textBaseline = 'alphabetic';

  // ---- background and frame
  g.fillStyle = CARD_C.bg; g.fillRect(0, 0, CARD_W, CARD_H);
  let gr = g.createRadialGradient(330, 60, 0, 330, 60, 700);
  gr.addColorStop(0, 'rgba(230,184,92,.10)'); gr.addColorStop(1, 'rgba(230,184,92,0)');
  g.fillStyle = gr; g.fillRect(0, 0, CARD_W, CARD_H);
  gr = g.createRadialGradient(950, 700, 0, 950, 700, 600);
  gr.addColorStop(0, 'rgba(230,184,92,.06)'); gr.addColorStop(1, 'rgba(230,184,92,0)');
  g.fillStyle = gr; g.fillRect(0, 0, CARD_W, CARD_H);
  cardRound(g, 10.5, 10.5, CARD_W - 21, CARD_H - 21, 14);
  g.strokeStyle = 'rgba(214,168,79,.45)'; g.lineWidth = 1; g.stroke();
  cardRound(g, 15.5, 15.5, CARD_W - 31, CARD_H - 31, 11);
  g.strokeStyle = 'rgba(214,168,79,.14)'; g.stroke();

  // ---- character window (same grid as the gear tab)
  const s = 64, gx = 10, gy = 12, mw = 236, pad = 20;
  const winW = 3 * s + mw + 3 * gx + 2 * pad, winH = 7 * s + 6 * gy + 2 * pad;
  const wx = 40, wy = (CARD_H - winH) / 2;
  gr = g.createLinearGradient(0, wy, 0, wy + winH);
  gr.addColorStop(0, '#221c15'); gr.addColorStop(1, '#15120d');
  cardRound(g, wx, wy, winW, winH, 12); g.fillStyle = gr; g.fill();
  g.strokeStyle = 'rgba(214,168,79,.55)'; g.stroke();
  // grid columns [s, mw, s, s] like the app; the model covers columns 2–3
  const cx = c => wx + pad + [0, s + gx, s + gx + mw + gx, 2 * s + 3 * gx + mw][c - 1];
  const cy = row => wy + pad + (row - 1) * (s + gy);

  // model area: columns 2–3, rows 1–6
  const mx = cx(2), my = cy(1), mW = cx(4) - gx - mx, mH = cy(7) - gy - my;
  g.save();
  cardRound(g, mx, my, mW, mH, 8); g.clip();
  g.fillStyle = '#0d0b08'; g.fillRect(mx, my, mW, mH);
  if (bgIm) cardCover(g, bgIm, mx, my, mW, mH, bg.size, bg.pos);
  gr = g.createLinearGradient(0, my, 0, my + mH);
  gr.addColorStop(0, 'rgba(8,6,4,.35)'); gr.addColorStop(.55, 'rgba(8,6,4,.05)'); gr.addColorStop(1, 'rgba(6,5,3,.85)');
  g.fillStyle = gr; g.fillRect(mx, my, mW, mH);
  if (figIm) {
    const fh = mH * .8, fw = figIm.width * fh / figIm.height;
    g.save();
    if (costumeImg) { g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 16; g.shadowOffsetY = 10; }
    else { g.filter = 'brightness(0) invert(.2) sepia(.9) saturate(1.5)'; g.globalAlpha = .9; }
    g.drawImage(figIm, mx + (mW - fw) / 2, my + mH - 18 - fh, fw, fh);
    g.restore();
  }
  g.restore();
  cardRound(g, mx + .5, my + .5, mW - 1, mH - 1, 8);
  g.strokeStyle = 'rgba(214,168,79,.35)'; g.stroke();

  // class emblem under the model
  if (artIm) {
    const es = s * .95;
    g.save(); g.globalAlpha = .55;
    g.drawImage(artIm, mx + (mW - es) / 2, cy(7) + (s - es) / 2, es, es);
    g.restore();
  }

  // gear slots
  slotList.forEach(({ key, pos: [c, row], slot, e, item }, i) => {
    const x = cx(c), y = cy(row);
    const locked = slotLockedByTwoHander(ch, key);
    const off = slot.stateId != null && slot.stateId !== ch.stateId;
    const bad = item && !sets.get(key).has(item.id);
    const stampV = item && e.stampVariantId && ctx.stampVariants.get(e.stampVariantId);
    const cardsN = item ? (e.cards || []).filter(Boolean).length : 0;
    g.save();
    if (locked) g.globalAlpha = .3; else if (off) g.globalAlpha = .45;
    gr = g.createRadialGradient(x + s / 2, y + s * .4, 0, x + s / 2, y + s * .4, s * .75);
    gr.addColorStop(0, '#2a241c'); gr.addColorStop(1, '#100d0a');
    cardRound(g, x, y, s, s, 6); g.fillStyle = gr; g.fill();
    const im = slotIms[i];
    if (im) {
      g.save();
      cardRound(g, x + 4, y + 4, s - 8, s - 8, 4); g.clip();
      if (!item) g.globalAlpha *= .22;
      g.drawImage(im, x + 4, y + 4, s - 8, s - 8);
      g.restore();
    }
    cardRound(g, x + .5, y + .5, s - 1, s - 1, 6);
    g.strokeStyle = bad ? '#ec6b5e' : stampV && stampV.color ? stampV.color.Argb : item ? '#7a5a2a' : '#4d3b20';
    g.lineWidth = stampV ? 1.5 : 1; g.stroke(); g.lineWidth = 1;
    if (stampV) {
      g.beginPath(); g.arc(x + 9, y + 9, 4.5, 0, Math.PI * 2);
      g.fillStyle = stampV.color?.Argb || '#999'; g.fill();
      g.strokeStyle = '#000'; g.stroke();
    }
    if (cardsN) {
      g.font = `10px ${CARD_FONT.body}`; g.fillStyle = CARD_C.card;
      g.shadowColor = '#000'; g.shadowBlur = 3;
      g.fillText('◆'.repeat(cardsN), x + 5, y + s - 5);
      g.shadowBlur = 0;
    }
    if (item && e.upgrade) {
      const t = '+' + e.upgrade;
      g.font = `800 12px ${CARD_FONT.body}`;
      const bw = g.measureText(t).width + 9, bh = 16, bx = x + s - bw + 5, by = y + s - bh + 6;
      gr = g.createLinearGradient(0, by, 0, by + bh);
      gr.addColorStop(0, '#ffd98a'); gr.addColorStop(1, '#d39c3d');
      g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 3; g.shadowOffsetY = 1;
      cardRound(g, bx, by, bw, bh, 4); g.fillStyle = gr; g.fill();
      g.shadowColor = 'transparent';
      g.strokeStyle = '#fff0c4'; g.stroke();
      g.fillStyle = CARD_C.onGold; g.textAlign = 'center';
      g.fillText(t, bx + bw / 2, by + 12.5);
      g.textAlign = 'left';
    }
    g.restore();
  });

  // ---- right side: name, class, numbers
  const rx = wx + winW + 44, rw = CARD_W - rx - 44;
  let y = 74;
  g.font = `600 13px ${CARD_FONT.body}`; g.fillStyle = CARD_C.gold3;
  g.letterSpacing = '3px';
  g.fillText('◆ RQ TOOLS', rx, y);
  g.letterSpacing = '0px';

  const title = (buildName || '').trim() || `${cls.name} ${ch.level}`;
  y += 52;
  cardFit(g, title, sz => `700 ${sz}px ${CARD_FONT.display}`, 46, rw, 24);
  gr = g.createLinearGradient(0, y - 40, 0, y + 4);
  gr.addColorStop(0, CARD_C.goldHi); gr.addColorStop(1, CARD_C.gold2);
  g.shadowColor = 'rgba(230,184,92,.25)'; g.shadowBlur = 18;
  g.fillStyle = gr; g.fillText(title, rx, y);
  g.shadowBlur = 0;

  y += 18;
  const iconS = 34;
  if (clsIm) {
    g.save(); cardRound(g, rx, y, iconS, iconS, 7); g.clip(); g.drawImage(clsIm, rx, y, iconS, iconS); g.restore();
    cardRound(g, rx + .5, y + .5, iconS - 1, iconS - 1, 7); g.strokeStyle = 'rgba(214,168,79,.45)'; g.stroke();
  }
  const sub = [cls.name, `${T.level} ${ch.level}`, gender?.Name].filter(Boolean).join(' · ');
  g.fillStyle = CARD_C.fg; cardFit(g, sub, sz => `${sz}px ${CARD_FONT.body}`, 18, rw - iconS - 12, 12);
  g.fillText(sub, rx + iconS + 12, y + 23);
  y += iconS + 20;

  gr = g.createLinearGradient(rx, 0, rx + rw, 0);
  gr.addColorStop(0, 'rgba(201,150,63,.8)'); gr.addColorStop(1, 'rgba(201,150,63,0)');
  g.fillStyle = gr; g.fillRect(rx, y, rw, 1);
  y += 20;

  // three big numbers
  const val = id => r.stats.get(id);
  const hero = [[75, true], [ctx.ids.HP], [76]].filter(([id]) => ctx.stats.has(id) && val(id) != null);
  const tg = 12, tw = (rw - tg * (hero.length - 1)) / hero.length, th = 92;
  hero.forEach(([id, main], i) => {
    const x = rx + i * (tw + tg);
    gr = g.createLinearGradient(0, y, 0, y + th);
    if (main) { gr.addColorStop(0, 'rgba(230,184,92,.20)'); gr.addColorStop(1, 'rgba(230,184,92,.06)'); }
    else { gr.addColorStop(0, '#1f1a13'); gr.addColorStop(1, '#16130f'); }
    cardRound(g, x, y, tw, th, 10); g.fillStyle = gr; g.fill();
    g.strokeStyle = main ? 'rgba(230,184,92,.7)' : 'rgba(214,168,79,.3)'; g.stroke();
    g.fillStyle = main ? CARD_C.gold : CARD_C.muted;
    cardFit(g, ctx.stats.get(id).name.toUpperCase(), sz => `600 ${sz}px ${CARD_FONT.body}`, 12, tw - 28, 9);
    g.letterSpacing = '1px';
    g.fillText(ctx.stats.get(id).name.toUpperCase(), x + 14, y + 26);
    g.letterSpacing = '0px';
    const v = fmtNum(val(id), 0);
    g.fillStyle = main ? CARD_C.goldHi : CARD_C.fg;
    cardFit(g, v, sz => `700 ${sz}px ${CARD_FONT.body}`, 34, tw - 28, 16);
    g.fillText(v, x + 14, y + 70);
  });
  y += th + 26;

  // stats in two columns: attributes | characteristics
  const rowH = 27, colG = 26, colW = (rw - colG) / 2;
  const statRow = (id, x, yy) => {
    const st = ctx.stats.get(id);
    if (!st || !r.stats.has(id)) return false;
    const v = fmtStat(st, val(id));
    const note = descNote(st, r);
    g.font = `700 15px ${CARD_FONT.body}`;
    const vw = g.measureText(v).width;
    g.fillStyle = CARD_C.fg; g.textAlign = 'right'; g.fillText(v, x + colW, yy);
    let left = x + colW - vw - 8;
    if (note) {
      g.font = `11px ${CARD_FONT.body}`; g.fillStyle = CARD_C.dim;
      g.fillText(note, left, yy - 1);
      left -= g.measureText(note).width + 8;
    }
    g.textAlign = 'left'; g.fillStyle = CARD_C.muted;
    cardFit(g, st.name, sz => `${sz}px ${CARD_FONT.body}`, 14, left - x, 10);
    g.fillText(st.name, x, yy);
    g.fillStyle = 'rgba(214,168,79,.10)'; g.fillRect(x, yy + 8, colW, 1);
    return true;
  };
  const head = (text, x, yy) => {
    g.font = `700 15px ${CARD_FONT.display}`; g.fillStyle = CARD_C.gold;
    g.fillText(String(text).replace(/:\s*$/, ''), x, yy);
  };
  const col = (title, ids, x) => {
    head(title, x, y);
    let yy = y + 30;
    for (const id of ids) if (statRow(id, x, yy)) yy += rowH;
    return yy;
  };
  y = Math.max(
    col(T.params, [...ctx.editStatIds(ch.classId), cls.energyStatId], rx),
    col(T.chars, [ctx.ids.ATTACK, 11, ctx.ids.DEFENSE, 13, 14, 15, 16], rx + colW + colG));

  // summary chips: upgrade, cards, stamps, talents, effects
  const worn = slotList.filter(x => x.item && !slotLockedByTwoHander(ch, x.key) && x.slot.isWeapon != null);
  const ups = worn.map(x => x.e.upgrade || 0);
  const upMin = Math.min(...ups), upMax = Math.max(...ups);
  const cardsN = worn.reduce((n, x) => n + (x.e.cards || []).filter(Boolean).length, 0);
  const stampsN = worn.filter(x => x.e.stampVariantId && ctx.stampVariants.has(x.e.stampVariantId)).length;
  const effN = Object.keys(ch.buffs).length + (ch.auraId ? 1 : 0) + Object.keys(ch.sharedAuras || {}).length + (ch.elixirId ? 1 : 0) + ch.consumables.length;
  const chips = [
    ups.length && upMax > 0 ? [T.upgrade, upMin === upMax ? "+" + upMax : `+${upMin}…+${upMax}`] : null,
    cardsN ? [T.cards, cardsN, CARD_C.card] : null,
    stampsN ? [T.cardStamps, stampsN] : null,
    (ch.talents || []).length ? [T.tabTalents, (ch.talents || []).length] : null,
    effN ? [T.tabEffects, effN] : null,
  ].filter(Boolean);
  let chx = rx;
  const chy = y + 4, chh = 30;
  for (const [label, value, color] of chips) {
    g.font = `13px ${CARD_FONT.body}`; const lw = g.measureText(label).width;
    g.font = `700 14px ${CARD_FONT.body}`; const vw = g.measureText(String(value)).width;
    const cw = lw + vw + 30;
    if (chx + cw > rx + rw) break;
    cardRound(g, chx, chy, cw, chh, chh / 2); g.fillStyle = "rgba(230,184,92,.07)"; g.fill();
    g.strokeStyle = "rgba(214,168,79,.28)"; g.stroke();
    g.font = `13px ${CARD_FONT.body}`; g.fillStyle = CARD_C.muted; g.fillText(label, chx + 12, chy + 20);
    g.font = `700 14px ${CARD_FONT.body}`; g.fillStyle = color || CARD_C.gold; g.fillText(String(value), chx + 18 + lw, chy + 20);
    chx += cw + 8;
  }

  // footer
  const fy = CARD_H - 44;
  g.font = `700 17px ${CARD_FONT.display}`; g.fillStyle = CARD_C.gold;
  g.fillText('rqcalc.com', rx, fy);
  g.font = `12px ${CARD_FONT.body}`; g.fillStyle = CARD_C.dim; g.textAlign = 'right';
  g.fillText(T.cardFoot, rx + rw, fy);
  g.textAlign = 'left';
  return cv;
}

const cardBlob = cv => new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));
const cardFileName = () => (((buildName || '').trim() || `${ctx.classes.get(ch.classId).name} ${ch.level}`).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'build') + '.png';

async function openBuildCard() {
  let cv, blob;
  try { cv = await drawBuildCard(); blob = await cardBlob(cv); } catch (e) { console.error(e); toast(T.cardFailed); return; }
  const url = cv.toDataURL("image/png"); // the page CSP allows data: pictures, not blob:
  const file = new File([blob], cardFileName(), { type: 'image/png' });
  const canShare = !!window.RQC_WEB && !!navigator.canShare && navigator.canShare({ files: [file] });
  const copy = async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast(T.cardCopied); } catch { toast(T.copyFailed); }
  };
  const save = () => {
    const a = h('a', { href: url, download: file.name });
    document.body.append(a); a.click(); a.remove();
  };
  openModal(h('div', { class: 'dialog narrow card-dlg' },
    h('div', { class: 'dialog-head' }, h('h3', null, T.cardTitle), h('button', { class: 'btn small ghost', onclick: closeModal }, '✕')),
    h('div', { class: 'dialog-body' },
      h('img', { class: 'card-preview', src: url, alt: '' }),
      h('div', { class: 'hint', style: 'margin:10px 0 0' }, T.cardHint)),
    h('div', { class: 'dialog-foot' },
      h('button', { class: 'btn', title: T.linkTip, onclick: async () => copyText(await buildLink(), T.linkCopied) }, T.copyLink),
      h('div', { class: 'spacer' }),
      canShare ? h('button', { class: 'btn', onclick: () => navigator.share({ files: [file] }).catch(() => {}) }, T.cardShare) : null,
      h('button', { class: 'btn', onclick: save }, T.cardSave),
      h('button', { class: 'btn primary', onclick: copy }, T.cardCopy))));
}
