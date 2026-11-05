const { app, BrowserWindow, shell, ipcMain, screen, Tray, Menu, globalShortcut, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const cardScan = require('./card-scan');
const stats = require('./stats'); // RQ Stats: the DPS / loot overlay over the game

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
const STARTED_HIDDEN = process.argv.includes('--hidden');
function showMain() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

// ---------- settings that only the app has (app/settings.js sends them) ----------
let tray = null, quitting = false;
app.on('before-quit', () => { quitting = true; });
ipcMain.on('rqc-app-settings', (_e, s) => {
  if (s.tray && !tray) {
    tray = new Tray(path.join(__dirname, 'build', 'icon.png'));
    tray.setToolTip('RQ Tools');
    tray.on('click', showMain);
  }
  if (tray) {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: s.lblOpen || 'Open', click: showMain },
      { type: 'separator' },
      { label: s.lblQuit || 'Quit', click: () => { quitting = true; app.quit(); } },
    ]));
  }
  if (!s.tray && tray) { tray.destroy(); tray = null; }
  // started with Windows and keeps running in the tray: no window in the taskbar
  if (s.tray && STARTED_HIDDEN && win && win.isMinimized() && !win.isFocused()) win.hide();
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!s.autostart, args: ['--hidden'] });
});

function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 920, minWidth: 1150, minHeight: 680,
    backgroundColor: '#0b0a08', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    // backgroundThrottling off: the boss timer must tick on time while the window is minimized behind the game
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'), IS_TEST ? { query: { test: '1' } } : undefined);
  // started with Windows (settings → autostart): stay out of the way, the timer works in the background
  win.once('ready-to-show', () => { if (STARTED_HIDDEN) win.minimize(); else win.show(); });
  // settings → "keep running in the tray": closing the window only hides it, so boss alerts keep coming
  win.on('close', e => { if (tray && !quitting) { e.preventDefault(); win.hide(); } });
  // really closed (no tray): the stats overlay and the alert window must not keep the app running
  win.on('closed', () => app.quit());
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

// ---------- boss alerts: a small window in the screen corner, above all windows ----------
// It never takes the focus (the game keeps it) and is shown on the screen where the mouse is.
// Works over windowed / borderless games; an exclusive full-screen game hides everything on top of it.
let alertWin = null, alertReady = false, alertQueue = [], alertCorner = 'br';
function bossAlert(a) {
  alertCorner = a.corner || 'br'; // settings: br / tr / bl / tl
  if (alertWin && !alertWin.isDestroyed()) {
    if (alertReady) alertWin.webContents.send('rqc-alert-show', a); else alertQueue.push(a); // still loading
    return;
  }
  alertReady = false; alertQueue = [a];
  alertWin = new BrowserWindow({
    width: 380, height: 10, show: false, frame: false, transparent: true, resizable: false, movable: false,
    minimizable: false, maximizable: false, fullscreenable: false, skipTaskbar: true, focusable: false, hasShadow: false,
    alwaysOnTop: true, backgroundColor: '#00000000',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, preload: path.join(__dirname, 'preload.js') },
  });
  alertWin.setAlwaysOnTop(true, 'screen-saver');
  alertWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  alertWin.loadFile(path.join(__dirname, 'app', 'alert.html'));
  alertWin.webContents.once('did-finish-load', () => {
    alertReady = true;
    for (const q of alertQueue.splice(0)) alertWin.webContents.send('rqc-alert-show', q);
  });
  alertWin.on('closed', () => { alertWin = null; alertReady = false; });
}
ipcMain.on('rqc-boss-alert', (_e, a) => bossAlert(a));
// the alert page tells how much room its messages need; 0 = nothing left to show
ipcMain.on('rqc-alert-size', (_e, w, h) => {
  if (!alertWin || alertWin.isDestroyed()) return;
  if (!h) { alertWin.hide(); return; }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const left = alertCorner[1] === 'l', top = alertCorner[0] === 't';
  alertWin.setBounds({ x: left ? area.x + 12 : area.x + area.width - w - 12, y: top ? area.y + 12 : area.y + area.height - h - 12, width: w, height: h });
  if (!alertWin.isVisible()) alertWin.showInactive();
  alertWin.setAlwaysOnTop(true, 'screen-saver');
});
// a click on a message opens the timer
ipcMain.on('rqc-alert-open', () => {
  if (!win || win.isDestroyed()) return;
  showMain();
  win.webContents.send('rqc-open-bosses');
});

// ---------- card scanner (card-scan.js): a hotkey over a card in the game → how many «Знаки» it gives ----------
// The page (app/card-scanner.js) sends the settings; the result goes back to the page, which shows it as an alert.
let cardKey = null, cardBusy = false;
async function onCardKey() {
  if (cardBusy || !win || win.isDestroyed()) return;
  cardBusy = true;
  try { win.webContents.send('rqc-card-result', await cardScan.scan(alertWin && !alertWin.isDestroyed() && alertWin.isVisible() ? alertWin.getBounds() : null)); } finally { cardBusy = false; }
}
ipcMain.on('rqc-card-settings', (_e, s) => {
  if (cardKey) { globalShortcut.unregister(cardKey); cardKey = null; }
  let ok = true;
  if (s.enabled && s.hotkey) {
    try { ok = globalShortcut.register(s.hotkey, onCardKey); } catch { ok = false; }
    if (ok) cardKey = s.hotkey;
  }
  if (s.enabled) cardScan.start(); else cardScan.stop();
  if (win && !win.isDestroyed()) win.webContents.send('rqc-card-status', { hotkey: s.hotkey, ok: !s.enabled || ok });
});
// card scanner: the gold sum goes to the clipboard, to paste it as the price in the trade window
ipcMain.on('rqc-copy-text', (_e, text) => clipboard.writeText(String(text)));
// «Установить» in the «no Russian text recognition» alert
let ocrInstalling = false;
ipcMain.on('rqc-alert-action', async (_e, id) => {
  if (id !== 'install-ru-ocr' || ocrInstalling) return;
  ocrInstalling = true;
  const send = st => { if (win && !win.isDestroyed()) win.webContents.send('rqc-card-ocr', st); };
  send({ state: 'start' });
  try {
    const r = await cardScan.installRuOcr();
    // the helper checks the language when it starts: restart it, that also tells whether it works now
    cardScan.stop();
    const works = r.ok && await cardScan.start();
    if (!cardKey) cardScan.stop();
    send(works ? { state: 'ok' } : { state: r.reason === 'cancel' ? 'cancel' : 'fail', reason: r.ok ? 'no-ru-ocr' : r.reason });
  } finally { ocrInstalling = false; }
});
// ---------- RQ Stats (stats/): the «Статистика» tool page turns the overlay on / off ----------
// { on: true | false, lang, action: 'calibrate' | 'show' | 'reset' } → 'rqc-stats-state' { on, hasRegion, keys }
const statsState = st => { if (win && !win.isDestroyed()) win.webContents.send('rqc-stats-state', st); };
ipcMain.on('rqc-stats', (_e, cmd) => {
  if (cmd.lang) stats.setLang(cmd.lang);
  if (cmd.on === true) statsState(stats.start({ lang: cmd.lang, onOff: () => statsState(stats.state()) }));
  else if (cmd.on === false) { stats.stop(); statsState(stats.state()); }
  if (cmd.action === 'calibrate') stats.calibrate();
  else if (cmd.action === 'show') stats.show();
  else if (cmd.action === 'reset') stats.newSession();
  else if (cmd.action === 'state') statsState(stats.state());
});
app.on('will-quit', () => { stats.stop(); globalShortcut.unregisterAll(); cardScan.stop(); });

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
  ipcMain.on('rqc-install-update', () => { quitting = true; autoUpdater.quitAndInstall(true, true); });
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

app.on('second-instance', showMain);
// Windows shows notifications (boss timer) only for an app with this id; the installer uses the same one
if (process.platform === 'win32') app.setAppUserModelId(IS_TEST ? process.execPath : 'com.yoni300.rqcalc');

app.whenReady().then(() => { createWindow(); setupUpdates(); });
app.on('window-all-closed', () => app.quit());
