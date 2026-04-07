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

// --- Config: reuse DEFAULT_SITES ---
const DEFAULT_SITES = [
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', enabled: true, builtin: true },
  { id: 'doubao', name: '豆包', url: 'https://doubao.com', enabled: true, builtin: true },
  { id: 'tongyi', name: '千问', url: 'https://chat.qwen.ai', enabled: true, builtin: true },
  { id: 'yuanbao', name: '元宝', url: 'https://yuanbao.tencent.com', enabled: true, builtin: true },
  { id: 'glm', name: '智谱清言', url: 'https://chatglm.cn', enabled: true, builtin: true },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', enabled: true, builtin: true },
  { id: 'gemini', name: 'Gemini', url: 'https://aistudio.google.com/', enabled: true, builtin: true },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai', enabled: true, builtin: true },
  { id: 'kimi', name: 'Kimi', url: 'https://kimi.moonshot.cn', enabled: false, builtin: true },
  { id: 'wenxin', name: '文心一言', url: 'https://yiyan.baidu.com', enabled: false, builtin: true },
  { id: 'spark', name: '讯飞星火', url: 'https://xinghuo.xfyun.cn', enabled: false, builtin: true },
  { id: 'tiangong', name: '天工', url: 'https://tiangong.cn', enabled: false, builtin: true },
  { id: 'hailuo', name: '海螺', url: 'https://hailuoai.com', enabled: false, builtin: true },
  { id: 'perplexity', name: 'Perplexity', url: 'https://perplexity.ai', enabled: false, builtin: true },
  { id: 'grok', name: 'Grok', url: 'https://grok.com', enabled: false, builtin: true },
  { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com', enabled: false, builtin: true },
  { id: 'mistral', name: 'Mistral', url: 'https://chat.mistral.ai', enabled: false, builtin: true },
  { id: 'huggingchat', name: 'HuggingChat', url: 'https://huggingface.co/chat', enabled: false, builtin: true },
  { id: 'poe', name: 'Poe', url: 'https://poe.com', enabled: false, builtin: true }
];

const DEFAULT_WINDOW = { width: 1280, height: 800 };

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

  // Open external links in default browser
  siteView.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
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
