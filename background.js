importScripts('lib/config.js');

let aiwrapWindowId = null;
let aiwrapTabId = null;
let currentSiteId = null;
let launching = false;

chrome.action.onClicked.addListener(handleLaunch);

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('setup/setup.html') });
  }
});

// Restore state from session storage on Service Worker wake-up
async function restoreState() {
  const result = await chrome.storage.session.get(['aiwrapWindowId', 'aiwrapTabId', 'currentSiteId']);
  if (result.aiwrapWindowId) {
    try {
      const win = await chrome.windows.get(result.aiwrapWindowId);
      if (win) {
        aiwrapWindowId = result.aiwrapWindowId;
        aiwrapTabId = result.aiwrapTabId;
        currentSiteId = result.currentSiteId;
      }
    } catch {
      await chrome.storage.session.remove(['aiwrapWindowId', 'aiwrapTabId', 'currentSiteId']);
    }
  }
}

async function persistState() {
  await chrome.storage.session.set({ aiwrapWindowId, aiwrapTabId, currentSiteId });
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
        aiwrapTabId = null;
        currentSiteId = null;
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

  // Determine which site to open first
  const startSite = (lastActive && enabledSites.find(s => s.id === lastActive)) || enabledSites[0];

  const win = await chrome.windows.create({
    url: startSite.url,
    type: 'popup',
    width: windowState.width,
    height: windowState.height,
    ...(windowState.left !== undefined && { left: windowState.left }),
    ...(windowState.top !== undefined && { top: windowState.top })
  });

  aiwrapWindowId = win.id;
  aiwrapTabId = win.tabs[0].id;
  currentSiteId = startSite.id;

  await saveLastActiveTab(currentSiteId);
  await persistState();
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  if (windowId === aiwrapWindowId) {
    // Save window state before clearing
    aiwrapWindowId = null;
    aiwrapTabId = null;
    currentSiteId = null;
    await chrome.storage.session.remove(['aiwrapWindowId', 'aiwrapTabId', 'currentSiteId']);
  }
});

// Save window position/size when focus changes
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
    } catch {
      // Window may have been closed
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
  if (msg.type === 'GET_CURRENT_SITE') {
    sendResponse({ siteId: currentSiteId });
    return false;
  }
  if (msg.type === 'IS_AIWRAP_WINDOW') {
    sendResponse({ isAiwrap: sender.tab?.windowId === aiwrapWindowId });
    return false;
  }
  if (msg.type === 'OPEN_SETTINGS') {
    // Open settings in the single tab
    if (aiwrapTabId) {
      chrome.tabs.update(aiwrapTabId, { url: chrome.runtime.getURL('settings/settings.html') });
    }
    return false;
  }
  if (msg.type === 'REFRESH_TAB') {
    if (aiwrapTabId) chrome.tabs.reload(aiwrapTabId);
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

async function handleGetTabs() {
  const sites = await loadSites();
  const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);
  return { sites: enabledSites, currentSiteId };
}

async function handleSwitchTab(siteId) {
  const sites = await loadSites();
  const site = sites.find(s => s.id === siteId);
  if (site && aiwrapTabId) {
    await chrome.tabs.update(aiwrapTabId, { url: site.url });
    currentSiteId = siteId;
    await saveLastActiveTab(siteId);
    await persistState();
  }
  return { ok: true };
}

async function handleHideTab(siteId) {
  const sites = await loadSites();
  const site = sites.find(s => s.id === siteId);
  if (site) {
    site.enabled = false;
    await saveSites(sites);
    // If hiding the current site, switch to the first enabled one
    if (siteId === currentSiteId) {
      const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);
      if (enabledSites.length > 0 && aiwrapTabId) {
        await chrome.tabs.update(aiwrapTabId, { url: enabledSites[0].url });
        currentSiteId = enabledSites[0].id;
        await saveLastActiveTab(currentSiteId);
      }
    }
    await persistState();
  }
  return { ok: true };
}
