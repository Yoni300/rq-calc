const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Saved builds live in %APPDATA%\rq-calc for both the dev run and the installed app.
// RQC_USERDATA: separate profile for test runs.
app.setPath('userData', process.env.RQC_USERDATA || path.join(app.getPath('appData'), 'rq-calc'));
if (!process.env.RQC_USERDATA && !app.requestSingleInstanceLock()) app.quit();

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 1150, minHeight: 680,
    backgroundColor: '#0b0a08', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());
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

// ---------- automatic updates (GitHub Releases of Yoni300/rq-calc) ----------
// The installed app checks for a new version at start and every 2 hours, downloads it in the background,
// then offers "restart and update"; otherwise it installs when the app is closed.
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
  autoUpdater.on('error', err => console.error('update error', err && err.message));
  ipcMain.on('rqc-install-update', () => autoUpdater.quitAndInstall(false, true));
  const check = () => autoUpdater.checkForUpdates().catch(err => console.error('update check failed', err && err.message));
  check();
  setInterval(check, 2 * 60 * 60 * 1000);
}
ipcMain.handle('rqc-update-state', () => updateState);
ipcMain.handle('rqc-app-version', () => app.getVersion());

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { createWindow(); setupUpdates(); });
app.on('window-all-closed', () => app.quit());
