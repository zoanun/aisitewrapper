(async () => {
  // Only activate inside AIWrap window
  let resp;
  try {
    resp = await chrome.runtime.sendMessage({ type: 'IS_AIWRAP_WINDOW' });
  } catch {
    return; // Extension context invalidated (e.g. after reload)
  }
  if (!resp || !resp.isAiwrap) return;

  // Skip settings/setup pages (error page is injected manually by background.js)
  if (location.protocol === 'chrome-extension:' &&
      !location.pathname.includes('error.html')) return;

  // Helper to safely send messages (extension may be reloaded at any time)
  function safeSendMessage(msg) {
    try {
      return chrome.runtime.sendMessage(msg);
    } catch {
      return Promise.resolve(null);
    }
  }

  let tabbar = null;
  let tabsContainer = null;
  let contextMenu = null;
  let hideTimer = null;

  function ensureTabbar() {
    if (document.getElementById('aiwrap-tabbar')) return;


    tabbar = document.createElement('div');
    tabbar.id = 'aiwrap-tabbar';

    tabsContainer = document.createElement('div');
    tabsContainer.className = 'aiwrap-tabs';

    const settingsBtn = document.createElement('div');
    settingsBtn.className = 'aiwrap-settings-btn';
    settingsBtn.textContent = '\u2699';
    settingsBtn.title = 'Settings';
    settingsBtn.addEventListener('click', () => {
      safeSendMessage({ type: 'OPEN_SETTINGS' });
    });

    tabbar.appendChild(tabsContainer);
    tabbar.appendChild(settingsBtn);

    // Append to html (not body) so body's transform doesn't clip the tabbar
    document.documentElement.prepend(tabbar);

    // Keep visible while hovering the tab bar
    tabbar.addEventListener('mouseenter', () => {
      clearTimeout(hideTimer);
      tabbar.classList.add('aiwrap-visible');
    });
    tabbar.addEventListener('mouseleave', () => {
      hideTimer = setTimeout(() => {
        tabbar.classList.remove('aiwrap-visible');
      }, 300);
    });

    renderTabs();
  }

  async function renderTabs() {
    if (!tabsContainer) return;
    const tabsResp = await safeSendMessage({ type: 'GET_TABS' });
    if (!tabsResp) return;

    while (tabsContainer.firstChild) tabsContainer.firstChild.remove();
    const sites = tabsResp.sites || [];
    const activeSiteId = tabsResp.currentSiteId;

    for (const site of sites) {
      const tab = document.createElement('div');
      tab.className = 'aiwrap-tab' + (site.id === activeSiteId ? ' active' : '');
      tab.dataset.siteId = site.id;

      const favicon = document.createElement('img');
      const hostname = new URL(site.url).hostname;
      favicon.src = `https://${hostname}/favicon.ico`;
      favicon.alt = '';
      favicon.onerror = () => {
        // Fallback 1: try Google favicon service
        if (!favicon.dataset.fallback) {
          favicon.dataset.fallback = '1';
          favicon.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
        } else {
          // Fallback 2: replace with first letter
          const letter = document.createElement('span');
          letter.className = 'aiwrap-tab-letter';
          letter.textContent = site.name.charAt(0);
          favicon.replaceWith(letter);
        }
      };

      const name = document.createElement('span');
      name.textContent = site.name;

      tab.appendChild(favicon);
      tab.appendChild(name);

      tab.addEventListener('click', () => {
        if (site.id !== activeSiteId) {
          showLoading(site.name);
        }
        safeSendMessage({ type: 'SWITCH_TAB', siteId: site.id });
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
      safeSendMessage({ type: 'HIDE_TAB', siteId });
      removeContextMenu();
    });

    const refreshItem = document.createElement('div');
    refreshItem.className = 'aiwrap-menu-item';
    refreshItem.textContent = 'Refresh Page';
    refreshItem.addEventListener('click', () => {
      safeSendMessage({ type: 'REFRESH_TAB', siteId });
      removeContextMenu();
    });

    contextMenu.appendChild(hideItem);
    contextMenu.appendChild(refreshItem);
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';
    document.documentElement.appendChild(contextMenu);
  }

  function removeContextMenu() {
    if (contextMenu) {
      contextMenu.remove();
      contextMenu = null;
    }
  }

  function showLoading(name) {
    const existing = document.getElementById('aiwrap-loading');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'aiwrap-loading';
    const spinner = document.createElement('div');
    spinner.className = 'aiwrap-spinner';
    const text = document.createElement('div');
    text.className = 'aiwrap-loading-text';
    text.textContent = `Loading ${name}...`;
    const hint = document.createElement('div');
    hint.className = 'aiwrap-loading-hint';
    hint.textContent = 'Press ESC to cancel';
    overlay.appendChild(spinner);
    overlay.appendChild(text);
    overlay.appendChild(hint);
    document.documentElement.appendChild(overlay);

    const onEsc = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        document.removeEventListener('keydown', onEsc);
        overlay.remove();
        safeSendMessage({ type: 'CANCEL_NAV' });
      }
    };
    document.addEventListener('keydown', onEsc);
  }

  document.addEventListener('click', removeContextMenu);

  // Show tab bar when mouse near top, hide when mouse leaves
  document.addEventListener('mousemove', (e) => {
    if (!tabbar) return;
    if (e.clientY <= 8) {
      // Mouse near top edge — show
      clearTimeout(hideTimer);
      tabbar.classList.add('aiwrap-visible');
    } else if (e.clientY > 50 && tabbar.classList.contains('aiwrap-visible')) {
      // Mouse moved away — hide after short delay
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        tabbar.classList.remove('aiwrap-visible');
      }, 300);
    }
  });


  // Listen for tab bar refresh requests from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'REFRESH_TABBAR') {
      renderTabs();
    }
  });

  // Initial injection
  ensureTabbar();

  // Watch for SPA frameworks that replace body content — re-inject if tab bar is removed
  const observer = new MutationObserver(() => {
    if (!document.getElementById('aiwrap-tabbar')) {
      ensureTabbar();
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
