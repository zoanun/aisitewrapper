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
  settingsBtn.innerHTML = '&#9881;';
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
      const hostname = new URL(site.url).hostname;
      favicon.src = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
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
      chrome.runtime.sendMessage({ type: 'REFRESH_TAB', siteId });
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

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TAB_CHANGED') {
      renderTabs();
    }
  });

  renderTabs();
})();
