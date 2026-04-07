// Entry point for app mode. Triggers window creation via background.
chrome.runtime.sendMessage({ type: 'IS_AIWRAP_WINDOW' });
