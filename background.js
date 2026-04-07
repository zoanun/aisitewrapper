importScripts('lib/config.js');

let aiwrapWindowId = null;
let tabMap = {}; // siteId -> chromeTabId (only for tabs already created)
let launching = false;

// Gate all operations behind state restoration
const ready = restoreState();

chrome.action.onClicked.addListener(async () => {
  await ready;
  handleLaunch();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('setup/setup.html') });
  }
});

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
  tabMap = {};
  tabMap[startSite.id] = win.tabs[0].id;

  await saveLastActiveTab(startSite.id);
  await persistState();
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  if (windowId === aiwrapWindowId) {
    aiwrapWindowId = null;
    tabMap = {};
    await chrome.storage.session.remove(['aiwrapWindowId', 'tabMap']);
  }
});

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

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await ready;
  if (activeInfo.windowId !== aiwrapWindowId) return;
  for (const [siteId, chromeTabId] of Object.entries(tabMap)) {
    if (chromeTabId === activeInfo.tabId) {
      await saveLastActiveTab(siteId);
      break;
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // All message handlers must wait for state restoration
  ready.then(async () => {
    if (msg.type === 'IS_AIWRAP_WINDOW') {
      // Also recover aiwrapWindowId from sender if we lost it
      if (aiwrapWindowId === null && sender.tab?.windowId) {
        // Check if this window looks like ours (popup type)
        try {
          const win = await chrome.windows.get(sender.tab.windowId);
          if (win.type === 'popup') {
            aiwrapWindowId = win.id;
            await persistState();
          }
        } catch {}
      }
      sendResponse({ isAiwrap: sender.tab?.windowId === aiwrapWindowId });
      return;
    }
    if (msg.type === 'GET_TABS') {
      sendResponse(await handleGetTabs(sender.tab));
      return;
    }
    if (msg.type === 'SWITCH_TAB') {
      sendResponse(await handleSwitchTab(msg.siteId, sender.tab));
      return;
    }
    if (msg.type === 'OPEN_SETTINGS') {
      const wid = aiwrapWindowId || sender.tab?.windowId;
      if (wid) {
        chrome.tabs.create({
          windowId: wid,
          url: chrome.runtime.getURL('settings/settings.html'),
          active: true
        });
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'REFRESH_TAB') {
      const chromeTabId = msg.siteId ? tabMap[msg.siteId] : sender.tab?.id;
      if (chromeTabId) chrome.tabs.reload(chromeTabId);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'HIDE_TAB') {
      sendResponse(await handleHideTab(msg.siteId));
      return;
    }
    if (msg.type === 'LAUNCH') {
      await handleLaunch();
      sendResponse({ ok: true });
      return;
    }
    sendResponse({});
  });
  return true; // keep message channel open for async response
});

async function handleGetTabs(senderTab) {
  const sites = await loadSites();
  const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);
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

async function handleSwitchTab(siteId, senderTab) {
  // If tab already exists, just activate it (instant, no reload)
  if (tabMap[siteId]) {
    try {
      await chrome.tabs.update(tabMap[siteId], { active: true });
      await saveLastActiveTab(siteId);
      return { ok: true };
    } catch {
      // Tab no longer exists, remove from map and create new
      delete tabMap[siteId];
    }
  }

  // First time clicking this site — create a new tab in the AIWrap window
  const sites = await loadSites();
  const site = sites.find(s => s.id === siteId);
  // Use aiwrapWindowId, or fall back to sender's window
  const windowId = aiwrapWindowId || senderTab?.windowId;
  if (site && windowId) {
    const tab = await chrome.tabs.create({
      windowId,
      url: site.url,
      active: true
    });
    tabMap[siteId] = tab.id;
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
    const chromeTabId = tabMap[siteId];
    if (chromeTabId) {
      await chrome.tabs.remove(chromeTabId);
      delete tabMap[siteId];
    }
    await persistState();
  }
  return { ok: true };
}
