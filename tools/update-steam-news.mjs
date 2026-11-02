// Royal Quest news from Steam (the game's announcements, in Russian and English) → one JSON file the app and the site read.
// Steam doesn't let web pages fetch it directly (no CORS), so .github/workflows/steam-news.yml runs this every 20 minutes
// and pushes the file to the `steam-news` branch; clients load it from raw.githubusercontent.com.
// Run: node tools/update-steam-news.mjs [out.json]   (default: steam-news.json)
import fs from 'node:fs';

const APP = 2962300, COUNT = 40;
const out = process.argv[2] || 'steam-news.json';
const LANGS = { ru: ['russian', 8], en: ['english', 0] }; // Steam language name, index in the localized_* arrays
const CLAN_IMG = 'https://clan.akamai.steamstatic.com/images/';

async function events(l) {
  const url = `https://store.steampowered.com/events/ajaxgetpartnereventspageable/?clan_accountid=0&appid=${APP}&offset=0&count=${COUNT}&l=${l}`;
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'rq-tools news' } });
      const j = await r.json();
      if (!j.success || !Array.isArray(j.events)) throw new Error('steam: ' + JSON.stringify(j).slice(0, 100));
      return j.events;
    } catch (e) { if (k >= 3) throw e; await new Promise((res) => setTimeout(res, 3000 * (k + 1))); }
  }
}

const byLang = {};
for (const [k, [l]] of Object.entries(LANGS)) byLang[k] = await events(l);

const items = new Map();
for (const [k, [, idx]] of Object.entries(LANGS)) {
  for (const e of byLang[k]) {
    if (e.hidden || !e.published || !e.announcement_body) continue;
    const gid = String(e.announcement_body.gid || e.gid);
    const clan = String(BigInt(e.clan_steamid) - 103582791429521408n); // community id → the clan's account id used in image paths
    let jd = {};
    try { jd = JSON.parse(e.jsondata || '{}'); } catch { /* no extra data */ }
    const cap = (jd.localized_capsule_image || [])[idx] || (jd.localized_capsule_image || [])[0] || (jd.localized_title_image || [])[idx] || null;
    const it = items.get(gid) || { id: gid, at: e.announcement_body.posttime || e.rtime32_start_time, url: `https://store.steampowered.com/news/app/${APP}/view/${gid}` };
    if (cap && !it.img) it.img = `${CLAN_IMG}${clan}/${cap}`;
    it[k] = { t: e.announcement_body.headline || e.event_name, b: String(e.announcement_body.body || '').replaceAll('{STEAM_CLAN_IMAGE}', CLAN_IMG.slice(0, -1)) };
    items.set(gid, it);
  }
}
const list = [...items.values()].sort((a, b) => b.at - a.at).slice(0, COUNT);
const json = JSON.stringify({ app: APP, items: list });
const old = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
if (old === json) console.log('no changes');
else { fs.writeFileSync(out, json); console.log(`${list.length} news → ${out} (${Math.round(json.length / 1024)} KB)`); }
