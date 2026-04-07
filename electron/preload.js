const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),
  getTabs: () => ipcRenderer.invoke('get-tabs'),
  switchTab: (siteId) => ipcRenderer.invoke('switch-tab', siteId),
  refreshTab: () => ipcRenderer.invoke('refresh-tab'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
  closeSettings: () => ipcRenderer.invoke('close-settings'),
  clearSiteCache: (origin) => ipcRenderer.invoke('clear-site-cache', origin),
  clearAllCache: (origins) => ipcRenderer.invoke('clear-all-cache', origins)
});
