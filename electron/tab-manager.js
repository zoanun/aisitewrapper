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
    this.welcomeView = null;
  }

  _showWelcome() {
    if (this.welcomeView) return;
    this.welcomeView = new WebContentsView({
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    this._setBounds(this.welcomeView);
    this.baseWindow.contentView.addChildView(this.welcomeView);
    this.welcomeView.webContents.loadFile(path.join(__dirname, 'welcome', 'welcome.html'));
  }

  _hideWelcome() {
    if (!this.welcomeView) return;
    this.baseWindow.contentView.removeChildView(this.welcomeView);
    this.welcomeView.webContents.close();
    this.welcomeView = null;
  }

  createTab(siteId, name, url) {
    this._hideWelcome();
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
        this._showWelcome();
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
    if (this.welcomeView) this._setBounds(this.welcomeView);
  }

  getSessionData() {
    const contentTabs = this.tabs.filter(t => t.siteId !== '__settings__');
    return {
      tabs: contentTabs.map(t => ({ siteId: t.siteId, url: t.url })),
      activeTab: this.activeTabId
        ? contentTabs.find(t => t.id === this.activeTabId)?.siteId || null
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
