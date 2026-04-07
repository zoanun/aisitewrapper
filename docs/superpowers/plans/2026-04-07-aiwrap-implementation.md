# AIWrap Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome/Edge browser extension that aggregates AI chat websites into a standalone-feeling window with custom tab bar, settings UI, and first-run setup.

**Architecture:** Chrome Extension Manifest V3. A background service worker manages a dedicated popup window and creates Chrome tabs for each enabled AI site. A content script injects a custom tab bar into every page within the AIWrap window. Settings and setup are standalone HTML pages within the extension.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JavaScript (no frameworks), HTML/CSS, `chrome.storage.local`, `chrome.windows`, `chrome.tabs`, `chrome.browsingData`

---

## File Structure

```
aiwrap/
├── manifest.json              # Manifest V3 config with permissions
├── background.js              # Service Worker: window/tab lifecycle
├── content.js                 # Content script: tab bar injection
├── content.css                # Tab bar styles (injected)
├── app/
│   ├── index.html             # Main entry point for app mode
│   ├── app.js                 # Startup logic, redirect to first tab
│   └── app.css                # Loading page styles
├── settings/
│   ├── settings.html          # Settings page
│   ├── settings.js            # Card grid, drag-sort, CRUD
│   └── settings.css           # Settings styles
├── setup/
│   ├── setup.html             # First-run setup guide
│   └── setup.js               # Detect browser, generate shortcut
├── icons/
│   └── icon128.png            # Extension icon (other sizes generated)
└── lib/
    └── config.js              # Default site list, storage utilities
```

---

### Task 1: Manifest and Config Foundation

**Files:**
- Create: `manifest.json`
- Create: `lib/config.js`

- [ ] **Step 1: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "AIWrap",
  "version": "1.0.0",
  "description": "Aggregate AI chat websites into one window",
  "permissions": [
    "storage",
    "tabs",
    "browsingData"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["content.css"],
      "run_at": "document_end"
    }
  ],
  "action": {
    "default_title": "AIWrap - Open AI Hub"
  },
  "icons": {
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Create `lib/config.js`**

```javascript
const DEFAULT_SITES = [
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', enabled: true, builtin: true },
  { id: 'doubao', name: 'Doubao', url: 'https://doubao.com', enabled: true, builtin: true },
  { id: 'tongyi', name: 'Tongyi', url: 'https://tongyi.aliyun.com', enabled: true, builtin: true },
  { id: 'yuanbao', name: 'Yuanbao', url: 'https://yuanbao.tencent.com', enabled: true, builtin: true },
  { id: 'glm', name: 'GLM', url: 'https://chatglm.cn', enabled: true, builtin: true },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', enabled: true, builtin: true },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com', enabled: true, builtin: true },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai', enabled: true, builtin: true },
  { id: 'kimi', name: 'Kimi', url: 'https://kimi.moonshot.cn', enabled: false, builtin: true },
  { id: 'wenxin', name: 'Wenxin', url: 'https://yiyan.baidu.com', enabled: false, builtin: true },
  { id: 'spark', name: 'Spark', url: 'https://xinghuo.xfyun.cn', enabled: false, builtin: true },
  { id: 'tiangong', name: 'Tiangong', url: 'https://tiangong.cn', enabled: false, builtin: true },
  { id: 'hailuo', name: 'Hailuo', url: 'https://hailuoai.com', enabled: false, builtin: true },
  { id: 'perplexity', name: 'Perplexity', url: 'https://perplexity.ai', enabled: false, builtin: true },
  { id: 'grok', name: 'Grok', url: 'https://grok.com', enabled: false, builtin: true },
  { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com', enabled: false, builtin: true },
  { id: 'mistral', name: 'Mistral', url: 'https://chat.mistral.ai', enabled: false, builtin: true },
  { id: 'huggingchat', name: 'HuggingChat', url: 'https://huggingface.co/chat', enabled: false, builtin: true },
  { id: 'poe', name: 'Poe', url: 'https://poe.com', enabled: false, builtin: true }
];

const DEFAULT_WINDOW = { width: 1280, height: 800 };

async function loadSites() {
  const result = await chrome.storage.local.get('sites');
  if (result.sites && result.sites.length > 0) {
    return result.sites;
  }
  const sites = DEFAULT_SITES.map((s, i) => ({ ...s, order: i }));
  await chrome.storage.local.set({ sites });
  return sites;
}

async function saveSites(sites) {
  await chrome.storage.local.set({ sites });
}

async function loadWindowState() {
  const result = await chrome.storage.local.get('window');
  return result.window || DEFAULT_WINDOW;
}

async function saveWindowState(state) {
  await chrome.storage.local.set({ window: state });
}

async function loadLastActiveTab() {
  const result = await chrome.storage.local.get('lastActiveTab');
  return result.lastActiveTab || null;
}

async function saveLastActiveTab(tabId) {
  await chrome.storage.local.set({ lastActiveTab: tabId });
}
```

- [ ] **Step 3: Create a placeholder `icons/icon128.png`**

Generate a simple 128x128 PNG icon. For now, use a solid-color square as placeholder:

```bash
# Use ImageMagick if available, or create manually
# For development, any 128x128 PNG works
```

- [ ] **Step 4: Verify — load extension in Chrome**

1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked", select the `aiwrap/` directory
4. Extension should load without errors

- [ ] **Step 5: Commit**

```bash
git add manifest.json lib/config.js icons/
git commit -m "feat: add manifest.json and config with default site list"
```

---

### Task 2: Background Service Worker — Window Management

**Files:**
- Create: `background.js`

- [ ] **Step 1: Create `background.js` with window management**

```javascript
let aiwrapWindowId = null;
const tabMap = new Map(); // siteId -> chromeTabId

chrome.action.onClicked.addListener(handleLaunch);

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('setup/setup.html') });
  }
});

async function handleLaunch() {
  if (aiwrapWindowId !== null) {
    try {
      const win = await chrome.windows.get(aiwrapWindowId);
      if (win) {
        await chrome.windows.update(aiwrapWindowId, { focused: true });
        return;
      }
    } catch {
      aiwrapWindowId = null;
      tabMap.clear();
    }
  }
  await createAiwrapWindow();
}

async function createAiwrapWindow() {
  const sites = await loadSites();
  const windowState = await loadWindowState();
  const lastActive = await loadLastActiveTab();
  const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);

  if (enabledSites.length === 0) return;

  const win = await chrome.windows.create({
    url: enabledSites[0].url,
    type: 'popup',
    width: windowState.width,
    height: windowState.height,
    ...(windowState.left !== undefined && { left: windowState.left }),
    ...(windowState.top !== undefined && { top: windowState.top })
  });

  aiwrapWindowId = win.id;
  tabMap.set(enabledSites[0].id, win.tabs[0].id);

  for (let i = 1; i < enabledSites.length; i++) {
    const tab = await chrome.tabs.create({
      windowId: aiwrapWindowId,
      url: enabledSites[i].url,
      active: false
    });
    tabMap.set(enabledSites[i].id, tab.id);
  }

  // Activate last active tab if available
  if (lastActive && tabMap.has(lastActive)) {
    await chrome.tabs.update(tabMap.get(lastActive), { active: true });
  }
}

// Save window state on bounds change
chrome.windows.onBoundsChanged.addListener(async (win) => {
  if (win.id === aiwrapWindowId) {
    await saveWindowState({
      width: win.width,
      height: win.height,
      left: win.left,
      top: win.top
    });
  }
});

// Clean up when window closes
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === aiwrapWindowId) {
    aiwrapWindowId = null;
    tabMap.clear();
  }
});

// Track active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (activeInfo.windowId !== aiwrapWindowId) return;
  for (const [siteId, chromeTabId] of tabMap) {
    if (chromeTabId === activeInfo.tabId) {
      await saveLastActiveTab(siteId);
      break;
    }
  }
});

// Message handler for content script tab bar
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TABS') {
    handleGetTabs().then(sendResponse);
    return true;
  }
  if (msg.type === 'SWITCH_TAB') {
    handleSwitchTab(msg.siteId).then(sendResponse);
    return true;
  }
  if (msg.type === 'GET_ACTIVE_TAB') {
    handleGetActiveTab(sender.tab).then(sendResponse);
    return true;
  }
  if (msg.type === 'IS_AIWRAP_WINDOW') {
    sendResponse({ isAiwrap: sender.tab?.windowId === aiwrapWindowId });
    return false;
  }
  if (msg.type === 'OPEN_SETTINGS') {
    chrome.tabs.create({
      windowId: aiwrapWindowId,
      url: chrome.runtime.getURL('settings/settings.html'),
      active: true
    });
    return false;
  }
  if (msg.type === 'REFRESH_TAB') {
    if (sender.tab) chrome.tabs.reload(sender.tab.id);
    return false;
  }
  if (msg.type === 'HIDE_TAB') {
    handleHideTab(msg.siteId).then(sendResponse);
    return true;
  }
});

async function handleGetTabs() {
  const sites = await loadSites();
  const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);
  return { sites: enabledSites };
}

async function handleSwitchTab(siteId) {
  const chromeTabId = tabMap.get(siteId);
  if (chromeTabId) {
    await chrome.tabs.update(chromeTabId, { active: true });
    await saveLastActiveTab(siteId);
  }
  return { ok: true };
}

async function handleGetActiveTab(senderTab) {
  if (!senderTab) return { siteId: null };
  for (const [siteId, chromeTabId] of tabMap) {
    if (chromeTabId === senderTab.id) {
      return { siteId };
    }
  }
  return { siteId: null };
}

async function handleHideTab(siteId) {
  const sites = await loadSites();
  const site = sites.find(s => s.id === siteId);
  if (site) {
    site.enabled = false;
    await saveSites(sites);
    const chromeTabId = tabMap.get(siteId);
    if (chromeTabId) {
      await chrome.tabs.remove(chromeTabId);
      tabMap.delete(siteId);
    }
  }
  return { ok: true };
}
```

- [ ] **Step 2: Verify — click extension icon opens popup window**

1. Reload extension in `chrome://extensions/`
2. Click the AIWrap extension icon in toolbar
3. A popup window should open with all 8 default enabled sites as tabs

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "feat: add background service worker with window/tab management"
```

---

### Task 3: Content Script — Tab Bar Injection

**Files:**
- Create: `content.js`
- Create: `content.css`

- [ ] **Step 1: Create `content.css`**

```css
#aiwrap-tabbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: #1e1e1e;
  display: flex;
  align-items: center;
  z-index: 2147483647;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  user-select: none;
}

#aiwrap-tabbar .aiwrap-tabs {
  display: flex;
  align-items: center;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  scrollbar-width: none;
}

#aiwrap-tabbar .aiwrap-tabs::-webkit-scrollbar {
  display: none;
}

#aiwrap-tabbar .aiwrap-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 100%;
  color: #aaa;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

#aiwrap-tabbar .aiwrap-tab:hover {
  background: #2a2a2a;
  color: #ddd;
}

#aiwrap-tabbar .aiwrap-tab.active {
  color: #fff;
  border-bottom-color: #4a9eff;
  background: #2a2a2a;
}

#aiwrap-tabbar .aiwrap-tab img {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

#aiwrap-tabbar .aiwrap-settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 100%;
  color: #888;
  cursor: pointer;
  flex-shrink: 0;
}

#aiwrap-tabbar .aiwrap-settings-btn:hover {
  color: #ddd;
  background: #2a2a2a;
}

/* Push page content down so tab bar doesn't overlap */
html.aiwrap-active {
  margin-top: 40px !important;
}

/* Context menu */
#aiwrap-context-menu {
  position: fixed;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 4px 0;
  z-index: 2147483647;
  min-width: 140px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
}

#aiwrap-context-menu .aiwrap-menu-item {
  padding: 6px 16px;
  color: #ddd;
  cursor: pointer;
}

#aiwrap-context-menu .aiwrap-menu-item:hover {
  background: #3a3a3a;
}
```

- [ ] **Step 2: Create `content.js`**

```javascript
(async () => {
  // Only activate inside AIWrap window
  const resp = await chrome.runtime.sendMessage({ type: 'IS_AIWRAP_WINDOW' });
  if (!resp || !resp.isAiwrap) return;

  // Skip if already injected or if this is an extension page
  if (document.getElementById('aiwrap-tabbar')) return;
  if (location.protocol === 'chrome-extension:') return;

  document.documentElement.classList.add('aiwrap-active');

  const tabbar = document.createElement('div');
  tabbar.id = 'aiwrap-tabbar';

  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'aiwrap-tabs';

  const settingsBtn = document.createElement('div');
  settingsBtn.className = 'aiwrap-settings-btn';
  settingsBtn.innerHTML = '&#9881;'; // gear icon
  settingsBtn.title = 'Settings';
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
  });

  tabbar.appendChild(tabsContainer);
  tabbar.appendChild(settingsBtn);
  document.body.prepend(tabbar);

  let contextMenu = null;

  async function renderTabs() {
    const [tabsResp, activeResp] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_TABS' }),
      chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB' })
    ]);

    tabsContainer.innerHTML = '';
    const sites = tabsResp.sites || [];
    const activeSiteId = activeResp.siteId;

    for (const site of sites) {
      const tab = document.createElement('div');
      tab.className = 'aiwrap-tab' + (site.id === activeSiteId ? ' active' : '');
      tab.dataset.siteId = site.id;

      const favicon = document.createElement('img');
      favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=32`;
      favicon.alt = '';

      const name = document.createElement('span');
      name.textContent = site.name;

      tab.appendChild(favicon);
      tab.appendChild(name);

      tab.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'SWITCH_TAB', siteId: site.id });
      });

      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, site.id);
      });

      tabsContainer.appendChild(tab);
    }
  }

  function showContextMenu(x, y, siteId) {
    removeContextMenu();
    contextMenu = document.createElement('div');
    contextMenu.id = 'aiwrap-context-menu';

    const hideItem = document.createElement('div');
    hideItem.className = 'aiwrap-menu-item';
    hideItem.textContent = 'Hide Tab';
    hideItem.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'HIDE_TAB', siteId });
      removeContextMenu();
    });

    const refreshItem = document.createElement('div');
    refreshItem.className = 'aiwrap-menu-item';
    refreshItem.textContent = 'Refresh Page';
    refreshItem.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'REFRESH_TAB' });
      removeContextMenu();
    });

    contextMenu.appendChild(hideItem);
    contextMenu.appendChild(refreshItem);
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    document.body.appendChild(contextMenu);
  }

  function removeContextMenu() {
    if (contextMenu) {
      contextMenu.remove();
      contextMenu = null;
    }
  }

  document.addEventListener('click', removeContextMenu);

  // Listen for tab activation changes to update active state
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TAB_CHANGED') {
      renderTabs();
    }
  });

  renderTabs();
})();
```

- [ ] **Step 3: Add tab change broadcast to `background.js`**

In `background.js`, inside `chrome.tabs.onActivated.addListener`, after saving the last active tab, broadcast to all tabs in the aiwrap window:

```javascript
// Add this after saveLastActiveTab(siteId) in the onActivated listener:
// Broadcast tab change to all tabs in the window
const tabs = await chrome.tabs.query({ windowId: aiwrapWindowId });
for (const t of tabs) {
  chrome.tabs.sendMessage(t.id, { type: 'TAB_CHANGED' }).catch(() => {});
}
```

- [ ] **Step 4: Verify — tab bar appears in AIWrap window**

1. Reload extension
2. Click extension icon to open AIWrap window
3. Tab bar should appear at top of each AI site page
4. Clicking tabs should switch between sites
5. Right-click should show context menu with "Hide Tab" and "Refresh Page"
6. Settings gear should open settings page (will be blank for now)

- [ ] **Step 5: Commit**

```bash
git add content.js content.css
git commit -m "feat: add content script with tab bar injection and context menu"
```

---

### Task 4: App Entry Page

**Files:**
- Create: `app/index.html`
- Create: `app/app.js`
- Create: `app/app.css`

- [ ] **Step 1: Create `app/app.css`**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #1a1a2e;
  color: #eee;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.loading {
  text-align: center;
}

.loading h1 {
  font-size: 28px;
  font-weight: 300;
  margin-bottom: 12px;
}

.loading p {
  color: #888;
  font-size: 14px;
}
```

- [ ] **Step 2: Create `app/app.js`**

```javascript
// Entry point for app mode. Triggers window creation via background.
chrome.runtime.sendMessage({ type: 'IS_AIWRAP_WINDOW' });
```

- [ ] **Step 3: Create `app/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AIWrap</title>
  <link rel="stylesheet" href="app.css">
</head>
<body>
  <div class="loading">
    <h1>AIWrap</h1>
    <p>Loading your AI workspace...</p>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat: add app entry page for app-mode launch"
```

---

### Task 5: Settings Page

**Files:**
- Create: `settings/settings.html`
- Create: `settings/settings.css`
- Create: `settings/settings.js`

- [ ] **Step 1: Create `settings/settings.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AIWrap Settings</title>
  <link rel="stylesheet" href="settings.css">
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AIWrap Settings</h1>
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
  <script src="../lib/config.js"></script>
  <script src="settings.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `settings/settings.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #333;
  padding: 24px;
}

.container { max-width: 1000px; margin: 0 auto; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header h1 { font-size: 24px; font-weight: 600; }

.sites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.site-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: grab;
  transition: box-shadow 0.15s;
}

.site-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }

.site-card.dragging { opacity: 0.5; }

.site-card .card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.site-card .card-header img {
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.site-card .card-header .site-name {
  font-weight: 500;
  flex: 1;
}

.site-card .card-url {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-card .card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Toggle switch */
.toggle {
  position: relative;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.toggle input { opacity: 0; width: 0; height: 0; }

.toggle .slider {
  position: absolute;
  inset: 0;
  background: #ccc;
  border-radius: 22px;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle .slider::before {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle input:checked + .slider { background: #4a9eff; }
.toggle input:checked + .slider::before { transform: translateX(18px); }

.btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}

.btn:hover { background: #f0f0f0; }
.btn-primary { background: #4a9eff; color: #fff; border-color: #4a9eff; }
.btn-primary:hover { background: #3a8eef; }
.btn-danger { background: #e74c3c; color: #fff; border-color: #e74c3c; }
.btn-danger:hover { background: #d63c2c; }

/* Add card */
.add-card {
  border: 2px dashed #ccc;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  cursor: pointer;
  color: #999;
  font-size: 32px;
  transition: border-color 0.15s, color 0.15s;
  background: transparent;
  box-shadow: none;
}

.add-card:hover { border-color: #4a9eff; color: #4a9eff; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-overlay.hidden { display: none; }

.modal {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
}

.modal input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
```

- [ ] **Step 3: Create `settings/settings.js`**

```javascript
let sites = [];
let dragSrcIndex = null;

async function init() {
  sites = await loadSites();
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

    const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=32`;

    card.innerHTML = `
      <div class="card-header">
        <img src="${faviconUrl}" alt="">
        <span class="site-name">${escapeHtml(site.name)}</span>
        <label class="toggle">
          <input type="checkbox" ${site.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <div class="card-url">${escapeHtml(site.url)}</div>
      <div class="card-actions">
        <button class="btn btn-edit">Edit</button>
        <button class="btn btn-clear-cache">Clear Cache</button>
        ${!site.builtin ? '<button class="btn btn-danger btn-delete">Delete</button>' : ''}
      </div>
    `;

    // Toggle
    card.querySelector('input[type="checkbox"]').addEventListener('change', async (e) => {
      site.enabled = e.target.checked;
      await saveSites(sites);
    });

    // Edit
    card.querySelector('.btn-edit').addEventListener('click', () => openModal(site));

    // Clear cache
    card.querySelector('.btn-clear-cache').addEventListener('click', () => clearSiteCache(site));

    // Delete
    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete "${site.name}"?`)) return;
        sites = sites.filter(s => s.id !== site.id);
        await saveSites(sites);
        render();
      });
    }

    // Drag events
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

      // Reorder
      const moved = sorted.splice(dragSrcIndex, 1)[0];
      sorted.splice(dropIndex, 0, moved);
      sorted.forEach((s, i) => s.order = i);
      await saveSites(sites);
      render();
    });

    grid.appendChild(card);
  }

  // Add card
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

    if (site) {
      site.name = name;
      site.url = url;
    } else {
      const id = 'custom_' + Date.now();
      sites.push({
        id,
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

async function clearSiteCache(site) {
  if (!confirm(`Clear all cache for "${site.name}"?\nThis will remove cookies, localStorage, and cached data for this site.`)) return;
  const origin = new URL(site.url).origin;
  await chrome.browsingData.remove(
    { origins: [origin] },
    { cookies: true, cache: true, localStorage: true }
  );
  alert(`Cache cleared for ${site.name}`);
}

document.getElementById('clear-all-cache').addEventListener('click', async () => {
  if (!confirm('Clear cache for ALL configured sites?\nThis will remove cookies, localStorage, and cached data.')) return;
  const origins = sites.map(s => new URL(s.url).origin);
  await chrome.browsingData.remove(
    { origins },
    { cookies: true, cache: true, localStorage: true }
  );
  alert('All cache cleared');
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
```

- [ ] **Step 4: Verify — settings page works**

1. Reload extension
2. Open AIWrap window, click gear icon in tab bar
3. Settings page opens with all sites as cards
4. Toggle switches enable/disable sites
5. Edit button opens modal to change name/URL
6. "+" card opens modal to add new site
7. Drag-and-drop reorders cards
8. Clear cache buttons work with confirmation

- [ ] **Step 5: Commit**

```bash
git add settings/
git commit -m "feat: add settings page with card grid, CRUD, drag-sort, and cache management"
```

---

### Task 6: First-Run Setup Page

**Files:**
- Create: `setup/setup.html`
- Create: `setup/setup.js`

- [ ] **Step 1: Create `setup/setup.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AIWrap Setup</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1a2e;
      color: #eee;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .setup {
      max-width: 520px;
      text-align: center;
    }
    h1 { font-size: 32px; margin-bottom: 8px; }
    .subtitle { color: #888; margin-bottom: 32px; font-size: 15px; }
    .steps { text-align: left; margin-bottom: 32px; }
    .step {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      align-items: flex-start;
    }
    .step-num {
      background: #4a9eff;
      color: #fff;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
    }
    .step-text { padding-top: 3px; line-height: 1.5; }
    .step-text code {
      background: #2a2a4a;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 13px;
    }
    .shortcut-box {
      background: #2a2a4a;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    .shortcut-box p { margin-bottom: 8px; font-size: 13px; color: #aaa; }
    .shortcut-box code {
      display: block;
      background: #1a1a2e;
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      word-break: break-all;
      user-select: all;
    }
    .btn {
      padding: 10px 24px;
      background: #4a9eff;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      cursor: pointer;
    }
    .btn:hover { background: #3a8eef; }
    #browser-name { font-weight: 600; color: #4a9eff; }
  </style>
</head>
<body>
  <div class="setup">
    <h1>Welcome to AIWrap</h1>
    <p class="subtitle">Your AI websites, one window away</p>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Detected browser: <span id="browser-name">Chrome</span></div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Create a desktop shortcut with the command below, then pin it to your taskbar for quick access.</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Or just click the AIWrap icon in your browser toolbar anytime.</div>
      </div>
    </div>
    <div class="shortcut-box">
      <p>Shortcut target (click to select, then copy):</p>
      <code id="shortcut-cmd"></code>
    </div>
    <button class="btn" id="start-btn">Open AIWrap Now</button>
  </div>
  <script src="setup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `setup/setup.js`**

```javascript
const isEdge = navigator.userAgent.includes('Edg/');
const browserName = isEdge ? 'Microsoft Edge' : 'Google Chrome';
const browserExe = isEdge ? 'msedge.exe' : 'chrome.exe';
const extensionId = chrome.runtime.id;
const appUrl = `chrome-extension://${extensionId}/app/index.html`;

document.getElementById('browser-name').textContent = browserName;
document.getElementById('shortcut-cmd').textContent = `"${browserExe}" --app=${appUrl}`;

document.getElementById('start-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'LAUNCH' });
  window.close();
});
```

- [ ] **Step 3: Add LAUNCH handler to `background.js`**

In the `chrome.runtime.onMessage.addListener` block in `background.js`, add:

```javascript
if (msg.type === 'LAUNCH') {
  handleLaunch();
  return false;
}
```

- [ ] **Step 4: Verify — setup page on first install**

1. Remove and re-load the extension
2. Setup page should open automatically
3. Browser detection should show correct browser
4. Shortcut command should contain the extension ID
5. "Open AIWrap Now" button should launch the AIWrap window

- [ ] **Step 5: Commit**

```bash
git add setup/
git commit -m "feat: add first-run setup page with browser detection and shortcut"
```

---

### Task 7: Polish and Integration

**Files:**
- Modify: `background.js`
- Modify: `content.js`
- Modify: `manifest.json`

- [ ] **Step 1: Add `web_accessible_resources` to `manifest.json` if needed for favicons**

If favicons from extension pages need to be accessible, add:

```json
"web_accessible_resources": [
  {
    "resources": ["icons/*"],
    "matches": ["<all_urls>"]
  }
]
```

- [ ] **Step 2: Handle edge case — extension pages in tab bar**

In `content.js`, the tab bar should not inject into extension pages (settings, setup). Already handled by `location.protocol === 'chrome-extension:'` check. Verify this works.

- [ ] **Step 3: Ensure content script doesn't run outside AIWrap window**

Already handled by the `IS_AIWRAP_WINDOW` check at the top of `content.js`. Verify that normal browser tabs are unaffected.

- [ ] **Step 4: Full integration test**

1. Load extension fresh
2. Setup page opens → click "Open AIWrap Now"
3. AIWrap window opens with 8 default tabs
4. Tab bar shows at top of each page with correct favicons and names
5. Click tabs to switch between sites
6. Right-click tab → "Hide Tab" removes it, "Refresh Page" reloads
7. Click gear → settings page opens
8. Toggle a site off → it disappears from tab bar on next window open
9. Add a custom site → appears in settings and tab bar
10. Drag to reorder → order persists
11. Close window → reopen via icon → window state (size) restored
12. Last active tab is remembered

- [ ] **Step 5: Commit**

```bash
git add manifest.json background.js content.js
git commit -m "feat: polish integration and add web_accessible_resources"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Manifest + Config | `manifest.json`, `lib/config.js` |
| 2 | Background worker | `background.js` |
| 3 | Tab bar content script | `content.js`, `content.css` |
| 4 | App entry page | `app/index.html`, `app/app.js`, `app/app.css` |
| 5 | Settings page | `settings/settings.html`, `settings/settings.js`, `settings/settings.css` |
| 6 | Setup page | `setup/setup.html`, `setup/setup.js` |
| 7 | Polish + integration | All files |
