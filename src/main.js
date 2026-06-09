'use strict';

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  shell,
} = require('electron');
const path = require('path');

// Disable GPU hardware acceleration. On some macOS setups the GPU/compositing
// process crashes ("renderer-gone: killed"), leaving a black window. This must
// be called before the app is ready.
app.disableHardwareAcceleration();

// Strip the "Electron/x.y.z" token from the user agent for ALL requests.
// Google's account login refuses to sign in from anything it recognizes as an
// embedded/Electron browser ("This browser or app may not be secure"). Electron
// already bundles a current Chromium, so removing just that token leaves a clean,
// genuine-looking desktop Chrome UA. Must be set before any window loads.
app.userAgentFallback = app.userAgentFallback.replace(/ Electron\/\S+/, '');

// Display name (About panel, notifications). Pin userData to the ORIGINAL name
// first so renaming the app doesn't orphan the persisted login session.
app.setPath('userData', path.join(app.getPath('appData'), 'youtubemusic-macos'));
app.setName('Personal YT');

const YTM_URL = 'https://music.youtube.com';

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserWindow | null} */
let widgetWindow = null;
/** @type {Tray | null} */
let tray = null;

// Latest playback state reported by the renderer.
let state = {
  title: '',
  artist: '',
  isPlaying: false,
  artwork: '',
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    title: 'Personal YT',
    backgroundColor: '#030303',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Persist the session so login survives restarts.
      partition: 'persist:ytmusic',
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(YTM_URL);

  // Keep the window title fixed instead of letting the web page overwrite it.
  mainWindow.on('page-title-updated', (e) => e.preventDefault());

  // Open external links (e.g. account pages) in the system browser instead
  // of spawning new app windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://music.youtube.com')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Surface load failures and renderer crashes to the terminal.
  const wc = mainWindow.webContents;
  wc.on('did-fail-load', (_e, code, desc, url) =>
    console.error(`[load-fail] ${code} ${desc} -> ${url}`)
  );
  wc.on('render-process-gone', (_e, d) =>
    console.error('[renderer-gone]', d.reason)
  );

  // Hide to the menu bar instead of quitting when the window is closed.
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function showWindow() {
  if (!mainWindow) return createWindow();
  mainWindow.show();
  mainWindow.focus();
}

// --- Renderer commands ------------------------------------------------------

function send(command, arg) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('command', command, arg);
  }
}

// --- Floating mini-player widget --------------------------------------------

const WIDGET_W = 340;
const WIDGET_H = 84;

function pushStateToWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('state', state);
  }
}

// Park the bezel in the top-right of whichever display the cursor is on, so it
// appears on the screen you're actually using (not always the primary one).
function positionWidgetOnActiveDisplay() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  const cursor = screen.getCursorScreenPoint();
  const wa = screen.getDisplayNearestPoint(cursor).workArea;
  widgetWindow.setBounds({
    x: wa.x + wa.width - WIDGET_W - 16,
    y: wa.y + 16,
    width: WIDGET_W,
    height: WIDGET_H,
  });
}

function createWidget() {
  const cursor = screen.getCursorScreenPoint();
  const wa = screen.getDisplayNearestPoint(cursor).workArea;
  widgetWindow = new BrowserWindow({
    width: WIDGET_W,
    height: WIDGET_H,
    x: wa.x + wa.width - WIDGET_W - 16,
    y: wa.y + 16,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false, // shadow is drawn in CSS so it follows the rounded corners
    webPreferences: {
      preload: path.join(__dirname, 'widget-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  widgetWindow.loadFile(path.join(__dirname, 'widget.html'));
  // Float above normal windows and follow across Spaces / full-screen apps.
  widgetWindow.setAlwaysOnTop(true, 'floating');
  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  widgetWindow.webContents.on('did-finish-load', pushStateToWidget);
  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });
}

function toggleWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    if (widgetWindow.isVisible()) {
      widgetWindow.hide();
    } else {
      positionWidgetOnActiveDisplay();
      widgetWindow.show();
      pushStateToWidget();
    }
  } else {
    createWidget();
  }
  refreshTray();
}

// --- Tray (menu bar) --------------------------------------------------------

function trayIcon() {
  const file = path.join(__dirname, '..', 'build', 'trayTemplate.png');
  const img = nativeImage.createFromPath(file);
  // Template image => macOS auto-adapts it to light/dark menu bars.
  img.setTemplateImage(true);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

function nowPlayingLabel() {
  if (!state.title) return 'Not playing';
  return state.artist ? `${state.title} — ${state.artist}` : state.title;
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: nowPlayingLabel(), enabled: false },
    { type: 'separator' },
    {
      label: state.isPlaying ? 'Pause' : 'Play',
      click: () => send('playPause'),
    },
    { label: 'Next', click: () => send('next') },
    { label: 'Previous', click: () => send('previous') },
    { type: 'separator' },
    {
      label:
        widgetWindow && widgetWindow.isVisible()
          ? 'Hide Mini Player'
          : 'Show Mini Player',
      accelerator: 'CmdOrCtrl+Shift+M',
      click: toggleWidget,
    },
    { label: 'Show Personal YT', click: showWindow },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function refreshTray() {
  if (!tray) return;
  tray.setToolTip(nowPlayingLabel());
  tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Personal YT');
  tray.on('click', showWindow); // left-click opens the window
  refreshTray();
}

// --- Global shortcuts -------------------------------------------------------

function registerShortcuts() {
  // NOTE: we intentionally do NOT register the hardware media keys
  // (MediaPlayPause/Next/Previous) here. Doing so conflicts with Chromium's
  // own media-key handling, which is what feeds macOS "Now Playing" / Control
  // Center from the page's MediaSession. Letting Chromium own those keys gives
  // us both system media-key control and the Now Playing widget for free.
  globalShortcut.register('CmdOrCtrl+Shift+M', toggleWidget);
}

// --- IPC --------------------------------------------------------------------

ipcMain.on('track-update', (_e, payload) => {
  state = { ...state, ...payload };
  refreshTray();
  pushStateToWidget();
});

// Progress goes straight to the widget (it doesn't affect the tray).
ipcMain.on('progress-update', (_e, payload) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('progress', payload);
  }
});

// Commands coming from the mini-player are routed to the YT Music window.
ipcMain.on('widget-command', (_e, name, arg) => send(name, arg));
ipcMain.on('widget-close', () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.hide();
  refreshTray();
});

// --- App chrome (icon, About panel, menu) -----------------------------------

function setupAppChrome() {
  app.setAboutPanelOptions({
    applicationName: 'Personal YT',
    applicationVersion: app.getVersion(),
    credits: 'A 100% local macOS desktop player for YouTube Music.',
  });

  // Dock icon (works even when running unpackaged via `npm start`).
  if (process.platform === 'darwin' && app.dock) {
    const icon = nativeImage.createFromPath(
      path.join(__dirname, '..', 'build', 'icon.png')
    );
    if (!icon.isEmpty()) app.dock.setIcon(icon);
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'Personal YT',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        {
          label: 'Quit Personal YT',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Controls',
      submenu: [
        {
          label: 'Play / Pause',
          accelerator: 'CmdOrCtrl+P',
          click: () => send('playPause'),
        },
        {
          label: 'Next',
          accelerator: 'CmdOrCtrl+Right',
          click: () => send('next'),
        },
        {
          label: 'Previous',
          accelerator: 'CmdOrCtrl+Left',
          click: () => send('previous'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Mini Player',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: toggleWidget,
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      role: 'window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

// --- App lifecycle ----------------------------------------------------------

// Single instance: focus existing window instead of launching twice.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    setupAppChrome();
    createWindow();
    createTray();
    registerShortcuts();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  });

  app.on('will-quit', () => globalShortcut.unregisterAll());

  // Keep running in the menu bar even with no windows open.
  app.on('window-all-closed', () => {});
}
