// Publishes a new version: tags it in git, builds the installer and uploads it to GitHub Releases.
// Installed copies of RQ Calc pick it up automatically.
// Usage: bump "version" in package.json, commit, then: npm run release
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const out = cmd => execSync(cmd, { encoding: 'utf8' }).trim();
const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const tag = `v${version}`;

if (out('git status --porcelain')) { console.error('Commit your changes first (git status is not clean).'); process.exit(1); }
const remoteTags = out(`git ls-remote --tags origin ${tag}`);
if (!remoteTags) {
  if (!out(`git tag -l ${tag}`)) run(`git tag ${tag}`);
  run('git push origin HEAD');
  run(`git push origin ${tag}`);
}
// Create the GitHub release first: electron-builder runs two upload jobs in parallel and, if the release
// doesn't exist yet, both create one, splitting the files between two releases.
let hasRelease = true;
try { out(`gh release view ${tag} -R Yoni300/rq-calc --json tagName`); } catch { hasRelease = false; }
if (!hasRelease) run(`gh release create ${tag} -R Yoni300/rq-calc --verify-tag --title "RQ Calc ${version}" --notes "RQ Calc ${version}"`);
const env = { ...process.env, GH_TOKEN: process.env.GH_TOKEN || out('gh auth token') };
delete env.ELECTRON_RUN_AS_NODE;
run('node tools/write-version.mjs');
run('npx electron-builder --win --publish always', { env });
console.log(`\nReleased ${tag}: https://github.com/Yoni300/rq-calc/releases/tag/${tag}`);
