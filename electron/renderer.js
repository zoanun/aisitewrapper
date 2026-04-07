const tabsContainer = document.getElementById('tabs');
const settingsBtn = document.getElementById('settings-btn');
let contextMenu = null;

async function renderTabs() {
  const data = await window.electronAPI.getTabs();
  if (!data) return;

  tabsContainer.innerHTML = '';
  const { sites, currentSiteId } = data;

  for (const site of sites) {
    const tab = document.createElement('div');
    tab.className = 'tab' + (site.id === currentSiteId ? ' active' : '');

    const favicon = document.createElement('img');
    let hostname;
    try { hostname = new URL(site.url).hostname; } catch { hostname = ''; }
    favicon.src = hostname ? `https://${hostname}/favicon.ico` : '';
    favicon.alt = '';
    favicon.onerror = () => {
      if (!favicon.dataset.fallback) {
        favicon.dataset.fallback = '1';
        favicon.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
      } else {
        const letter = document.createElement('span');
        letter.className = 'tab-letter';
        letter.textContent = site.name.charAt(0);
        favicon.replaceWith(letter);
      }
    };

    const name = document.createElement('span');
    name.textContent = site.name;

    tab.appendChild(favicon);
    tab.appendChild(name);

    tab.addEventListener('click', async () => {
      if (site.id !== currentSiteId) {
        await window.electronAPI.switchTab(site.id);
        renderTabs();
      }
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
  contextMenu.className = 'context-menu';
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';

  const refreshItem = document.createElement('div');
  refreshItem.className = 'menu-item';
  refreshItem.textContent = 'Refresh Page';
  refreshItem.addEventListener('click', () => {
    window.electronAPI.refreshTab();
    removeContextMenu();
  });

  contextMenu.appendChild(refreshItem);
  document.body.appendChild(contextMenu);
}

function removeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

document.addEventListener('click', removeContextMenu);

settingsBtn.addEventListener('click', () => {
  window.electronAPI.openSettings();
});

renderTabs();
