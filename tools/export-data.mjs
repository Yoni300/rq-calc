// Exports the community database (rqdata.sqlite from "RQ Calc" by Anon) into
// data/rqdata.js (all tables except images) and data/img/<id>.png (icons).
// Usage: node tools/export-data.mjs [path/to/rqdata.sqlite]
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.argv[2] || path.join(root, 'source', 'rqdata.sqlite');
const outDir = path.join(root, 'data');
const imgDir = path.join(outDir, 'img');

const db = new DatabaseSync(dbPath, { readOnly: true });
const SKIP = new Set(['Image', 'StaticImage', 'sqlite_sequence']);

const tables = {};
const names = db.prepare("select name from sqlite_master where type='table' order by name").all().map(r => r.name);
for (const name of names) {
  if (SKIP.has(name)) continue;
  const cols = db.prepare(`pragma table_info("${name}")`).all();
  const pk = cols.filter(c => c.pk).sort((a, b) => a.pk - b.pk).map(c => `"${c.name}"`);
  const order = pk.length ? ` order by ${pk.join(', ')}` : ' order by rowid';
  const rows = db.prepare(`select * from "${name}"${order}`).all();
  // Drop null fields to keep the file small; the engine treats missing as null.
  tables[name] = rows.map(r => {
    const o = {};
    for (const [k, v] of Object.entries(r)) if (v !== null) o[k] = v;
    return o;
  });
}

fs.mkdirSync(imgDir, { recursive: true });
let imgCount = 0;
// CAST: some images are stored with TEXT affinity; read them as raw bytes.
for (const r of db.prepare('select Id, CAST(Data AS BLOB) AS Data from Image').all()) {
  if (!r.Data) continue;
  fs.writeFileSync(path.join(imgDir, `${r.Id}.png`), r.Data);
  imgCount++;
}

const json = JSON.stringify(tables);
const js = `(function (d) { if (typeof module === 'object' && module.exports) module.exports = d; else window.RQDATA = d; })(${json});\n`;
fs.writeFileSync(path.join(outDir, 'rqdata.js'), js);
console.log(`tables: ${Object.keys(tables).length}, data: ${(js.length / 1024).toFixed(0)} KB, images: ${imgCount}`);
