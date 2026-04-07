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

// Load sites from storage, initialize with defaults if empty.
// Also sync builtin site URLs in case they changed between versions.
async function loadSites() {
  const result = await chrome.storage.local.get('sites');
  if (result.sites && result.sites.length > 0) {
    let changed = false;
    const sites = result.sites;
    // Update builtin sites with latest URLs/names from defaults
    for (const def of DEFAULT_SITES) {
      const existing = sites.find(s => s.id === def.id);
      if (existing && existing.builtin) {
        if (existing.url !== def.url) { existing.url = def.url; changed = true; }
        if (existing.name !== def.name) { existing.name = def.name; changed = true; }
      }
    }
    if (changed) await chrome.storage.local.set({ sites });
    return sites;
  }
  const sites = DEFAULT_SITES.map((s, i) => ({ ...s, order: i }));
  await chrome.storage.local.set({ sites });
  return sites;
}

async function saveSites(sites) {
  await chrome.storage.local.set({ sites });
}

async function loadWindowState() {
  const result = await chrome.storage.local.get('window');
  return result.window || DEFAULT_WINDOW;
}

async function saveWindowState(state) {
  await chrome.storage.local.set({ window: state });
}

async function loadLastActiveTab() {
  const result = await chrome.storage.local.get('lastActiveTab');
  return result.lastActiveTab || null;
}

async function saveLastActiveTab(tabId) {
  await chrome.storage.local.set({ lastActiveTab: tabId });
}

async function loadDefaultSite() {
  const result = await chrome.storage.local.get('defaultSite');
  return result.defaultSite || null;
}

async function saveDefaultSite(siteId) {
  await chrome.storage.local.set({ defaultSite: siteId });
}
