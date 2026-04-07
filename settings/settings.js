let sites = [];
let dragSrcIndex = null;

async function init() {
  sites = await loadSites();
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

    const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=32`;

    card.innerHTML = `
      <div class="card-header">
        <img src="${faviconUrl}" alt="">
        <span class="site-name">${escapeHtml(site.name)}</span>
        <label class="toggle">
          <input type="checkbox" ${site.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <div class="card-url">${escapeHtml(site.url)}</div>
      <div class="card-actions">
        <button class="btn btn-edit">Edit</button>
        <button class="btn btn-clear-cache">Clear Cache</button>
        ${!site.builtin ? '<button class="btn btn-danger btn-delete">Delete</button>' : ''}
      </div>
    `;

    card.querySelector('input[type="checkbox"]').addEventListener('change', async (e) => {
      site.enabled = e.target.checked;
      await saveSites(sites);
    });

    card.querySelector('.btn-edit').addEventListener('click', () => openModal(site));

    card.querySelector('.btn-clear-cache').addEventListener('click', () => clearSiteCache(site));

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

    if (site) {
      site.name = name;
      site.url = url;
    } else {
      const id = 'custom_' + Date.now();
      sites.push({
        id,
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

async function clearSiteCache(site) {
  if (!confirm(`Clear all cache for "${site.name}"?\nThis will remove cookies, localStorage, and cached data for this site.`)) return;
  const origin = new URL(site.url).origin;
  await chrome.browsingData.remove(
    { origins: [origin] },
    { cookies: true, cache: true, localStorage: true }
  );
  alert(`Cache cleared for ${site.name}`);
}

document.getElementById('clear-all-cache').addEventListener('click', async () => {
  if (!confirm('Clear cache for ALL configured sites?\nThis will remove cookies, localStorage, and cached data.')) return;
  const origins = sites.map(s => new URL(s.url).origin);
  await chrome.browsingData.remove(
    { origins },
    { cookies: true, cache: true, localStorage: true }
  );
  alert('All cache cleared');
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
