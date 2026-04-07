const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

// --- Simple JSON file store (replaces chrome.storage) ---
const storeFile = path.join(app.getPath('userData'), 'aiwrap-store.json');

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
  } catch {
    return {};
  }
}

function writeStore(data) {
  fs.writeFileSync(storeFile, JSON.stringify(data, null, 2), 'utf-8');
}

function storeGet(key) {
  return readStore()[key];
}

function storeSet(key, value) {
  const data = readStore();
  data[key] = value;
  writeStore(data);
}

// --- Config: import shared site list from lib/config.js ---
const { DEFAULT_SITES, DEFAULT_WINDOW } = require('../lib/config.js');

function loadSites() {
  const sites = storeGet('sites');
  if (sites && sites.length > 0) {
    let changed = false;
    for (const def of DEFAULT_SITES) {
      const existing = sites.find(s => s.id === def.id);
      if (existing && existing.builtin) {
        if (existing.url !== def.url) { existing.url = def.url; changed = true; }
        if (existing.name !== def.name) { existing.name = def.name; changed = true; }
      }
    }
    if (changed) storeSet('sites', sites);
    return sites;
  }
  const defaultSites = DEFAULT_SITES.map((s, i) => ({ ...s, order: i }));
  storeSet('sites', defaultSites);
  return defaultSites;
}

// --- Main window ---
let mainWindow = null;
let siteView = null;
let currentSiteId = null;
const TAB_BAR_HEIGHT = 40;

function createWindow() {
  const winState = storeGet('window') || DEFAULT_WINDOW;
  const lastActive = storeGet('lastActiveTab');
  const defaultSite = storeGet('defaultSite');
  const sites = loadSites();
  const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);

  mainWindow = new BrowserWindow({
    width: winState.width,
    height: winState.height,
    ...(winState.left !== undefined && { x: winState.left }),
    ...(winState.top !== undefined && { y: winState.top }),
    icon: path.join(__dirname, '..', 'icons', 'icon128.png'),
    title: 'AI Site Wrapper',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Remove default menu
  mainWindow.setMenuBarVisibility(false);

  // Load tab bar UI
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Create BrowserView for site content
  siteView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.setBrowserView(siteView);

  // Position site view below tab bar
  function updateViewBounds() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [w, h] = mainWindow.getContentSize();
    siteView.setBounds({ x: 0, y: TAB_BAR_HEIGHT, width: w, height: h - TAB_BAR_HEIGHT });
  }
  updateViewBounds();
  mainWindow.on('resize', updateViewBounds);

  // Load initial site
  const startSite =
    (defaultSite && enabledSites.find(s => s.id === defaultSite)) ||
    (lastActive && enabledSites.find(s => s.id === lastActive)) ||
    enabledSites[0];

  if (startSite) {
    currentSiteId = startSite.id;
    siteView.webContents.loadURL(startSite.url);
    storeSet('lastActiveTab', startSite.id);
  }

  // Save window state on close
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds();
    storeSet('window', {
      width: bounds.width,
      height: bounds.height,
      left: bounds.x,
      top: bounds.y
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    siteView = null;
  });

  // Handle new window requests (OAuth popups stay in-app, others go to browser)
  const OAUTH_DOMAINS = [
    'accounts.google.com', 'appleid.apple.com', 'login.microsoftonline.com',
    'github.com', 'auth0.com', 'login.live.com'
  ];

  siteView.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { action: 'deny' };
      }
      // Allow OAuth popups to open as Electron windows
      if (OAUTH_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
        return { action: 'allow' };
      }
      // Check if same origin as current site (likely auth-related)
      const currentUrl = siteView.webContents.getURL();
      if (currentUrl) {
        try {
          const currentOrigin = new URL(currentUrl).origin;
          if (parsed.origin === currentOrigin) {
            return { action: 'allow' };
          }
        } catch {}
      }
      // External link — open in system browser
      require('electron').shell.openExternal(url);
    } catch {}
    return { action: 'deny' };
  });
}

// --- IPC handlers ---
ipcMain.handle('store-get', (_e, key) => storeGet(key));
ipcMain.handle('store-set', (_e, key, value) => storeSet(key, value));

ipcMain.handle('get-tabs', () => {
  const sites = loadSites();
  const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);
  return { sites: enabledSites, currentSiteId };
});

ipcMain.handle('switch-tab', (_e, siteId) => {
  const sites = loadSites();
  const site = sites.find(s => s.id === siteId);
  if (!site || !siteView) return { ok: false };
  // Validate URL scheme before navigating
  try {
    const parsed = new URL(site.url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { ok: false };
  } catch { return { ok: false }; }
  currentSiteId = siteId;
  storeSet('lastActiveTab', siteId);
  siteView.webContents.loadURL(site.url);
  return { ok: true };
});

ipcMain.handle('refresh-tab', () => {
  if (siteView) siteView.webContents.reload();
  return { ok: true };
});

ipcMain.handle('open-settings', () => {
  if (!mainWindow) return;
  // Hide site view and load settings in main window
  mainWindow.removeBrowserView(siteView);
  mainWindow.loadFile(path.join(__dirname, 'settings.html'));
});

ipcMain.handle('close-settings', () => {
  if (!mainWindow || !siteView) return;
  // Restore site view and tab bar
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.setBrowserView(siteView);
  const [w, h] = mainWindow.getContentSize();
  siteView.setBounds({ x: 0, y: TAB_BAR_HEIGHT, width: w, height: h - TAB_BAR_HEIGHT });
  // Reload current site in case settings changed
  const sites = loadSites();
  const site = sites.find(s => s.id === currentSiteId && s.enabled);
  if (!site) {
    const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);
    if (enabledSites.length > 0) {
      currentSiteId = enabledSites[0].id;
      storeSet('lastActiveTab', currentSiteId);
      siteView.webContents.loadURL(enabledSites[0].url);
    }
  }
});

ipcMain.handle('clear-site-cache', async (_e, origin) => {
  if (!origin) return;
  await session.defaultSession.clearStorageData({ origin });
});

ipcMain.handle('clear-all-cache', async (_e, origins) => {
  for (const origin of origins) {
    await session.defaultSession.clearStorageData({ origin });
  }
});

// --- App lifecycle ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (!mainWindow) createWindow();
});
