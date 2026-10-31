'use strict';
/* Public builds: shared between everyone who has the app, stored in Supabase (see server/supabase.sql).
   Uses globals from app.js at call time (ch, store, T, h, changed, …). */

const PB = { list: [], loading: false, error: null, loaded: false, filter: null, sort: 'new', q: '', myHash: null };

const sbConfigured = () => { const c = window.RQC_CONFIG || {}; return !!(c.supabaseUrl && c.supabaseKey); };
async function sb(path, opts = {}) {
  const c = window.RQC_CONFIG;
  const res = await fetch(c.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/' + path, {
    ...opts,
    // old-style anon keys are JWTs and also go into Authorization; new "sb_publishable_…" keys only in apikey
    headers: { apikey: c.supabaseKey, ...(c.supabaseKey.startsWith('eyJ') ? { Authorization: 'Bearer ' + c.supabaseKey } : {}), 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// a secret token per computer; only its hash is published, so only this computer can delete its builds
function ownerToken() {
  let t = store.get('ownerToken', null);
  if (!t) { t = crypto.randomUUID() + crypto.randomUUID(); store.set('ownerToken', t); }
  return t;
}
async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function myHash() { if (!PB.myHash) PB.myHash = await sha256hex(ownerToken()); return PB.myHash; }

async function loadPublic() {
  if (!sbConfigured()) return;
  PB.loading = true; PB.error = null; drawPublicList();
  try {
    await myHash();
    const order = PB.sort === 'top' ? 'likes.desc,created_at.desc' : 'created_at.desc';
    let q = `builds?select=id,created_at,name,author,description,class_id,level,likes,owner_hash,data${PB.noTags ? '' : ',tags'}&order=${order}&limit=200`;
    // class filter: the chosen class together with its professions (Стрелок → Охотник, Снайпер)
    const ids = filterClassIds();
    if (ids) q += `&class_id=in.(${ids.join(',')})`;
    // numbers, class and level are recomputed from the build itself (see verifyBuild)
    let rows;
    try { rows = await sb(q); } catch (e) {
      if (PB.noTags || !/tags/.test(e.message)) throw e;
      PB.noTags = true; rows = await sb(q.replace(',tags', '')); // server without update 4
    }
    PB.list = (rows || []).map(b => { b.v = verifyBuild(b.data); delete b.data; return b; })
      .filter(b => !ids || ids.includes(b.v?.classId));
    PB.loaded = true;
    await syncLikes();
  } catch (e) { PB.error = e.message; }
  PB.loading = false;
  drawPublicList();
}

async function openPublic(b) {
  try {
    const rows = await sb(`builds?id=eq.${b.id}&select=data,name`);
    const c = rows && rows[0] && normalize(rows[0].data);
    if (!c) throw new Error(T.badCode);
    loadBuild({ name: rows[0].name, ch: c });
    tab = 'gear'; store.set('tab', 'gear'); renderCenter(); animateEnter($('center')); renderTop();
    toast(T.pbOpened);
  } catch (e) { toast(T.pbError + ' ' + e.message); }
}
// The server remembers who liked what (see server/003-fair-likes.sql); the local list is only a cache.
// Returns false on an old server without my_likes, then the local list is kept.
async function syncLikes() {
  try {
    const ids = await sb('rpc/my_likes', { method: 'POST', body: '{}' });
    if (Array.isArray(ids)) { store.set('likedBuilds', ids.map(x => (x && typeof x === 'object' ? Object.values(x)[0] : x))); return true; }
  } catch { /* old server */ }
  return false;
}
// a second click takes the like back
async function likePublic(b) {
  const liked = new Set(store.get('likedBuilds', []));
  const had = liked.has(b.id);
  try {
    const n = await sb(had ? 'rpc/unlike_build' : 'rpc/like_build', { method: 'POST', body: JSON.stringify({ p_id: b.id }) });
    if (!await syncLikes()) {
      if (had) liked.delete(b.id); else liked.add(b.id);
      store.set('likedBuilds', [...liked]);
    }
    b.likes = typeof n === 'number' ? n : Math.max(0, b.likes + (had ? -1 : 1));
    drawPublicList();
  } catch (e) {
    toast(T.pbError + ' ' + (had && /unlike_build|PGRST202|404/.test(e.message) ? T.pbNeedUpdate : e.message));
  }
}
async function deletePublic(b) {
  if (!await confirmBox(fmtT(T.pbDelAsk, { name: b.name }), { ok: T.del, danger: true })) return;
  try {
    const ok = await sb('rpc/delete_build', { method: 'POST', body: JSON.stringify({ p_id: b.id, p_token: ownerToken() }) });
    if (!ok) throw new Error('—');
    PB.list = PB.list.filter(x => x.id !== b.id);
    drawPublicList();
  } catch (e) { toast(T.pbError + ' ' + e.message); }
}

function openPublish() {
  const r = lastResult || recalc();
  const cls = ctx.classes.get(ch.classId);
  const name = h('input', { class: 'inp', maxLength: 60, value: (buildName || '').trim() || `${cls.name} ${ch.level}` });
  const author = h('input', { class: 'inp', maxLength: 30, value: store.get('author', ''), placeholder: T.pbAuthorPh });
  const desc = h('textarea', { class: 'code-area', maxLength: 500, placeholder: T.pbDescPh, style: 'height:90px;font-family:var(--f-body);font-size:13px' });
  const err = h('div', { class: 'warn', style: 'margin-top:6px' });
  const stat = id => fmtNum(r.stats.get(id) ?? 0, 0);
  const chosen = new Set();
  const tagBox = h('div', { class: 'pb-tagpick' });
  const drawTags = () => {
    tagBox.innerHTML = '';
    for (const t of BUILD_TAGS) {
      const on = chosen.has(t), full = !on && chosen.size >= MAX_TAGS;
      tagBox.append(h('button', { type: 'button', class: 'tag' + (on ? ' on' : '') + (full ? ' off' : ''), disabled: full,
        onclick: () => { if (on) chosen.delete(t); else chosen.add(t); drawTags(); } }, tagLabel(t)));
    }
  };
  drawTags();
  const btn = h('button', { class: 'btn primary', onclick: async () => {
    if (!name.value.trim()) { err.textContent = T.pbNeedName; return; }
    btn.disabled = true; err.textContent = '';
    store.set('author', author.value.trim());
    try {
      await sb('builds', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
        name: name.value.trim(), author: author.value.trim(), description: desc.value.trim(),
        class_id: ch.classId, level: ch.level,
        dps: Math.round((r.stats.get(75) ?? 0) * 100) / 100, hp: Math.round(r.stats.get(ctx.ids.HP) ?? 0), ehp: Math.round(r.stats.get(76) ?? 0),
        data: JSON.parse(JSON.stringify(ch)), owner_hash: await myHash(),
        ...(chosen.size && !PB.noTags ? { tags: [...chosen] } : {}),
      }) });
      closeModal();
      PB.sort = 'new'; tab = 'builds'; store.set('tab', 'builds'); renderCenter(); renderTop();
      toast(T.pbPublished);
      loadPublic();
    } catch (e) { err.textContent = /row-level security|42501/.test(e.message) ? T.pbTooMany : T.pbError + ' ' + e.message; btn.disabled = false; }
  } }, T.pbPublish);
  openModal(h('div', { class: 'dialog narrow' },
    h('div', { class: 'dialog-head' }, h('h3', null, T.pbPublishTitle), h('button', { class: 'btn small ghost', onclick: closeModal }, '✕')),
    h('div', { class: 'dialog-body' },
      h('div', { class: 'pb-sum' }, img(cls.imageId), h('div', null, h('b', null, `${cls.name} · ${ch.level}`), h('div', { class: 'hint', style: 'margin:2px 0 0' }, `DPS ${stat(75)} · ${ctx.stats.get(ctx.ids.HP).name} ${stat(ctx.ids.HP)} · EHP ${stat(76)}`))),
      h('div', { class: 'field' }, h('label', null, T.pbName), name),
      h('div', { class: 'field' }, h('label', null, T.pbAuthor), author),
      h('div', { class: 'field', style: 'align-items:start' }, h('label', null, T.pbDesc), desc),
      PB.noTags ? null : h('div', { class: 'field', style: 'align-items:start' }, h('label', null, T.pbTags, h('small', null, ` (${T.pbTagsMax})`)), tagBox),
      h('div', { class: 'hint' }, T.pbPublicNote), err),
    h('div', { class: 'dialog-foot' }, h('button', { class: 'btn', onclick: closeModal }, T.close), btn)));
  setTimeout(() => name.select(), 0);
}

function drawPublicList() {
  const list = document.getElementById('pbList');
  if (!list) return;
  list.innerHTML = '';
  if (PB.loading && !PB.loaded) { list.append(h('div', { class: 'hint pb-msg' }, T.pbLoading)); return; }
  if (PB.error) { list.append(h('div', { class: 'warn pb-msg' }, T.pbError + ' ' + PB.error)); return; }
  const liked = new Set(store.get('likedBuilds', []));
  const items = PB.list.filter(b => (!PB.tag || (b.tags || []).includes(PB.tag))
    && matches(PB.q, b.name, b.author, b.description, ctx.classes.get(b.class_id)?.name, ...(b.tags || []).map(tagLabel)));
  if (PB.tag) list.append(h('div', { class: 'pb-tagfilter' }, T.pbTagFilter + ': ',
    h('button', { type: 'button', class: 'tag on', onclick: () => { PB.tag = null; drawPublicList(); } }, tagLabel(PB.tag), ' ✕')));
  if (!items.length) { list.append(h('div', { class: 'hint pb-msg' }, PB.loaded ? T.pbEmpty : T.pbLoading)); return; }
  for (const b of items) {
    const v = b.v;
    const cls = ctx.classes.get(v ? v.classId : b.class_id);
    const bad = !v || v.problems.length > 0;
    const mine = PB.myHash && b.owner_hash === PB.myHash;
    const isLiked = liked.has(b.id);
    list.append(h('div', { class: 'pb-card' + (mine ? ' mine' : '') + (bad ? ' bad' : '') },
      h('div', { class: 'pb-head' },
        img(cls?.imageId),
        h('div', { class: 'pb-title' },
          h('div', { class: 'pb-name' }, b.name),
          h('div', { class: 'pb-meta' }, `${cls?.name || '?'} · ${T.level.toLowerCase()} ${v ? v.level : '?'}`, b.author ? ` · ${b.author}` : '', ` · ${new Date(b.created_at).toLocaleDateString()}`)),
        bad ? h('span', { class: 'pb-bad', title: v ? v.problems.join('\n') : T.pbBroken }, '⚠ ' + T.pbImpossible) : null,
        mine ? h('span', { class: 'pb-mine' }, T.pbMine) : null),
      h('div', { class: 'pb-stats' },
        h('div', null, h('span', null, 'DPS'), h('b', null, v ? fmtNum(v.dps, 0) : '?')),
        h('div', null, h('span', null, ctx.stats.get(ctx.ids.HP).name), h('b', null, v ? fmtNum(v.hp, 0) : '?')),
        h('div', null, h('span', null, 'EHP'), h('b', null, v ? fmtNum(v.ehp, 0) : '?'))),
      b.description ? h('div', { class: 'pb-desc' }, b.description) : null,
      (b.tags || []).length ? h('div', { class: 'pb-tags' }, b.tags.filter(t => BUILD_TAGS.includes(t)).map(t =>
        h('button', { type: 'button', class: 'tag' + (PB.tag === t ? ' on' : ''), title: T.pbTagClick,
          onclick: () => { PB.tag = PB.tag === t ? null : t; drawPublicList(); } }, tagLabel(t)))) : null,
      h('div', { class: 'pb-foot' },
        h('button', { class: 'pb-like' + (isLiked ? ' on' : ''), title: isLiked ? T.pbUnlike : T.pbLike, onclick: () => likePublic(b) }, isLiked ? '♥ ' : '♡ ', String(b.likes)),
        h('div', { class: 'spacer' }),
        mine ? h('button', { class: 'btn small ghost danger', onclick: () => deletePublic(b) }, T.del) : null,
        h('button', { class: 'btn small primary', onclick: () => openPublic(b) }, T.load))));
  }
}

// Tags: a fixed list (checked by the server, see server/004-build-tags.sql); names come from i18n (T.tagNames)
const BUILD_TAGS = ['pve', 'pvp', 'farm', 'solo', 'party', 'boss', 'tank', 'support', 'dd', 'crit', 'dodge', 'budget', 'endgame', 'newbie', 'event', 'arena'];
const MAX_TAGS = 5;
const tagLabel = t => (T.tagNames && T.tagNames[t]) || t;

function filterClassIds() {
  const c = PB.filter != null && ctx.classes.get(PB.filter);
  return c ? [c.id, ...(c.children || [])] : null;
}
// button with the chosen class; opens the class list with icons
function classFilterButton() {
  const c = PB.filter != null ? ctx.classes.get(PB.filter) : null;
  return h('button', { class: 'btn pb-cls' + (c ? ' on' : ''), type: 'button', title: T.pbClassFilter, onclick: e => openClassPicker(e.currentTarget, {
    current: c ? c.id : null, allLabel: T.pbAll,
    sub: x => (x.children || []).length ? T.pbWithProfs : '',
    onPick: id => { PB.filter = id; renderCenter(); loadPublic(); },
  }) }, c ? img(c.imageId) : iconEl('globe'), h('span', null, c ? c.name : T.pbAll), iconEl('down'));
}

function renderBuilds(el) {
  if (!sbConfigured()) {
    el.append(h('div', { class: 'box pb-setup' }, h('h3', null, T.publicBuilds), h('div', { style: 'white-space:pre-line;line-height:1.55' }, T.pbSetup)));
    return;
  }
  const search = h('input', { class: 'inp', placeholder: T.search, value: PB.q, spellcheck: false });
  search.addEventListener('input', () => { PB.q = search.value; drawPublicList(); });
  const seg = (items, cur, on) => h('div', { class: 'seg' }, items.map(([v, label]) => h('button', { class: v === cur ? 'on' : '', onclick: () => on(v) }, label)));
  el.append(h('div', { class: 'pb-bar' },
    h('button', { class: 'btn primary', onclick: openPublish }, '⬆ ' + T.pbPublishBtn),
    classFilterButton(),
    seg([['new', T.pbNew], ['top', T.pbTop]], PB.sort, v => { PB.sort = v; renderCenter(); loadPublic(); }),
    search,
    h('button', { class: 'btn', title: T.pbRefresh, onclick: () => loadPublic() }, '⟳')));
  el.append(h('div', { class: 'pb-list', id: 'pbList' }));
  drawPublicList();
  if (!PB.loaded && !PB.loading) loadPublic();
}
