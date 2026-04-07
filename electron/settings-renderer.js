// Electron version of settings.js — uses electronAPI instead of chrome.storage

let sites = [];
let defaultSiteId = null;
let dragSrcIndex = null;

async function loadSites() {
  const s = await window.electronAPI.storeGet('sites');
  return s || [];
}

async function saveSites(s) {
  await window.electronAPI.storeSet('sites', s);
}

async function loadDefaultSite() {
  return (await window.electronAPI.storeGet('defaultSite')) || null;
}

async function saveDefaultSite(id) {
  await window.electronAPI.storeSet('defaultSite', id);
}

async function init() {
  sites = await loadSites();
  defaultSiteId = await loadDefaultSite();
  render();
}

function render() {
  const grid = document.getElementById('sites-grid');
  grid.innerHTML = '';

  const sorted = [...sites].sort((a, b) => a.order - b.order);

  for (const site of sorted) {
    const card = document.createElement('div');
    card.className = 'site-card';
    card.draggable = true;
    card.dataset.id = site.id;

    const hostname = new URL(site.url).hostname;
    const faviconUrl = `https://${hostname}/favicon.ico`;
    const isDefault = site.id === defaultSiteId;

    const header = document.createElement('div');
    header.className = 'card-header';

    const favicon = document.createElement('img');
    favicon.src = faviconUrl;
    favicon.alt = '';
    favicon.onerror = () => {
      if (!favicon.dataset.fallback) {
        favicon.dataset.fallback = '1';
        favicon.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
      } else {
        favicon.style.display = 'none';
      }
    };

    const siteName = document.createElement('span');
    siteName.className = 'site-name';
    siteName.textContent = site.name;

    const defaultBtn = document.createElement('button');
    defaultBtn.className = 'btn-default' + (isDefault ? ' active' : '');
    defaultBtn.textContent = isDefault ? '\u2605' : '\u2606';
    defaultBtn.title = isDefault ? 'Default' : 'Set as default';
    defaultBtn.addEventListener('click', async () => {
      defaultSiteId = isDefault ? null : site.id;
      await saveDefaultSite(defaultSiteId);
      render();
    });

    const toggle = document.createElement('label');
    toggle.className = 'toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = site.enabled;
    const slider = document.createElement('span');
    slider.className = 'slider';
    toggle.appendChild(checkbox);
    toggle.appendChild(slider);

    header.appendChild(favicon);
    header.appendChild(siteName);
    header.appendChild(defaultBtn);
    header.appendChild(toggle);

    const urlDiv = document.createElement('div');
    urlDiv.className = 'card-url';
    urlDiv.textContent = site.url;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-edit';
    editBtn.textContent = 'Edit';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn-clear-cache';
    clearBtn.textContent = 'Clear Cache';

    actions.appendChild(editBtn);
    actions.appendChild(clearBtn);

    if (!site.builtin) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-danger btn-delete';
      deleteBtn.textContent = 'Delete';
      actions.appendChild(deleteBtn);
    }

    card.appendChild(header);
    card.appendChild(urlDiv);
    card.appendChild(actions);

    checkbox.addEventListener('change', async (e) => {
      site.enabled = e.target.checked;
      await saveSites(sites);
    });

    editBtn.addEventListener('click', () => openModal(site));

    clearBtn.addEventListener('click', async () => {
      if (!confirm(`Clear all cache for "${site.name}"?`)) return;
      const origin = new URL(site.url).origin;
      await window.electronAPI.clearSiteCache(origin);
      alert(`Cache cleared for ${site.name}`);
    });

    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete "${site.name}"?`)) return;
        sites = sites.filter(s => s.id !== site.id);
        await saveSites(sites);
        render();
      });
    }

    card.addEventListener('dragstart', (e) => {
      dragSrcIndex = sorted.indexOf(site);
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      dragSrcIndex = null;
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      const dropIndex = sorted.indexOf(site);
      if (dragSrcIndex === null || dragSrcIndex === dropIndex) return;
      const moved = sorted.splice(dragSrcIndex, 1)[0];
      sorted.splice(dropIndex, 0, moved);
      sorted.forEach((s, i) => s.order = i);
      await saveSites(sites);
      render();
    });

    grid.appendChild(card);
  }

  const addCard = document.createElement('div');
  addCard.className = 'add-card';
  addCard.textContent = '+';
  addCard.addEventListener('click', () => openModal(null));
  grid.appendChild(addCard);
}

function openModal(site) {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const nameInput = document.getElementById('modal-name');
  const urlInput = document.getElementById('modal-url');

  title.textContent = site ? 'Edit Website' : 'Add Website';
  nameInput.value = site ? site.name : '';
  urlInput.value = site ? site.url : '';
  overlay.classList.remove('hidden');

  document.getElementById('modal-save').onclick = async () => {
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!name || !url) return;
    try { new URL(url); } catch { alert('Please enter a valid URL'); return; }

    if (site) {
      site.name = name;
      site.url = url;
    } else {
      sites.push({
        id: 'custom_' + Date.now(),
        name,
        url,
        enabled: true,
        builtin: false,
        order: sites.length
      });
    }
    await saveSites(sites);
    overlay.classList.add('hidden');
    render();
  };

  document.getElementById('modal-cancel').onclick = () => {
    overlay.classList.add('hidden');
  };
}

document.getElementById('clear-all-cache').addEventListener('click', async () => {
  if (!confirm('Clear cache for ALL sites?')) return;
  const origins = sites.map(s => new URL(s.url).origin);
  await window.electronAPI.clearAllCache(origins);
  alert('All cache cleared');
});

document.getElementById('back-btn').addEventListener('click', () => {
  window.electronAPI.closeSettings();
});

init();
