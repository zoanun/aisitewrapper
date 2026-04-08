# AI Site Wrapper v2 - Browser-Like Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign AI Site Wrapper into a browser-like Electron app with a bookmark bar, multi-tab system using WebContentsView, and session restore.

**Architecture:** Pure Electron app using `BaseWindow` + multiple `WebContentsView` instances. A UI WebContentsView renders the bookmark bar and tab bar (68px total). Each open tab gets its own WebContentsView positioned below the toolbar. Tab switching toggles visibility without reloading.

**Tech Stack:** Electron 35+ (BaseWindow, WebContentsView), vanilla JS, JSON file storage.

---

## File Structure

```
aisitewrapper/
├── package.json                    # Update: version bump, entry point stays electron/main.js
├── lib/
│   └── config.js                   # Simplify: remove Chrome extension detection, Electron-only
├── electron/
│   ├── main.js                     # Rewrite: BaseWindow + WebContentsView multi-tab
│   ├── preload.js                  # Rewrite: new IPC API for multi-tab
│   ├── tab-manager.js              # NEW: tab lifecycle management
│   ├── ui/
│   │   ├── index.html              # NEW: bookmark bar + tab bar HTML
│   │   ├── renderer.js             # NEW: UI interaction logic
│   │   └── styles.css              # NEW: toolbar styles
│   ├── settings/
│   │   ├── settings.html           # Modify: all sites deletable, adapt from v1
│   │   ├── settings.js             # Modify: all sites deletable, adapt from v1
│   │   └── settings.css            # Copy from settings/settings.css
│   └── welcome/
│       └── welcome.html            # NEW: empty-state welcome page
├── icons/                          # Keep as-is
└── dist/                           # Build output
```

**Files to delete after all tasks complete:**
- `manifest.json`
- `background.js`
- `content.js`
- `content.css`
- `app/` (entire directory)
- `setup/` (entire directory)
- `settings/` (entire directory — replaced by `electron/settings/`)
- `electron/index.html` (replaced by `electron/ui/index.html`)
- `electron/renderer.js` (replaced by `electron/ui/renderer.js`)
- `electron/settings.html` (replaced by `electron/settings/settings.html`)
- `electron/settings-renderer.js` (replaced by `electron/settings/settings.js`)

---

### Task 1: Clean up and simplify lib/config.js

Remove Chrome extension and localStorage detection. Keep only the DEFAULT_SITES list and DEFAULT_WINDOW constant for Electron main process use.

**Files:**
- Modify: `lib/config.js`

- [ ] **Step 1: Rewrite lib/config.js to Electron-only**

Replace the entire file with:

```javascript
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

module.exports = { DEFAULT_SITES, DEFAULT_WINDOW };
```

- [ ] **Step 2: Commit**

```bash
git add lib/config.js
git commit -m "refactor: simplify config.js to Electron-only"
```

---

### Task 2: Create tab-manager.js

The core module managing tab lifecycle. Runs in the main process. Creates/switches/closes WebContentsView instances.

**Files:**
- Create: `electron/tab-manager.js`

- [ ] **Step 1: Create electron/tab-manager.js**

```javascript
const { WebContentsView, shell } = require('electron');
const path = require('path');

const TOOLBAR_HEIGHT = 68; // bookmark bar (32px) + tab bar (36px)

const OAUTH_DOMAINS = [
  'accounts.google.com', 'appleid.apple.com', 'login.microsoftonline.com',
  'github.com', 'auth0.com', 'login.live.com'
];

class TabManager {
  constructor(baseWindow, uiView, store) {
    this.baseWindow = baseWindow;
    this.uiView = uiView;
    this.store = store;
    this.tabs = [];       // { id, siteId, title, url, view }
    this.activeTabId = null;
    this.nextId = 1;
  }

  createTab(siteId, name, url) {
    const tabId = 'tab_' + (this.nextId++);
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    // Position below toolbar
    this._setBounds(view);
    this.baseWindow.contentView.addChildView(view);

    // Handle new-window requests (OAuth popups, external links)
    view.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
      try {
        const parsed = new URL(popupUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { action: 'deny' };
        }
        if (OAUTH_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d))) {
          return { action: 'allow' };
        }
        const currentUrl = view.webContents.getURL();
        if (currentUrl) {
          try {
            if (new URL(currentUrl).origin === parsed.origin) {
              return { action: 'allow' };
            }
          } catch {}
        }
        shell.openExternal(popupUrl);
      } catch {}
      return { action: 'deny' };
    });

    // Track title changes
    view.webContents.on('page-title-updated', (_e, title) => {
      const tab = this.tabs.find(t => t.id === tabId);
      if (tab) {
        tab.title = title;
        this._notifyUI('tab-title-updated', { tabId, title });
      }
    });

    // Load URL
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        view.webContents.loadURL(url);
      }
    } catch {}

    const tab = { id: tabId, siteId, title: name, url, view };
    this.tabs.push(tab);

    // Switch to the new tab
    this.switchTab(tabId);

    this._notifyUI('tab-created', this._tabInfo(tab));
    return tabId;
  }

  switchTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return false;

    for (const t of this.tabs) {
      t.view.setVisible(t.id === tabId);
    }
    this.activeTabId = tabId;

    this._notifyUI('tab-switched', { tabId });
    return true;
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return false;

    const tab = this.tabs[index];
    this.baseWindow.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    this.tabs.splice(index, 1);

    // Switch to adjacent tab if we closed the active one
    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const newIndex = Math.min(index, this.tabs.length - 1);
        this.switchTab(this.tabs[newIndex].id);
      } else {
        this.activeTabId = null;
        this._notifyUI('tab-switched', { tabId: null });
      }
    }

    this._notifyUI('tab-closed', { tabId });
    return true;
  }

  refreshTab(tabId) {
    const tab = this.tabs.find(t => t.id === (tabId || this.activeTabId));
    if (tab) tab.view.webContents.reload();
  }

  getTabs() {
    return this.tabs.map(t => this._tabInfo(t));
  }

  getActiveTabId() {
    return this.activeTabId;
  }

  resizeAllViews() {
    for (const tab of this.tabs) {
      this._setBounds(tab.view);
    }
  }

  getSessionData() {
    return {
      tabs: this.tabs.map(t => ({ siteId: t.siteId, url: t.url })),
      activeTab: this.activeTabId
        ? this.tabs.find(t => t.id === this.activeTabId)?.siteId || null
        : null
    };
  }

  _setBounds(view) {
    const bounds = this.baseWindow.getContentBounds();
    view.setBounds({
      x: 0,
      y: TOOLBAR_HEIGHT,
      width: bounds.width,
      height: Math.max(0, bounds.height - TOOLBAR_HEIGHT)
    });
  }

  _tabInfo(tab) {
    return { id: tab.id, siteId: tab.siteId, title: tab.title, url: tab.url };
  }

  _notifyUI(channel, data) {
    if (this.uiView && !this.uiView.webContents.isDestroyed()) {
      this.uiView.webContents.send(channel, data);
    }
  }
}

module.exports = { TabManager, TOOLBAR_HEIGHT };
```

- [ ] **Step 2: Commit**

```bash
git add electron/tab-manager.js
git commit -m "feat: add TabManager for multi-tab WebContentsView management"
```

---

### Task 3: Create the toolbar UI (bookmark bar + tab bar)

The HTML/CSS/JS for the top 68px toolbar that contains the bookmark bar and tab bar.

**Files:**
- Create: `electron/ui/index.html`
- Create: `electron/ui/styles.css`
- Create: `electron/ui/renderer.js`

- [ ] **Step 1: Create electron/ui/styles.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1e1e1e;
  height: 68px;
  overflow: hidden;
  user-select: none;
}

/* === Bookmark Bar (32px) === */
.bookmark-bar {
  display: flex;
  align-items: center;
  height: 32px;
  background: #1e1e1e;
  padding: 0 4px;
  -webkit-app-region: drag;
}

.bookmarks {
  display: flex;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.bookmarks::-webkit-scrollbar { display: none; }

.bookmark {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  height: 26px;
  color: #999;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 4px;
  transition: background 0.12s, color 0.12s;
  -webkit-app-region: no-drag;
}

.bookmark:hover { background: #2a2a2a; color: #ddd; }

.bookmark img { width: 14px; height: 14px; border-radius: 2px; }

.bookmark .bk-letter {
  width: 14px; height: 14px; border-radius: 2px;
  background: #444; color: #fff; font-size: 9px;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.settings-btn {
  font-size: 16px;
  color: #666;
  cursor: pointer;
  padding: 0 8px;
  height: 32px;
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
  transition: color 0.12s;
}

.settings-btn:hover { color: #ddd; }

/* === Tab Bar (36px) === */
.tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  background: #2a2a2a;
  padding: 0 4px;
}

.tabs {
  display: flex;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 1px;
}

.tabs::-webkit-scrollbar { display: none; }

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 36px;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: background 0.12s, color 0.12s;
  position: relative;
  max-width: 200px;
}

.tab:hover { background: #333; color: #ccc; }

.tab.active { color: #fff; border-bottom-color: #4a9eff; }

.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  font-size: 14px;
  color: #666;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 3px;
  line-height: 1;
  flex-shrink: 0;
}

.tab-close:hover { background: #555; color: #fff; }

.tab-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #666;
  font-size: 18px;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  transition: background 0.12s, color 0.12s;
}

.tab-add:hover { background: #3a3a3a; color: #ddd; }

/* === Site Picker (dropdown from + button) === */
.site-picker-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 998;
}

.site-picker-overlay.show { display: block; }

.site-picker {
  position: fixed;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 8px 0;
  min-width: 200px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 999;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}

.site-picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  color: #ddd;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
}

.site-picker-item:hover { background: #3a3a3a; }

.site-picker-item img { width: 16px; height: 16px; border-radius: 2px; }

.site-picker-item .picker-letter {
  width: 16px; height: 16px; border-radius: 2px;
  background: #444; color: #fff; font-size: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* === Context Menu === */
.context-menu {
  position: fixed;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  min-width: 140px;
  padding: 4px 0;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}

.menu-item {
  padding: 8px 16px;
  color: #ddd;
  font-size: 13px;
  cursor: pointer;
}

.menu-item:hover { background: #3a3a3a; }

.menu-item.danger { color: #e74c3c; }
.menu-item.danger:hover { background: #3a2020; }
```

- [ ] **Step 2: Create electron/ui/index.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Site Wrapper</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <!-- Bookmark Bar -->
  <div class="bookmark-bar">
    <div class="bookmarks" id="bookmarks"></div>
    <div class="settings-btn" id="settings-btn" title="Settings">&#9881;</div>
  </div>

  <!-- Tab Bar -->
  <div class="tab-bar">
    <div class="tabs" id="tabs"></div>
    <div class="tab-add" id="tab-add" title="New Tab">+</div>
  </div>

  <!-- Site Picker (hidden by default) -->
  <div class="site-picker-overlay" id="picker-overlay">
    <div class="site-picker" id="site-picker"></div>
  </div>

  <script src="renderer.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create electron/ui/renderer.js**

```javascript
const bookmarksContainer = document.getElementById('bookmarks');
const tabsContainer = document.getElementById('tabs');
const settingsBtn = document.getElementById('settings-btn');
const tabAddBtn = document.getElementById('tab-add');
const pickerOverlay = document.getElementById('picker-overlay');
const sitePicker = document.getElementById('site-picker');
let contextMenu = null;

// --- Favicon helper ---
function createFavicon(url, name, letterClass) {
  let hostname;
  try { hostname = new URL(url).hostname; } catch { hostname = ''; }
  const img = document.createElement('img');
  img.src = hostname ? `https://${hostname}/favicon.ico` : '';
  img.alt = '';
  img.onerror = () => {
    if (!img.dataset.fallback) {
      img.dataset.fallback = '1';
      img.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } else {
      const letter = document.createElement('span');
      letter.className = letterClass;
      letter.textContent = name.charAt(0);
      img.replaceWith(letter);
    }
  };
  return img;
}

// --- Bookmark Bar ---
async function renderBookmarks() {
  const sites = await window.electronAPI.getBookmarks();
  bookmarksContainer.innerHTML = '';

  for (const site of sites) {
    const bk = document.createElement('div');
    bk.className = 'bookmark';

    bk.appendChild(createFavicon(site.url, site.name, 'bk-letter'));

    const name = document.createElement('span');
    name.textContent = site.name;
    bk.appendChild(name);

    bk.addEventListener('click', () => {
      window.electronAPI.createTab(site.id);
    });

    bk.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showBookmarkContextMenu(e.clientX, e.clientY, site);
    });

    bookmarksContainer.appendChild(bk);
  }
}

// --- Tab Bar ---
function renderTabs(tabs, activeTabId) {
  tabsContainer.innerHTML = '';

  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title;
    el.appendChild(title);

    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '\u00D7';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      window.electronAPI.closeTab(tab.id);
    });
    el.appendChild(close);

    el.addEventListener('click', () => {
      window.electronAPI.switchTab(tab.id);
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTabContextMenu(e.clientX, e.clientY, tab);
    });

    tabsContainer.appendChild(el);
  }
}

// --- Site Picker (+ button) ---
tabAddBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  const sites = await window.electronAPI.getBookmarks();
  sitePicker.innerHTML = '';

  for (const site of sites) {
    const item = document.createElement('div');
    item.className = 'site-picker-item';

    item.appendChild(createFavicon(site.url, site.name, 'picker-letter'));

    const name = document.createElement('span');
    name.textContent = site.name;
    item.appendChild(name);

    item.addEventListener('click', () => {
      window.electronAPI.createTab(site.id);
      pickerOverlay.classList.remove('show');
    });

    sitePicker.appendChild(item);
  }

  // Position picker below + button
  const rect = tabAddBtn.getBoundingClientRect();
  sitePicker.style.left = rect.left + 'px';
  sitePicker.style.top = rect.bottom + 'px';
  pickerOverlay.classList.add('show');
});

pickerOverlay.addEventListener('click', () => {
  pickerOverlay.classList.remove('show');
});

// --- Context Menus ---
function showBookmarkContextMenu(x, y, site) {
  removeContextMenu();
  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';

  const hideItem = createMenuItem('Hide from bar', () => {
    window.electronAPI.disableSite(site.id);
    renderBookmarks();
  });

  contextMenu.appendChild(hideItem);
  document.body.appendChild(contextMenu);
}

function showTabContextMenu(x, y, tab) {
  removeContextMenu();
  contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu';
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';

  const refreshItem = createMenuItem('Refresh', () => {
    window.electronAPI.refreshTab(tab.id);
  });

  const closeItem = createMenuItem('Close Tab', () => {
    window.electronAPI.closeTab(tab.id);
  });

  contextMenu.appendChild(refreshItem);
  contextMenu.appendChild(closeItem);
  document.body.appendChild(contextMenu);
}

function createMenuItem(text, onClick, className) {
  const item = document.createElement('div');
  item.className = 'menu-item' + (className ? ' ' + className : '');
  item.textContent = text;
  item.addEventListener('click', () => {
    onClick();
    removeContextMenu();
  });
  return item;
}

function removeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

document.addEventListener('click', removeContextMenu);

// --- Settings ---
settingsBtn.addEventListener('click', () => {
  window.electronAPI.openSettings();
});

// --- IPC listeners from main process ---
window.electronAPI.onTabCreated((tabInfo) => {
  refreshTabBar();
});

window.electronAPI.onTabSwitched(({ tabId }) => {
  refreshTabBar();
});

window.electronAPI.onTabClosed(({ tabId }) => {
  refreshTabBar();
});

window.electronAPI.onTabTitleUpdated(({ tabId, title }) => {
  refreshTabBar();
});

window.electronAPI.onBookmarksChanged(() => {
  renderBookmarks();
});

async function refreshTabBar() {
  const data = await window.electronAPI.getTabs();
  renderTabs(data.tabs, data.activeTabId);
}

// --- Initial render ---
async function init() {
  await renderBookmarks();
  await refreshTabBar();
}

init();
```

- [ ] **Step 4: Commit**

```bash
git add electron/ui/
git commit -m "feat: add toolbar UI with bookmark bar, tab bar, and site picker"
```

---

### Task 4: Rewrite preload.js for multi-tab IPC

New IPC bridge supporting multi-tab operations and event listeners.

**Files:**
- Modify: `electron/preload.js`

- [ ] **Step 1: Rewrite electron/preload.js**

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Tab operations
  createTab: (siteId) => ipcRenderer.invoke('create-tab', siteId),
  switchTab: (tabId) => ipcRenderer.invoke('switch-tab', tabId),
  closeTab: (tabId) => ipcRenderer.invoke('close-tab', tabId),
  refreshTab: (tabId) => ipcRenderer.invoke('refresh-tab', tabId),
  getTabs: () => ipcRenderer.invoke('get-tabs'),

  // Bookmark / site operations
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  disableSite: (siteId) => ipcRenderer.invoke('disable-site', siteId),

  // Settings
  openSettings: () => ipcRenderer.invoke('open-settings'),
  closeSettings: () => ipcRenderer.invoke('close-settings'),

  // Store (for settings page)
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),

  // Cache
  clearSiteCache: (origin) => ipcRenderer.invoke('clear-site-cache', origin),
  clearAllCache: (origins) => ipcRenderer.invoke('clear-all-cache', origins),

  // Events from main → renderer
  onTabCreated: (cb) => ipcRenderer.on('tab-created', (_e, data) => cb(data)),
  onTabSwitched: (cb) => ipcRenderer.on('tab-switched', (_e, data) => cb(data)),
  onTabClosed: (cb) => ipcRenderer.on('tab-closed', (_e, data) => cb(data)),
  onTabTitleUpdated: (cb) => ipcRenderer.on('tab-title-updated', (_e, data) => cb(data)),
  onBookmarksChanged: (cb) => ipcRenderer.on('bookmarks-changed', (_e) => cb())
});
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.js
git commit -m "feat: rewrite preload.js for multi-tab IPC"
```

---

### Task 5: Rewrite main.js with BaseWindow + multi-tab

The main process: creates BaseWindow, adds UI WebContentsView for toolbar, initializes TabManager, handles IPC, manages session restore.

**Files:**
- Modify: `electron/main.js`

- [ ] **Step 1: Rewrite electron/main.js**

```javascript
const { app, BaseWindow, WebContentsView, ipcMain, session, shell } = require('electron');
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
    // Restore previous tabs
    let activeIndex = 0;
    for (let i = 0; i < lastSession.tabs.length; i++) {
      const saved = lastSession.tabs[i];
      const site = loadSites().find(s => s.id === saved.siteId);
      if (site) {
        const tabId = tabManager.createTab(site.id, site.name, saved.url || site.url);
        if (saved.siteId === lastSession.activeTab) {
          activeIndex = i;
        }
      }
    }
    // Switch to last active
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
ipcMain.handle('store-set', (_e, key, value) => storeSet(key, value));

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
    // Notify UI to refresh bookmarks
    if (uiView && !uiView.webContents.isDestroyed()) {
      uiView.webContents.send('bookmarks-changed');
    }
  }
});

ipcMain.handle('open-settings', () => {
  if (!tabManager) return;
  // Open settings as a special tab - load settings.html in a WebContentsView
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
  // Notify bookmarks may have changed
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
```

- [ ] **Step 2: Commit**

```bash
git add electron/main.js
git commit -m "feat: rewrite main.js with BaseWindow + multi-tab WebContentsView"
```

---

### Task 6: Create settings page (all sites deletable)

Adapt v1 settings to work as a tab inside the app. Key change: all sites (including builtin) can be deleted.

**Files:**
- Create: `electron/settings/settings.css`
- Create: `electron/settings/settings.html`
- Create: `electron/settings/settings.js`

- [ ] **Step 1: Copy settings CSS**

Copy `settings/settings.css` to `electron/settings/settings.css` (identical content from v1).

- [ ] **Step 2: Create electron/settings/settings.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Settings - AI Site Wrapper</title>
  <link rel="stylesheet" href="settings.css">
</head>
<body>
  <div class="container">
    <div class="header">
      <button id="back-btn" class="btn">&larr; Back</button>
      <h1>AI Site Wrapper Settings</h1>
      <button id="clear-all-cache" class="btn btn-danger">Clear All Cache</button>
    </div>
    <div id="sites-grid" class="sites-grid"></div>
  </div>
  <div id="modal-overlay" class="modal-overlay hidden">
    <div class="modal">
      <h2 id="modal-title">Add Website</h2>
      <label>Name<input type="text" id="modal-name" placeholder="Site name"></label>
      <label>URL<input type="url" id="modal-url" placeholder="https://example.com"></label>
      <div class="modal-actions">
        <button id="modal-cancel" class="btn">Cancel</button>
        <button id="modal-save" class="btn btn-primary">Save</button>
      </div>
    </div>
  </div>
  <script src="settings.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create electron/settings/settings.js**

Based on v1 `electron/settings-renderer.js` but with all sites deletable:

```javascript
let sites = [];
let defaultSiteId = null;
let dragSrcIndex = null;

async function loadSites() {
  return (await window.electronAPI.storeGet('sites')) || [];
}

async function saveSites(s) {
  await window.electronAPI.storeSet('sites', s);
}

async function loadDefaultSite() {
  return (await window.electronAPI.storeGet('defaultSite')) || null;
}

async function saveDefaultSite(id) {
  await window.electronAPI.storeSet('defaultSite', id);
}

async function init() {
  sites = await loadSites();
  defaultSiteId = await loadDefaultSite();
  render();
}

function render() {
  const grid = document.getElementById('sites-grid');
  grid.innerHTML = '';
  const sorted = [...sites].sort((a, b) => a.order - b.order);

  for (const site of sorted) {
    const card = document.createElement('div');
    card.className = 'site-card';
    card.draggable = true;
    card.dataset.id = site.id;

    let hostname;
    try { hostname = new URL(site.url).hostname; } catch { hostname = ''; }
    const faviconUrl = hostname ? `https://${hostname}/favicon.ico` : '';
    const isDefault = site.id === defaultSiteId;

    const header = document.createElement('div');
    header.className = 'card-header';

    const favicon = document.createElement('img');
    favicon.src = faviconUrl;
    favicon.alt = '';
    favicon.onerror = () => {
      if (!favicon.dataset.fallback) {
        favicon.dataset.fallback = '1';
        favicon.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
      } else {
        favicon.style.display = 'none';
      }
    };

    const siteName = document.createElement('span');
    siteName.className = 'site-name';
    siteName.textContent = site.name;

    const defaultBtn = document.createElement('button');
    defaultBtn.className = 'btn-default' + (isDefault ? ' active' : '');
    defaultBtn.textContent = isDefault ? '\u2605' : '\u2606';
    defaultBtn.title = isDefault ? 'Default' : 'Set as default';
    defaultBtn.addEventListener('click', async () => {
      defaultSiteId = isDefault ? null : site.id;
      await saveDefaultSite(defaultSiteId);
      render();
    });

    const toggle = document.createElement('label');
    toggle.className = 'toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = site.enabled;
    const slider = document.createElement('span');
    slider.className = 'slider';
    toggle.appendChild(checkbox);
    toggle.appendChild(slider);

    header.appendChild(favicon);
    header.appendChild(siteName);
    header.appendChild(defaultBtn);
    header.appendChild(toggle);

    const urlDiv = document.createElement('div');
    urlDiv.className = 'card-url';
    urlDiv.textContent = site.url;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-edit';
    editBtn.textContent = 'Edit';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn-clear-cache';
    clearBtn.textContent = 'Clear Cache';

    // All sites can be deleted (v2 change)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-delete';
    deleteBtn.textContent = 'Delete';

    actions.appendChild(editBtn);
    actions.appendChild(clearBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(header);
    card.appendChild(urlDiv);
    card.appendChild(actions);

    checkbox.addEventListener('change', async (e) => {
      site.enabled = e.target.checked;
      await saveSites(sites);
    });

    editBtn.addEventListener('click', () => openModal(site));

    clearBtn.addEventListener('click', async () => {
      if (!confirm(`Clear all cache for "${site.name}"?`)) return;
      const origin = new URL(site.url).origin;
      await window.electronAPI.clearSiteCache(origin);
      alert(`Cache cleared for ${site.name}`);
    });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${site.name}"?`)) return;
      sites = sites.filter(s => s.id !== site.id);
      if (defaultSiteId === site.id) {
        defaultSiteId = null;
        await saveDefaultSite(null);
      }
      await saveSites(sites);
      render();
    });

    // Drag-to-reorder
    card.addEventListener('dragstart', (e) => {
      dragSrcIndex = sorted.indexOf(site);
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      dragSrcIndex = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      const dropIndex = sorted.indexOf(site);
      if (dragSrcIndex === null || dragSrcIndex === dropIndex) return;
      const moved = sorted.splice(dragSrcIndex, 1)[0];
      sorted.splice(dropIndex, 0, moved);
      sorted.forEach((s, i) => s.order = i);
      await saveSites(sites);
      render();
    });

    grid.appendChild(card);
  }

  // Add custom site card
  const addCard = document.createElement('div');
  addCard.className = 'add-card';
  addCard.textContent = '+';
  addCard.addEventListener('click', () => openModal(null));
  grid.appendChild(addCard);
}

function openModal(site) {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const nameInput = document.getElementById('modal-name');
  const urlInput = document.getElementById('modal-url');

  title.textContent = site ? 'Edit Website' : 'Add Website';
  nameInput.value = site ? site.name : '';
  urlInput.value = site ? site.url : '';
  overlay.classList.remove('hidden');

  document.getElementById('modal-save').onclick = async () => {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!name || !url) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        alert('Only http:// and https:// URLs are allowed'); return;
      }
    } catch { alert('Please enter a valid URL'); return; }

    if (site) {
      site.name = name;
      site.url = url;
    } else {
      sites.push({
        id: 'custom_' + Date.now(),
        name,
        url,
        enabled: true,
        builtin: false,
        order: sites.length
      });
    }
    await saveSites(sites);
    overlay.classList.add('hidden');
    render();
  };

  document.getElementById('modal-cancel').onclick = () => {
    overlay.classList.add('hidden');
  };
}

document.getElementById('clear-all-cache').addEventListener('click', async () => {
  if (!confirm('Clear cache for ALL sites?')) return;
  const origins = sites.map(s => { try { return new URL(s.url).origin; } catch { return null; } }).filter(Boolean);
  await window.electronAPI.clearAllCache(origins);
  alert('All cache cleared');
});

document.getElementById('back-btn').addEventListener('click', () => {
  window.electronAPI.closeSettings();
});

init();
```

- [ ] **Step 4: Commit**

```bash
git add electron/settings/
git commit -m "feat: add settings page with all-sites-deletable support"
```

---

### Task 7: Create welcome page

Shown when no tabs are open.

**Files:**
- Create: `electron/welcome/welcome.html`

- [ ] **Step 1: Create electron/welcome/welcome.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Site Wrapper</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #aaa;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      text-align: center;
    }
    .welcome {
      max-width: 400px;
    }
    h1 {
      font-size: 28px;
      color: #fff;
      margin-bottom: 12px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .hint {
      color: #4a9eff;
      font-size: 13px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="welcome">
    <h1>AI Site Wrapper</h1>
    <p>Click a bookmark above or press <strong>+</strong> to open a site.</p>
    <p class="hint">Tip: Use the gear icon to manage your sites.</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add electron/welcome/
git commit -m "feat: add welcome page for empty tab state"
```

---

### Task 8: Update package.json

Update version, ensure build config includes new file structure.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update package.json**

```json
{
  "name": "ai-site-wrapper",
  "version": "2.0.0",
  "description": "Browser-like AI chat aggregator with multi-tab support",
  "main": "electron/main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win",
    "build:portable": "electron-builder --win portable"
  },
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "electron": "^35.0.0",
    "electron-builder": "^26.0.0"
  },
  "build": {
    "appId": "com.aisitewrapper.app",
    "productName": "AI Site Wrapper",
    "win": {
      "target": ["nsis"],
      "icon": "icons/icon256.png"
    },
    "nsis": {
      "oneClick": true,
      "allowToChangeInstallationDirectory": false
    },
    "files": [
      "electron/**/*",
      "lib/**/*",
      "icons/**/*",
      "!node_modules/**/*"
    ]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump to v2.0.0 and update build config"
```

---

### Task 9: Delete v1 Chrome extension files

Remove all files no longer needed in v2.

**Files:**
- Delete: `manifest.json`, `background.js`, `content.js`, `content.css`
- Delete: `app/` directory
- Delete: `setup/` directory
- Delete: `settings/` directory
- Delete: `electron/index.html`, `electron/renderer.js`, `electron/settings.html`, `electron/settings-renderer.js`

- [ ] **Step 1: Delete Chrome extension files**

```bash
rm -f manifest.json background.js content.js content.css
rm -rf app/ setup/ settings/
rm -f electron/index.html electron/renderer.js electron/settings.html electron/settings-renderer.js
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove v1 Chrome extension and old Electron files"
```

---

### Task 10: Integration test — run the app

Verify the app starts correctly and basic flows work.

- [ ] **Step 1: Run the app**

```bash
npm start
```

- [ ] **Step 2: Verify these flows manually**

1. App opens with default site (or welcome page if no sites configured)
2. Bookmark bar shows enabled sites
3. Click a bookmark → new tab opens with that site
4. Click another bookmark → second tab opens
5. Click between tabs → switches without reloading
6. Click × on tab → closes tab
7. Click + → site picker appears, select a site → new tab
8. Click ⚙ → settings opens as a tab
9. In settings: edit a site, toggle enable/disable, delete a site, add custom site
10. Close settings tab → bookmark bar updates
11. Close and reopen app → tabs restored from last session

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: integration fixes after testing"
```
