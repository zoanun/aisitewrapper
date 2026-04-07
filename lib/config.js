const DEFAULT_SITES = [
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', enabled: true, builtin: true },
  { id: 'doubao', name: '豆包', url: 'https://doubao.com', enabled: true, builtin: true },
  { id: 'tongyi', name: '千问', url: 'https://chat.qwen.ai', enabled: true, builtin: true },
  { id: 'yuanbao', name: '元宝', url: 'https://yuanbao.tencent.com', enabled: true, builtin: true },
  { id: 'glm', name: '智谱清言', url: 'https://chatglm.cn', enabled: true, builtin: true },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', enabled: true, builtin: true },
  { id: 'gemini', name: 'Gemini', url: 'https://aistudio.google.com/', enabled: true, builtin: true },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai', enabled: true, builtin: true },
  { id: 'kimi', name: 'Kimi', url: 'https://kimi.moonshot.cn', enabled: false, builtin: true },
  { id: 'wenxin', name: '文心一言', url: 'https://yiyan.baidu.com', enabled: false, builtin: true },
  { id: 'spark', name: '讯飞星火', url: 'https://xinghuo.xfyun.cn', enabled: false, builtin: true },
  { id: 'tiangong', name: '天工', url: 'https://tiangong.cn', enabled: false, builtin: true },
  { id: 'hailuo', name: '海螺', url: 'https://hailuoai.com', enabled: false, builtin: true },
  { id: 'perplexity', name: 'Perplexity', url: 'https://perplexity.ai', enabled: false, builtin: true },
  { id: 'grok', name: 'Grok', url: 'https://grok.com', enabled: false, builtin: true },
  { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com', enabled: false, builtin: true },
  { id: 'mistral', name: 'Mistral', url: 'https://chat.mistral.ai', enabled: false, builtin: true },
  { id: 'huggingchat', name: 'HuggingChat', url: 'https://huggingface.co/chat', enabled: false, builtin: true },
  { id: 'poe', name: 'Poe', url: 'https://poe.com', enabled: false, builtin: true }
];

const DEFAULT_WINDOW = { width: 1280, height: 800 };

// Detect environment: Chrome extension vs Electron
const IS_ELECTRON = typeof window !== 'undefined' && window.electronAPI;
const IS_CHROME_EXT = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

// --- Storage abstraction ---
const storage = (() => {
  if (IS_CHROME_EXT) {
    return {
      async get(key) {
        const result = await chrome.storage.local.get(key);
        return result[key];
      },
      async set(key, value) {
        await chrome.storage.local.set({ [key]: value });
      }
    };
  }
  if (IS_ELECTRON) {
    return {
      async get(key) {
        return window.electronAPI.storeGet(key);
      },
      async set(key, value) {
        return window.electronAPI.storeSet(key, value);
      }
    };
  }
  // Fallback: localStorage (for Node.js main process, use separate store)
  return {
    async get(key) {
      try {
        const val = localStorage.getItem('aiwrap_' + key);
        return val ? JSON.parse(val) : undefined;
      } catch { return undefined; }
    },
    async set(key, value) {
      localStorage.setItem('aiwrap_' + key, JSON.stringify(value));
    }
  };
})();

// Load sites from storage, initialize with defaults if empty.
// Also sync builtin site URLs in case they changed between versions.
async function loadSites() {
  const sites = await storage.get('sites');
  if (sites && sites.length > 0) {
    let changed = false;
    for (const def of DEFAULT_SITES) {
      const existing = sites.find(s => s.id === def.id);
      if (existing && existing.builtin) {
        if (existing.url !== def.url) { existing.url = def.url; changed = true; }
        if (existing.name !== def.name) { existing.name = def.name; changed = true; }
      }
    }
    if (changed) await storage.set('sites', sites);
    return sites;
  }
  const defaultSites = DEFAULT_SITES.map((s, i) => ({ ...s, order: i }));
  await storage.set('sites', defaultSites);
  return defaultSites;
}

async function saveSites(sites) {
  await storage.set('sites', sites);
}

async function loadWindowState() {
  const state = await storage.get('window');
  return state || DEFAULT_WINDOW;
}

async function saveWindowState(state) {
  await storage.set('window', state);
}

async function loadLastActiveTab() {
  return (await storage.get('lastActiveTab')) || null;
}

async function saveLastActiveTab(tabId) {
  await storage.set('lastActiveTab', tabId);
}

async function loadDefaultSite() {
  return (await storage.get('defaultSite')) || null;
}

async function saveDefaultSite(siteId) {
  await storage.set('defaultSite', siteId);
}

// Export for Node.js (Electron main process)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_SITES, DEFAULT_WINDOW, loadSites, saveSites, loadWindowState, saveWindowState, loadLastActiveTab, saveLastActiveTab, loadDefaultSite, saveDefaultSite };
}
