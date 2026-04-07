importScripts('lib/config.js');

let aiwrapWindowId = null;
let tabMap = {}; // siteId -> chromeTabId
let launching = false;

chrome.action.onClicked.addListener(handleLaunch);

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('setup/setup.html') });
  }
});

// Restore state from session storage on Service Worker wake-up
async function restoreState() {
  const result = await chrome.storage.session.get(['aiwrapWindowId', 'tabMap']);
  if (result.aiwrapWindowId) {
    try {
      const win = await chrome.windows.get(result.aiwrapWindowId);
      if (win) {
        aiwrapWindowId = result.aiwrapWindowId;
        tabMap = result.tabMap || {};
      }
    } catch {
      await chrome.storage.session.remove(['aiwrapWindowId', 'tabMap']);
    }
  }
}

async function persistState() {
  await chrome.storage.session.set({ aiwrapWindowId, tabMap });
}

restoreState();

async function handleLaunch() {
  if (launching) return;
  launching = true;
  try {
    if (aiwrapWindowId !== null) {
      try {
        const win = await chrome.windows.get(aiwrapWindowId);
        if (win) {
          await chrome.windows.update(aiwrapWindowId, { focused: true });
          return;
        }
      } catch {
        aiwrapWindowId = null;
        tabMap = {};
      }
    }
    await createAiwrapWindow();
  } finally {
    launching = false;
  }
}

async function createAiwrapWindow() {
  const sites = await loadSites();
  const windowState = await loadWindowState();
  const lastActive = await loadLastActiveTab();
  const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);

  if (enabledSites.length === 0) return;

  // Create window with first site
  const win = await chrome.windows.create({
    url: enabledSites[0].url,
    type: 'popup',
    width: windowState.width,
    height: windowState.height,
    ...(windowState.left !== undefined && { left: windowState.left }),
    ...(windowState.top !== undefined && { top: windowState.top })
  });

  aiwrapWindowId = win.id;
  tabMap = {};
  tabMap[enabledSites[0].id] = win.tabs[0].id;

  // Pre-create all other tabs (background loading for cache)
  for (let i = 1; i < enabledSites.length; i++) {
    const tab = await chrome.tabs.create({
      windowId: aiwrapWindowId,
      url: enabledSites[i].url,
      active: false
    });
    tabMap[enabledSites[i].id] = tab.id;
  }

  // Activate last active tab if available
  if (lastActive && tabMap[lastActive]) {
    await chrome.tabs.update(tabMap[lastActive], { active: true });
  }

  await persistState();
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  if (windowId === aiwrapWindowId) {
    aiwrapWindowId = null;
    tabMap = {};
    await chrome.storage.session.remove(['aiwrapWindowId', 'tabMap']);
  }
});

// Save window position/size when focus leaves
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (aiwrapWindowId === null) return;
  if (windowId !== aiwrapWindowId && windowId !== chrome.windows.WINDOW_ID_NONE) {
    try {
      const win = await chrome.windows.get(aiwrapWindowId);
      await saveWindowState({
        width: win.width,
        height: win.height,
        left: win.left,
        top: win.top
      });
    } catch {}
  }
});

// Track active tab changes (user clicking native Chrome tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (activeInfo.windowId !== aiwrapWindowId) return;
  for (const [siteId, chromeTabId] of Object.entries(tabMap)) {
    if (chromeTabId === activeInfo.tabId) {
      await saveLastActiveTab(siteId);
      break;
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TABS') {
    handleGetTabs(sender.tab).then(sendResponse);
    return true;
  }
  if (msg.type === 'SWITCH_TAB') {
    handleSwitchTab(msg.siteId).then(sendResponse);
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
    const chromeTabId = msg.siteId ? tabMap[msg.siteId] : sender.tab?.id;
    if (chromeTabId) chrome.tabs.reload(chromeTabId);
    return false;
  }
  if (msg.type === 'HIDE_TAB') {
    handleHideTab(msg.siteId).then(sendResponse);
    return true;
  }
  if (msg.type === 'LAUNCH') {
    handleLaunch();
    return false;
  }
});

async function handleGetTabs(senderTab) {
  const sites = await loadSites();
  const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);
  // Find which site the sender tab belongs to
  let currentSiteId = null;
  if (senderTab) {
    for (const [siteId, chromeTabId] of Object.entries(tabMap)) {
      if (chromeTabId === senderTab.id) {
        currentSiteId = siteId;
        break;
      }
    }
  }
  return { sites: enabledSites, currentSiteId };
}

async function handleSwitchTab(siteId) {
  const chromeTabId = tabMap[siteId];
  if (chromeTabId) {
    await chrome.tabs.update(chromeTabId, { active: true });
    await saveLastActiveTab(siteId);
  }
  return { ok: true };
}

async function handleHideTab(siteId) {
  const sites = await loadSites();
  const site = sites.find(s => s.id === siteId);
  if (site) {
    site.enabled = false;
    await saveSites(sites);
    const chromeTabId = tabMap[siteId];
    if (chromeTabId) {
      await chrome.tabs.remove(chromeTabId);
      delete tabMap[siteId];
    }
    await persistState();
  }
  return { ok: true };
}
