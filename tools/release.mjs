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
// the website (.github/workflows/pages.yml) builds from the latest tag; a failure here must not stop the release
try { run('gh workflow run pages.yml -R Yoni300/rq-calc --ref main'); } catch { console.warn('Could not start the website update: run Actions → Website by hand.'); }
// Create the GitHub release first: electron-builder runs two upload jobs in parallel and, if the release
// doesn't exist yet, both create one, splitting the files between two releases.
let hasRelease = true;
try { out(`gh release view ${tag} -R Yoni300/rq-calc --json tagName`); } catch { hasRelease = false; }
if (!hasRelease) {
  // release notes: what tools/publish.mjs asked ("Що нового?"), otherwise just the version
  fs.writeFileSync('.git/RQC_NOTES', process.env.RQC_NOTES || `RQ Calc ${version}`);
  run(`gh release create ${tag} -R Yoni300/rq-calc --verify-tag --title "RQ Calc ${version}" --notes-file .git/RQC_NOTES`);
  fs.unlinkSync('.git/RQC_NOTES');
}
const env = { ...process.env, GH_TOKEN: process.env.GH_TOKEN || out('gh auth token') };
delete env.ELECTRON_RUN_AS_NODE;
run('node tools/write-version.mjs');
// building/uploading sometimes fails once for no reason (network, a locked file): try again before giving up
for (let attempt = 1; ; attempt++) {
  try { run('npx electron-builder --win --publish always', { env }); break; } catch (e) {
    if (attempt >= 3) throw e;
    console.log(`\nBuild/upload failed, trying again (${attempt + 1}/3)…\n`);
  }
}
console.log(`\nReleased ${tag}: https://github.com/Yoni300/rq-calc/releases/tag/${tag}`);
