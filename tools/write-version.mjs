// Writes app/version.js with the app version and today's date (run before each build).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const d = new Date();
const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
fs.writeFileSync(path.join(root, 'app', 'version.js'), `window.RQC_VERSION = ${JSON.stringify({ version: pkg.version, date })};\n`);
console.log('version', pkg.version, date);
