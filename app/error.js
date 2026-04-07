const params = new URLSearchParams(location.search);
const url = params.get('url');
const name = params.get('name');

if (name) {
  document.getElementById('msg-en').textContent = 'Unable to connect to ' + name;
  document.getElementById('msg-zh').textContent = '\u65E0\u6CD5\u8FDE\u63A5\u5230 ' + name;
} else {
  document.getElementById('msg-zh').textContent = '\u65E0\u6CD5\u8FDE\u63A5\u5230\u8BE5\u7F51\u7AD9';
}
if (url) document.getElementById('url').textContent = url;

document.getElementById('back-btn').addEventListener('click', async () => {
  const lastActive = await loadLastActiveTab();
  const sites = await loadSites();
  const enabledSites = sites.filter(s => s.enabled).sort((a, b) => a.order - b.order);
  const target = enabledSites.find(s => s.url !== url) || enabledSites[0];
  if (target) {
    chrome.runtime.sendMessage({ type: 'SWITCH_TAB', siteId: target.id });
  }
});

document.getElementById('retry-btn').addEventListener('click', () => {
  if (url) location.href = url;
});
