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
