// Entry point for app mode (--app=chrome-extension://<id>/app/index.html).
// Sends LAUNCH to background to create the AIWrap window with all tabs.
chrome.runtime.sendMessage({ type: 'LAUNCH' });
