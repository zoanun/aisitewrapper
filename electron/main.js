const { app, BaseWindow, WebContentsView, Menu, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { TabManager, TOOLBAR_HEIGHT } = require('./tab-manager');
const { DEFAULT_SITES, DEFAULT_WINDOW } = require('../lib/config.js');

// --- JSON file store ---
const storeFile = path.join(app.getPath('userData'), 'aiwrap-store.json');

function readStore() {
  try { return JSON.parse(fs.readFileSync(storeFile, 'utf-8')); }
  catch { return {}; }
}

function writeStore(data) {
  fs.writeFileSync(storeFile, JSON.stringify(data, null, 2), 'utf-8');
}

function storeGet(key) { return readStore()[key]; }

function storeSet(key, value) {
  const data = readStore();
  data[key] = value;
  writeStore(data);
}

// --- Site management ---
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

function getEnabledSites() {
  return loadSites().filter(s => s.enabled).sort((a, b) => a.order - b.order);
}

// --- Window ---
let baseWindow = null;
let uiView = null;
let tabManager = null;

function createWindow() {
  // Remove application menu (File, Edit, View, Window, Help)
  Menu.setApplicationMenu(null);

  const winState = storeGet('window') || DEFAULT_WINDOW;

  baseWindow = new BaseWindow({
    width: winState.width,
    height: winState.height,
    ...(winState.left !== undefined && { x: winState.left }),
    ...(winState.top !== undefined && { y: winState.top }),
    icon: path.join(__dirname, '..', 'icons', 'icon128.png'),
    title: 'AI Site Wrapper'
  });

  // UI view for bookmark bar + tab bar
  uiView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  baseWindow.contentView.addChildView(uiView);
  uiView.webContents.loadFile(path.join(__dirname, 'ui', 'index.html'));

  // Position UI view
  function updateLayout() {
    if (!baseWindow || baseWindow.isDestroyed()) return;
    const bounds = baseWindow.getContentBounds();
    uiView.setBounds({ x: 0, y: 0, width: bounds.width, height: TOOLBAR_HEIGHT });
    if (tabManager) tabManager.resizeAllViews();
  }
  updateLayout();
  baseWindow.on('resize', updateLayout);

  // Create tab manager
  tabManager = new TabManager(baseWindow, uiView, { storeGet, storeSet });

  // Restore session or open default
  const lastSession = storeGet('lastSession');
  const enabledSites = getEnabledSites();

  if (lastSession && lastSession.tabs && lastSession.tabs.length > 0) {
    let activeIndex = 0;
    for (let i = 0; i < lastSession.tabs.length; i++) {
      const saved = lastSession.tabs[i];
      const site = loadSites().find(s => s.id === saved.siteId);
      if (site) {
        tabManager.createTab(site.id, site.name, saved.url || site.url);
        if (saved.siteId === lastSession.activeTab) {
          activeIndex = i;
        }
      }
    }
    const tabs = tabManager.getTabs();
    if (tabs[activeIndex]) {
      tabManager.switchTab(tabs[activeIndex].id);
    }
  } else {
    const defaultSiteId = storeGet('defaultSite');
    const startSite = (defaultSiteId && enabledSites.find(s => s.id === defaultSiteId)) || enabledSites[0];
    if (startSite) {
      tabManager.createTab(startSite.id, startSite.name, startSite.url);
    }
  }

  // Save state on close
  baseWindow.on('close', () => {
    const bounds = baseWindow.getBounds();
    storeSet('window', { width: bounds.width, height: bounds.height, left: bounds.x, top: bounds.y });
    if (tabManager) {
      storeSet('lastSession', tabManager.getSessionData());
    }
  });

  baseWindow.on('closed', () => {
    baseWindow = null;
    uiView = null;
    tabManager = null;
  });
}

// --- IPC handlers ---
ipcMain.handle('store-get', (_e, key) => storeGet(key));
ipcMain.handle('store-set', (_e, key, value) => {
  storeSet(key, value);
  // When sites are updated (from settings page), notify bookmark bar
  if (key === 'sites' && uiView && !uiView.webContents.isDestroyed()) {
    uiView.webContents.send('bookmarks-changed');
  }
});

ipcMain.handle('expand-ui-view', () => {
  if (!baseWindow || baseWindow.isDestroyed() || !uiView) return;
  const bounds = baseWindow.getContentBounds();
  uiView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
  // Hide all content tabs so they don't cover the expanded UI view
  if (tabManager) {
    for (const tab of tabManager.tabs) {
      tab.view.setVisible(false);
    }
    if (tabManager.welcomeView) tabManager.welcomeView.setVisible(false);
  }
});

ipcMain.handle('shrink-ui-view', () => {
  if (!baseWindow || baseWindow.isDestroyed() || !uiView) return;
  const bounds = baseWindow.getContentBounds();
  uiView.setBounds({ x: 0, y: 0, width: bounds.width, height: TOOLBAR_HEIGHT });
  // Restore active tab visibility
  if (tabManager) {
    const activeTab = tabManager.tabs.find(t => t.id === tabManager.activeTabId);
    if (activeTab) {
      activeTab.view.setVisible(true);
    } else if (tabManager.welcomeView) {
      tabManager.welcomeView.setVisible(true);
    }
  }
});

ipcMain.handle('create-tab', (_e, siteId) => {
  const sites = loadSites();
  const site = sites.find(s => s.id === siteId);
  if (!site || !tabManager) return null;
  return tabManager.createTab(site.id, site.name, site.url);
});

ipcMain.handle('switch-tab', (_e, tabId) => {
  if (!tabManager) return false;
  return tabManager.switchTab(tabId);
});

ipcMain.handle('close-tab', (_e, tabId) => {
  if (!tabManager) return false;
  return tabManager.closeTab(tabId);
});

ipcMain.handle('refresh-tab', (_e, tabId) => {
  if (!tabManager) return;
  tabManager.refreshTab(tabId);
});

ipcMain.handle('get-tabs', () => {
  if (!tabManager) return { tabs: [], activeTabId: null };
  return { tabs: tabManager.getTabs(), activeTabId: tabManager.getActiveTabId() };
});

ipcMain.handle('get-bookmarks', () => {
  return getEnabledSites().map(s => ({ id: s.id, name: s.name, url: s.url }));
});

ipcMain.handle('disable-site', (_e, siteId) => {
  const sites = loadSites();
  const site = sites.find(s => s.id === siteId);
  if (site) {
    site.enabled = false;
    storeSet('sites', sites);
    if (uiView && !uiView.webContents.isDestroyed()) {
      uiView.webContents.send('bookmarks-changed');
    }
  }
});

ipcMain.handle('open-settings', () => {
  if (!tabManager) return;
  const settingsTab = tabManager.tabs.find(t => t.siteId === '__settings__');
  if (settingsTab) {
    tabManager.switchTab(settingsTab.id);
    return;
  }
  const tabId = 'tab_' + (tabManager.nextId++);
  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const bounds = baseWindow.getContentBounds();
  view.setBounds({
    x: 0, y: TOOLBAR_HEIGHT,
    width: bounds.width,
    height: Math.max(0, bounds.height - TOOLBAR_HEIGHT)
  });
  baseWindow.contentView.addChildView(view);
  view.webContents.loadFile(path.join(__dirname, 'settings', 'settings.html'));

  const tab = { id: tabId, siteId: '__settings__', title: 'Settings', url: '', view };
  tabManager.tabs.push(tab);
  tabManager.switchTab(tabId);
  tabManager._notifyUI('tab-created', { id: tabId, siteId: '__settings__', title: 'Settings', url: '' });
});

ipcMain.handle('close-settings', () => {
  if (!tabManager) return;
  const settingsTab = tabManager.tabs.find(t => t.siteId === '__settings__');
  if (settingsTab) {
    tabManager.closeTab(settingsTab.id);
  }
  if (uiView && !uiView.webContents.isDestroyed()) {
    uiView.webContents.send('bookmarks-changed');
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

app.on('window-all-closed', () => { app.quit(); });

app.on('activate', () => {
  if (!baseWindow) createWindow();
});
