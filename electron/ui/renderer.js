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
async function openPicker() {
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
      closePicker();
    });

    sitePicker.appendChild(item);
  }

  // Expand UI view to full window so dropdown is visible
  await window.electronAPI.expandUIView();

  // Position picker below + button
  const rect = tabAddBtn.getBoundingClientRect();
  sitePicker.style.left = rect.left + 'px';
  sitePicker.style.top = rect.bottom + 'px';
  pickerOverlay.classList.add('show');
}

function closePicker() {
  pickerOverlay.classList.remove('show');
  window.electronAPI.shrinkUIView();
}

tabAddBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openPicker();
});

pickerOverlay.addEventListener('click', () => {
  closePicker();
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
