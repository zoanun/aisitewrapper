const isEdge = navigator.userAgent.includes('Edg/');
const browserName = isEdge ? 'Microsoft Edge' : 'Google Chrome';
const browserExe = isEdge ? 'msedge.exe' : 'chrome.exe';
const extensionId = chrome.runtime.id;
const appUrl = `chrome-extension://${extensionId}/app/index.html`;

document.getElementById('browser-name').textContent = browserName;
document.getElementById('shortcut-cmd').textContent = `"${browserExe}" --app=${appUrl}`;

document.getElementById('start-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'LAUNCH' });
  window.close();
});
