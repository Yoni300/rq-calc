// Shared helpers for the wiki updaters: the API (POST, retries), all pages of categories with their text, template
// fields. Only template fields are used by the tools — never article text.
export const API = 'https://royalquest.info/api.php';
const UA = { 'User-Agent': 'rq-calc wiki updater' };

/** The wiki sometimes answers with an HTML error page: wait and try again. */
export async function api(params) {
  for (let k = 0; ; k++) {
    const r = await fetch(API, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ format: 'json', ...params }) });
    const t = await r.text();
    try { return JSON.parse(t); } catch {
      if (k >= 4) throw new Error('wiki: ' + r.status + ' ' + t.slice(0, 120));
      await new Promise((res) => setTimeout(res, 2000 * (k + 1)));
    }
  }
}

/** Every page of the given categories (deduplicated): [{ title, text }]. */
export async function categoryPages(...cats) {
  const out = new Map();
  for (const cat of cats) {
    let cont = {};
    for (let i = 0; i < 200; i++) {
      const j = await api({ action: 'query', generator: 'categorymembers', gcmtitle: 'Категория:' + cat, gcmlimit: '50',
        prop: 'revisions', rvprop: 'content', rvslots: 'main', ...cont });
      for (const p of Object.values(j.query?.pages || {})) {
        const text = p.revisions?.[0]?.slots?.main?.['*'];
        if (text && !out.has(p.title)) out.set(p.title, { title: p.title, text, cat });
      }
      if (!j.continue) break;
      cont = j.continue;
    }
  }
  return [...out.values()];
}

export const clean = (s) => String(s || '').replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/<[^>]+>/g, '').replace(/'''?/g, '').trim();

/** The fields of the first {{<name> …}} template on a page (multiline or one-line «|a=1|b=2» rows). */
export function templateFields(text, name) {
  const start = text.indexOf('{{' + name);
  if (start < 0) return null;
  // find the matching }} (templates can nest)
  let depth = 0, i = start, end = -1;
  for (; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; }
    else if (text[i] === '}' && text[i + 1] === '}') { depth--; i++; if (depth === 0) { end = i - 1; break; } }
  }
  const body = text.slice(start + 2 + name.length, end > 0 ? end : undefined);
  const f = {};
  // split on top-level pipes
  let d = 0, cur = '';
  const parts = [];
  for (let k = 0; k < body.length; k++) {
    const c = body[k], n = body[k + 1];
    if ((c === '{' && n === '{') || (c === '[' && n === '[')) { d++; cur += c + n; k++; continue; }
    if ((c === '}' && n === '}') || (c === ']' && n === ']')) { d--; cur += c + n; k++; continue; }
    if (c === '|' && d === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim(), v = clean(p.slice(eq + 1));
    if (k) f[k] = v;
  }
  return f;
}

/** «Имя1, Имя2, …» → [values]. */
export const numbered = (f, key, max = 80) => { const out = []; for (let n = 1; n <= max; n++) { const v = f[key + n]; if (v) out.push(v); } return out; };

/** Image URLs (scaled to `width` when given) for file titles, 50 per request (the API limit). */
export async function imageUrls(files, width) {
  const urls = {};
  for (let i = 0; i < files.length; i += 50) {
    const j = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url', ...(width ? { iiurlwidth: String(width) } : {}), titles: files.slice(i, i + 50).join('|') });
    const norm = Object.fromEntries((j.query?.normalized || []).map((n) => [n.to, n.from]));
    for (const p of Object.values(j.query?.pages || {})) {
      const ii = p.imageinfo?.[0];
      if (ii) urls[norm[p.title] || p.title] = ii.thumburl || ii.url;
    }
  }
  return urls;
}
export async function download(url) { return Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer()); }
