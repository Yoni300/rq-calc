// Is the game up? Two public sources, no login:
//   - players in the game right now, from Steam (GetNumberOfCurrentPlayers) — a crash shows as a sudden drop;
//   - the game's own maintenance switch, the one the launcher checks before it starts the game
//     (bffweb.baseplatform.online/api/servicecontrol/service-status/rq: canRun false = closed for maintenance).
// Neither lets a web page fetch it (no CORS), so .github/workflows/server-status.yml runs this every 5 minutes and pushes
// server-status.json to the `server-status` branch; the site loads it from raw.githubusercontent.com. The desktop app asks
// both sources itself every minute (main.js) and only takes the history from this file.
// Run: node tools/update-server-status.mjs [file.json]   (default: server-status.json; the old file's history is kept)
import fs from 'node:fs';

const APP = 2962300, KEEP = 48 * 3600; // history: the last 48 hours
const out = process.argv[2] || 'server-status.json';
export const STEAM_URL = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${APP}`;
export const STATUS_URL = 'https://bffweb.baseplatform.online/api/servicecontrol/service-status/rq';

async function json(url, headers) {
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { headers: { 'User-Agent': 'rq-tools status', ...headers }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (k >= 2) throw e; await new Promise(res => setTimeout(res, 3000 * (k + 1))); }
  }
}

let old = {};
try { old = JSON.parse(fs.readFileSync(out, 'utf8')); } catch { /* first run */ }

const at = Math.floor(Date.now() / 1000);
let online = null, canRun = null, statuses = [];
try {
  const j = await json(STEAM_URL);
  if (j.response && j.response.result === 1 && Number.isFinite(j.response.player_count)) online = j.response.player_count;
} catch (e) { console.error('steam', e.message); }
try {
  const j = await json(STATUS_URL, { 'X-Application': 'SilentLauncher' });
  if (j.data && typeof j.data.canRun === 'boolean') { canRun = j.data.canRun; statuses = Array.isArray(j.data.statuses) ? j.data.statuses : []; }
} catch (e) { console.error('status', e.message); }
if (online == null && canRun == null) { console.error('both sources failed, the file stays as it is'); process.exit(0); }

// one point: [time, players or null, 1 = the game can be started / 0 = maintenance / null = unknown]
const hist = (Array.isArray(old.hist) ? old.hist : []).filter(p => Array.isArray(p) && p[0] > at - KEEP && p[0] < at);
hist.push([at, online, canRun == null ? null : canRun ? 1 : 0]);
const res = { at, online, canRun, statuses, hist };
fs.writeFileSync(out, JSON.stringify(res));
console.log(`online ${online}, canRun ${canRun}, statuses ${JSON.stringify(statuses)}, ${hist.length} points`);
