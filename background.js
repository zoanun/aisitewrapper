importScripts('lib/config.js');

let aiwrapWindowId = null;
const tabMap = new Map(); // siteId -> chromeTabId
let launching = false; // race condition guard

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
        if (result.tabMap) {
          for (const [k, v] of Object.entries(result.tabMap)) {
            tabMap.set(k, v);
          }
        }
      }
    } catch {
      // Window no longer exists
      await chrome.storage.session.remove(['aiwrapWindowId', 'tabMap']);
    }
  }
}

async function persistState() {
  const tabMapObj = Object.fromEntries(tabMap);
  await chrome.storage.session.set({ aiwrapWindowId, tabMap: tabMapObj });
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
        tabMap.clear();
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

  if (lastActive && tabMap.has(lastActive)) {
    await chrome.tabs.update(tabMap.get(lastActive), { active: true });
  }

  await persistState();
}

// Save window state before closing (onBoundsChanged doesn't exist in MV3)
chrome.windows.onRemoved.addListener(async (windowId) => {
  if (windowId === aiwrapWindowId) {
    aiwrapWindowId = null;
    tabMap.clear();
    await chrome.storage.session.remove(['aiwrapWindowId', 'tabMap']);
  }
});

// Save window position/size when focus changes (workaround for missing onBoundsChanged)
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (aiwrapWindowId === null) return;
  // When leaving AIWrap window, save its state
  if (windowId !== aiwrapWindowId && windowId !== chrome.windows.WINDOW_ID_NONE) {
    try {
      const win = await chrome.windows.get(aiwrapWindowId);
      await saveWindowState({
        width: win.width,
        height: win.height,
        left: win.left,
        top: win.top
      });
    } catch {
      // Window may have been closed
    }
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (activeInfo.windowId !== aiwrapWindowId) return;
  for (const [siteId, chromeTabId] of tabMap) {
    if (chromeTabId === activeInfo.tabId) {
      await saveLastActiveTab(siteId);
      // Broadcast tab change to all tabs in the window
      const tabs = await chrome.tabs.query({ windowId: aiwrapWindowId });
      for (const t of tabs) {
        chrome.tabs.sendMessage(t.id, { type: 'TAB_CHANGED' }).catch(() => {});
      }
      break;
    }
  }
});

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
    handleRefreshTab(msg.siteId).then(sendResponse);
    return true;
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

async function handleRefreshTab(siteId) {
  if (siteId) {
    const chromeTabId = tabMap.get(siteId);
    if (chromeTabId) {
      await chrome.tabs.reload(chromeTabId);
    }
  }
  return { ok: true };
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
    await persistState();
  }
  return { ok: true };
}
