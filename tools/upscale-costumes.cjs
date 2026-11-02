// Sharper costume pictures for the character window: Anon's 210×284 costume images, upscaled 4× with Real-ESRGAN
// (anime model — suits the game's look) and scaled down to 2× → data/costumes/<CostumeImage_Id>.png.
// Needs realesrgan-ncnn-vulkan (https://github.com/xinntao/Real-ESRGAN/releases, the Windows zip with models/).
// Run: electron tools/upscale-costumes.cjs <path to realesrgan-ncnn-vulkan.exe> [--all]
// Without --all only costumes that have no picture in data/costumes yet are done.
'use strict';
const { app, nativeImage } = require('electron');
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const ROOT = path.join(__dirname, '..');
const exe = process.argv.find(a => /realesrgan.*\.exe$/i.test(a));
const all = process.argv.includes('--all');

app.whenReady().then(() => {
  try {
    if (!exe || !fs.existsSync(exe)) throw new Error('give the path to realesrgan-ncnn-vulkan.exe');
    const RQ = require(path.join(ROOT, 'data', 'rqdata.js'));
    const out = path.join(ROOT, 'data', 'costumes');
    fs.mkdirSync(out, { recursive: true });
    const ids = [...new Set(RQ.Equipment.filter(e => e.CostumeImage_Id != null).map(e => e.CostumeImage_Id))]
      .filter(id => all || !fs.existsSync(path.join(out, id + '.png')));
    if (!ids.length) { console.log('nothing to do'); return app.quit(); }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rqc-cost-')), src = path.join(tmp, 'in'), big = path.join(tmp, 'out');
    fs.mkdirSync(src); fs.mkdirSync(big);
    for (const id of ids) fs.copyFileSync(path.join(ROOT, 'data', 'img', id + '.png'), path.join(src, id + '.png'));
    const r = spawnSync(exe, ['-i', src, '-o', big, '-n', 'realesrgan-x4plus-anime', '-f', 'png'], { cwd: path.dirname(exe), stdio: 'inherit' });
    if (r.status !== 0) throw new Error('realesrgan failed');
    for (const id of ids) {
      const { width, height } = nativeImage.createFromPath(path.join(src, id + '.png')).getSize();
      const im = nativeImage.createFromPath(path.join(big, id + '.png')).resize({ width: width * 2, height: height * 2, quality: 'best' });
      fs.writeFileSync(path.join(out, id + '.png'), im.toPNG());
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(ids.length, 'costumes →', out);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  app.quit();
});
