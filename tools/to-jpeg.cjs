// Converts the PNG maps that tools/update-world-wiki.mjs downloaded into JPEG (a tenth of the size) and removes the PNGs.
// Usage (Electron, for its image encoder): node_modules\electron\dist\electron.exe tools/to-jpeg.cjs data/maps [quality]
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
  const [dir, q] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const quality = +(q || 78);
  let n = 0, before = 0, after = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.png')) continue;
    const p = path.join(dir, f);
    const img = nativeImage.createFromPath(p);
    if (img.isEmpty()) { console.log('  cannot read', f); continue; }
    const jpg = img.toJPEG(quality);
    before += fs.statSync(p).size; after += jpg.length;
    fs.writeFileSync(p.replace(/\.png$/, '.jpg'), jpg);
    fs.unlinkSync(p);
    n++;
  }
  console.log(`${n} maps → JPEG: ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`);
  app.quit();
});
