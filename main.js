const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// The installed app keeps its data in %APPDATA%\rq-calc. Running from the source code is the TEST client:
// it has its own profile (%APPDATA%\rq-calc-test, first filled with a copy of the main one) and reloads itself
// when files change. RQC_USERDATA: separate profile for automated test runs.
const IS_TEST = !app.isPackaged;
const mainProfile = path.join(app.getPath('appData'), 'rq-calc');
const profile = process.env.RQC_USERDATA || (IS_TEST ? path.join(app.getPath('appData'), 'rq-calc-test') : mainProfile);
if (IS_TEST && !process.env.RQC_USERDATA && !fs.existsSync(profile)) {
  try {
    // bring over saved builds and settings; LOCK files belong to a running app and are skipped
    fs.cpSync(path.join(mainProfile, 'Local Storage'), path.join(profile, 'Local Storage'), { recursive: true, filter: src => path.basename(src) !== 'LOCK' });
  } catch { /* no main profile yet */ }
}
app.setPath('userData', profile);
if (!process.env.RQC_USERDATA && !app.requestSingleInstanceLock()) app.quit();

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 1150, minHeight: 680,
    backgroundColor: '#0b0a08', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'), IS_TEST ? { query: { test: '1' } } : undefined);
  win.once('ready-to-show', () => win.show());
  if (IS_TEST && !process.env.RQC_SCREENSHOT) watchForChanges();
  // links open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  // Test hook: RQC_SCREENSHOT=<file.png> saves a screenshot after start and quits.
  const shot = process.env.RQC_SCREENSHOT;
  if (shot) {
    win.webContents.once('did-finish-load', async () => {
      if (process.env.RQC_EVAL) await win.webContents.executeJavaScript(process.env.RQC_EVAL).catch(e => console.error(e));
      setTimeout(async () => {
        const image = await win.webContents.capturePage();
        fs.writeFileSync(shot, image.toPNG());
        app.quit();
      }, 1500);
    });
  }
}

// TEST client: reload the page when the app, engine or data change (main.js/preload.js need a restart)
function watchForChanges() {
  let timer = null;
  const reload = () => { clearTimeout(timer); timer = setTimeout(() => { if (win && !win.isDestroyed()) win.webContents.reloadIgnoringCache(); }, 400); };
  for (const dir of ['app', 'src', 'data']) {
    try { fs.watch(path.join(__dirname, dir), { recursive: true }, (_e, file) => { if (file && !/\.(tmp|swp)$|~$/.test(file)) reload(); }); } catch { /* ignore */ }
  }
}

// ---------- automatic updates (GitHub Releases of Yoni300/rq-calc) ----------
// The installed app checks for a new version at start, every 5 minutes and when its window gets focus,
// downloads it in the background, then the page restarts it by itself after a short countdown
// ("Later" postpones it; it also installs when the app is closed).
let updateState = { status: 'idle' };
function sendUpdate(state) {
  updateState = state;
  if (win && !win.isDestroyed()) win.webContents.send('rqc-update', state);
}
function setupUpdates() {
  if (!app.isPackaged || process.env.RQC_SCREENSHOT) return;
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', info => sendUpdate({ status: 'downloading', version: info.version }));
  autoUpdater.on('download-progress', p => sendUpdate({ status: 'downloading', version: updateState.version, percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', info => sendUpdate({ status: 'ready', version: info.version }));
  autoUpdater.on('error', err => {
    console.error('update error', err && err.message);
    // a failed download must not block the next checks
    if (updateState.status === 'downloading') sendUpdate({ status: 'idle' });
  });
  ipcMain.on('rqc-install-update', () => autoUpdater.quitAndInstall(true, true));
  let lastCheck = 0;
  const check = () => {
    if (updateState.status === 'downloading' || updateState.status === 'ready') return;
    lastCheck = Date.now();
    autoUpdater.checkForUpdates().catch(err => console.error('update check failed', err && err.message));
  };
  check();
  setInterval(check, 5 * 60 * 1000);
  // coming back to the window: check again, but not more often than once a minute
  app.on('browser-window-focus', () => { if (Date.now() - lastCheck > 60 * 1000) check(); });
}
ipcMain.handle('rqc-update-state', () => updateState);
ipcMain.handle('rqc-app-version', () => app.getVersion());

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { createWindow(); setupUpdates(); });
app.on('window-all-closed', () => app.quit());
