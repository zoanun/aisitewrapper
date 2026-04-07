importScripts('lib/config.js');

let aiwrapWindowId = null;
let aiwrapTabId = null; // single tab in the popup window
let currentSiteId = null;
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
  const result = await chrome.storage.session.get(['aiwrapWindowId', 'aiwrapTabId', 'currentSiteId']);
  if (result.aiwrapWindowId) {
    try {
      const win = await chrome.windows.get(result.aiwrapWindowId);
      if (win) {
        aiwrapWindowId = result.aiwrapWindowId;
        aiwrapTabId = result.aiwrapTabId || null;
        currentSiteId = result.currentSiteId || null;
        // Validate tab still exists
        if (aiwrapTabId) {
          try {
            await chrome.tabs.get(aiwrapTabId);
          } catch {
            aiwrapTabId = null;
          }
        }
      }
    } catch {
      await chrome.storage.session.remove(['aiwrapWindowId', 'aiwrapTabId', 'currentSiteId']);
    }
  }
}

async function persistState() {
  await chrome.storage.session.set({ aiwrapWindowId, aiwrapTabId, currentSiteId });
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
        aiwrapTabId = null;
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

  const defaultSite = await loadDefaultSite();
  const startSite =
    (defaultSite && enabledSites.find(s => s.id === defaultSite)) ||
    (lastActive && enabledSites.find(s => s.id === lastActive)) ||
    enabledSites[0];

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

  await saveLastActiveTab(startSite.id);
  await persistState();
}

chrome.windows.onRemoved.addListener(async (windowId) => {
  if (windowId === aiwrapWindowId) {
    aiwrapWindowId = null;
    aiwrapTabId = null;
    currentSiteId = null;
    await chrome.storage.session.remove(['aiwrapWindowId', 'aiwrapTabId', 'currentSiteId']);
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

// Detect page load failure in AIWrap tab — show error page with tab bar
let previousSiteId = null;

// Catch navigation errors that mean the site is unreachable
const FATAL_ERRORS = [
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_CONNECTION_REFUSED',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_NAME_NOT_RESOLVED',
  'net::ERR_INTERNET_DISCONNECTED',
  'net::ERR_ADDRESS_UNREACHABLE',
  'net::ERR_NETWORK_CHANGED',
  'net::ERR_SSL_PROTOCOL_ERROR',
  'net::ERR_CERT_AUTHORITY_INVALID',
];
chrome.webNavigation.onErrorOccurred.addListener(async (details) => {
  await ready;
  if (details.tabId !== aiwrapTabId || details.frameId !== 0) return;
  if (details.url.startsWith(chrome.runtime.getURL(''))) return;
  if (!FATAL_ERRORS.includes(details.error)) return;

  const sites = await loadSites();
  const site = sites.find(s => s.id === currentSiteId);
  const name = site ? site.name : '';
  const url = site ? site.url : '';
  const errorPage = chrome.runtime.getURL(`app/error.html?name=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}`);
  try {
    await chrome.tabs.update(details.tabId, { url: errorPage });
  } catch {
    // Tab no longer exists
    aiwrapTabId = null;
  }
});

// Inject content script on extension error page (content_scripts can't match chrome-extension://)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  await ready;
  if (tabId !== aiwrapTabId) return;
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith(chrome.runtime.getURL('app/error.html'))) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    } catch {
      // Tab may no longer exist
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // All message handlers must wait for state restoration
  ready.then(async () => {
    if (msg.type === 'IS_AIWRAP_WINDOW') {
      // Also recover aiwrapWindowId from sender if we lost it
      if (aiwrapWindowId === null && sender.tab?.windowId) {
        try {
          const win = await chrome.windows.get(sender.tab.windowId);
          if (win.type === 'popup') {
            aiwrapWindowId = win.id;
            aiwrapTabId = sender.tab.id;
            await persistState();
          }
        } catch {}
      }
      sendResponse({ isAiwrap: sender.tab?.windowId === aiwrapWindowId });
      return;
    }
    if (msg.type === 'GET_TABS') {
      sendResponse(await handleGetTabs());
      return;
    }
    if (msg.type === 'SWITCH_TAB') {
      sendResponse(await handleSwitchTab(msg.siteId, sender.tab));
      return;
    }
    if (msg.type === 'CANCEL_NAV') {
      // Stop loading and go back to previous site
      if (previousSiteId) {
        const sites = await loadSites();
        const prevSite = sites.find(s => s.id === previousSiteId);
        if (prevSite) {
          currentSiteId = previousSiteId;
          aiwrapTabId = sender.tab?.id || aiwrapTabId;
          await saveLastActiveTab(currentSiteId);
          await persistState();
          try {
            await chrome.tabs.update(aiwrapTabId, { url: prevSite.url });
          } catch {}
        }
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'OPEN_SETTINGS') {
      // Navigate the single tab to settings
      if (aiwrapTabId || sender.tab?.id) {
        const tabId = aiwrapTabId || sender.tab.id;
        await chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL('settings/settings.html')
        });
      }
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'REFRESH_TAB') {
      const tabId = aiwrapTabId || sender.tab?.id;
      if (tabId) chrome.tabs.reload(tabId);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === 'HIDE_TAB') {
      sendResponse(await handleHideTab(msg.siteId, sender.tab));
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

async function handleGetTabs() {
  const sites = await loadSites();
  const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);
  return { sites: enabledSites, currentSiteId };
}

async function handleSwitchTab(siteId, senderTab) {
  if (siteId === currentSiteId) return { ok: true };

  const sites = await loadSites();
  const site = sites.find(s => s.id === siteId);
  if (!site) return { ok: false };

  // Navigate the single tab to the new site
  const tabId = aiwrapTabId || senderTab?.id;
  if (!tabId) return { ok: false };

  previousSiteId = currentSiteId;
  currentSiteId = siteId;
  aiwrapTabId = tabId;
  await saveLastActiveTab(siteId);
  await persistState();
  await chrome.tabs.update(tabId, { url: site.url });

  return { ok: true };
}

async function handleHideTab(siteId, senderTab) {
  const sites = await loadSites();
  const site = sites.find(s => s.id === siteId);
  if (site) {
    site.enabled = false;
    await saveSites(sites);
    // If hiding the current site, switch to the first enabled one
    if (siteId === currentSiteId) {
      const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);
      if (enabledSites.length > 0) {
        await handleSwitchTab(enabledSites[0].id, senderTab);
      }
    }
  }
  return { ok: true };
}
