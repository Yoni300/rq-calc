// "Опублікувати оновлення": everything checked in the TEST client goes to the players.
// Asks what's new, raises the version (1.0.5 → 1.0.6), commits and runs tools/release.mjs.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline/promises';

const out = cmd => execSync(cmd, { encoding: 'utf8' }).trim();
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const lines = rl[Symbol.asyncIterator]();
const ask = async q => { process.stdout.write(q); const r = await lines.next(); return r.done ? '' : r.value; };

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const changes = execSync('git status --porcelain', { encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(l => !/app\/version\.js$/.test(l)); // written by every build, not a change by itself
let unpublished = '';
try { unpublished = out(`git log v${pkg.version}..HEAD --oneline`); } catch { /* no tag yet */ }

console.log(`\n  RQ Calc — публікація оновлення (зараз у гравців v${pkg.version})\n`);
// the last publish stopped half way (release without files): players don't get it, so finish it first
let unfinished = false;
try { unfinished = !out(`gh release view v${pkg.version} -R Yoni300/rq-calc --json assets --jq ".assets[].name"`).includes('latest.yml'); } catch { /* no release */ }
if (unfinished) {
  const ok = (await ask(`  Минула публікація v${pkg.version} не завершилась (у релізі немає файлів). Довикласти її? (т/н) `)).trim().toLowerCase();
  rl.close();
  if (!['т', 'так', 'y', 'yes', 'д', 'да'].includes(ok)) { console.log('\n  Скасовано.'); process.exit(0); }
  execSync('node tools/release.mjs', { stdio: 'inherit' });
  console.log(`\n  Готово! Гравці отримають v${pkg.version} протягом кількох хвилин.`);
  process.exit(0);
}
if (!changes.length && !unpublished) {
  console.log('  Немає нових змін: публікувати нічого.');
  process.exit(0);
}
if (changes.length) {
  console.log('  Змінені файли:');
  for (const l of changes.slice(0, 25)) console.log('    ' + l.slice(3));
  if (changes.length > 25) console.log(`    … і ще ${changes.length - 25}`);
  console.log('');
}

const [a, b, c] = pkg.version.split('.').map(Number);
const next = `${a}.${b}.${c + 1}`;
const notes = (await ask('  Що нового? (коротко, для опису релізу; Enter — пропустити)\n  > ')).trim();
const ok = (await ask(`\n  Опублікувати версію ${next} для всіх гравців? (т/н) `)).trim().toLowerCase();
rl.close();
if (!['т', 'так', 'y', 'yes', 'д', 'да'].includes(ok)) { console.log('\n  Скасовано, нічого не змінено.'); process.exit(0); }

fs.writeFileSync('package.json', fs.readFileSync('package.json', 'utf8').replace(`"version": "${pkg.version}"`, `"version": "${next}"`));
execSync('node tools/write-version.mjs', { stdio: 'inherit' });
execSync('git add -A', { stdio: 'inherit' });
fs.writeFileSync('.git/RQC_MSG', `${next}${notes ? ': ' + notes : ''}\n`);
execSync('git commit -q -F .git/RQC_MSG', { stdio: 'inherit' });
fs.unlinkSync('.git/RQC_MSG');

console.log(`\n  Збираю й викладаю v${next}… (кілька хвилин)\n`);
execSync('node tools/release.mjs', { stdio: 'inherit', env: { ...process.env, RQC_NOTES: notes } });
console.log(`\n  Готово! Гравці отримають v${next} протягом кількох хвилин.`);
console.log('  Сайт https://yoni300.github.io/rq-calc/ оновиться сам за 1–2 хвилини (Actions → Website).');
