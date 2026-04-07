# AIWrap - AI Website Aggregator Browser Extension

## Overview

AIWrap is a Chrome/Edge browser extension that aggregates mainstream AI chat websites into a single, standalone-feeling application window. Users can switch between AI services via a custom tab bar, manage their website list, and launch the tool as if it were an independent desktop application.

## Problem

Users who frequently use multiple AI services (DeepSeek, ChatGPT, Gemini, etc.) end up with many browser tabs mixed with regular browsing. Finding the right AI tab becomes tedious. AIWrap provides a dedicated, separate window for all AI websites, accessible with one click from the Windows taskbar.

## Core Requirements

1. **Reuse browser login state** — runs inside Chrome/Edge, shares all cookies and sessions
2. **Standalone app feel** — independent window and taskbar icon, no address bar or browser tab strip
3. **Custom tab bar** — top bar for switching between AI sites, no Chrome native tabs visible
4. **Configurable website list** — card-based settings UI for managing sites
5. **Remember state** — persists tab selection, window size/position, website configuration
6. **Zero runtime dependencies** — Chrome or Edge (pre-installed on Windows) is the only requirement
7. **Tiny package** — extension under 100KB

## Technology

- **Chrome Extension Manifest V3**
- **Chrome App Mode** (`--app=chrome-extension://<id>/index.html`) for standalone window
- Compatible with both Chrome and Edge

## Architecture

### Components

```
aiwrap/
├── manifest.json          # Manifest V3 config
├── background.js          # Service Worker: window/tab lifecycle
├── app/
│   ├── index.html         # Main page (tab bar entry point)
│   ├── app.js             # Tab bar logic, tab switching
│   └── app.css            # Tab bar styles
├── settings/
│   ├── settings.html      # Settings page
│   ├── settings.js        # Card grid, drag-sort, CRUD
│   └── settings.css       # Settings styles
├── setup/
│   ├── setup.html         # First-run setup guide
│   └── setup.js           # Detect browser, generate shortcut
├── icons/                 # Extension icons + default site favicons
└── lib/
    └── config.js          # Default site list, storage utilities
```

### Background Service Worker (`background.js`)

Responsibilities:
- Create and manage the dedicated popup window via `chrome.windows.create({type: 'popup'})`
- Create Chrome tabs for each enabled AI website within that window
- Handle tab switching requests from the injected tab bar
- Prevent duplicate windows (focus existing if already open)
- Save/restore window size and position
- Handle extension icon click as alternate launch method

### App Main Page (`app/index.html`)

- Serves as the entry point URL for App Mode
- Displays briefly while tabs are being created, then redirects to the first active tab

### Content Script (Tab Bar Injection)

- Injected into every tab within the AIWrap window
- Renders a fixed 40px tab bar at the top of each page
- Each tab shows: site favicon + site name
- Active tab is highlighted
- Settings gear icon on the right side of the tab bar
- Communicates with Background via `chrome.runtime.sendMessage`
- Right-click context menu on tabs: hide tab, refresh page

### Settings Page (`settings/`)

- Opens in a new tab or replaces current content
- Card-based grid layout (3-4 cards per row, responsive)

Each card contains:
- Site favicon + name
- Site URL
- Toggle switch (show/hide in tab bar)
- Edit button (modify name/URL)
- Clear cache button (clears cookies, localStorage, sessionStorage, cache for that site's domain only, with confirmation dialog)
- Delete button (only for user-added sites; built-in sites cannot be deleted)

Additional features:
- Drag-and-drop to reorder cards (determines tab bar order)
- "Add Website" card at the end (dashed border + plus icon)
- "Clear All Cache" button at top/bottom (clears cache for all sites, with confirmation)

## Default Website List

### Enabled by default (8 sites):

| Name | URL |
|------|-----|
| DeepSeek | https://chat.deepseek.com |
| Doubao (豆包) | https://doubao.com |
| Tongyi (通义千问) | https://tongyi.aliyun.com |
| Yuanbao (腾讯元宝) | https://yuanbao.tencent.com |
| GLM (智谱清言) | https://chatglm.cn |
| ChatGPT | https://chatgpt.com |
| Gemini | https://gemini.google.com |
| Claude | https://claude.ai |

### Disabled by default (11 sites):

| Name | URL |
|------|-----|
| Kimi | https://kimi.moonshot.cn |
| Wenxin (文心一言) | https://yiyan.baidu.com |
| Xunfei Spark (讯飞星火) | https://xinghuo.xfyun.cn |
| Tiangong (天工AI) | https://tiangong.cn |
| Hailuo (海螺AI) | https://hailuoai.com |
| Perplexity | https://perplexity.ai |
| Grok | https://grok.com |
| Copilot | https://copilot.microsoft.com |
| Mistral | https://chat.mistral.ai |
| HuggingChat | https://huggingface.co/chat |
| Poe | https://poe.com |

## Tab Bar UI

- Fixed at top of page, 40px height
- Dark theme (complements most AI sites' dark modes)
- Each tab: favicon (16x16) + name text
- Active tab: highlighted background
- Horizontal scrolling when tabs overflow
- Right side: settings gear icon
- Right-click tab: context menu with "Hide Tab" and "Refresh Page"

## Window Management

### Launch behavior:
- **First launch**: Create popup window, default 1280x800, centered
- **Subsequent launches**: If window exists, focus it; don't create duplicates
- **Window state**: Save size and position to `chrome.storage.local`, restore on next launch

### Tab lifecycle:
- On window creation: create a Chrome tab for each enabled site
- Tabs preload in background for instant switching
- Closing the window closes all tabs
- Next launch recreates all tabs fresh

## Data Persistence

Using `chrome.storage.local`:

```json
{
  "sites": [
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "url": "https://chat.deepseek.com",
      "icon": "icons/deepseek.png",
      "enabled": true,
      "builtin": true,
      "order": 0
    }
  ],
  "window": {
    "width": 1280,
    "height": 800,
    "left": 100,
    "top": 100
  },
  "lastActiveTab": "deepseek"
}
```

## Cache Management

- **Per-site clear**: Uses `chrome.browsingData.remove()` with `origins` parameter scoped to the site's domain. Clears cookies, localStorage, sessionStorage, and cache.
- **Clear all**: Same API, applied to all configured sites' domains.
- Both require user confirmation dialog before executing.

## Installation & Setup

1. User installs extension from Chrome Web Store (or loads unpacked for development)
2. Extension automatically opens setup page on first install
3. Setup page detects browser (Chrome or Edge)
4. One-click generates a desktop shortcut: `chrome.exe --app=chrome-extension://<id>/index.html` (or `msedge.exe` for Edge)
5. User can pin shortcut to taskbar
6. Extension icon click also works as alternate launch method

## Core Chrome APIs

| API | Usage |
|-----|-------|
| `chrome.windows.create({type: 'popup'})` | Create standalone window |
| `chrome.tabs.create/update/remove` | Manage site tabs |
| `chrome.storage.local` | Persist configuration |
| `chrome.browsingData.remove({origins})` | Per-site cache clearing |
| `chrome.action.onClicked` | Extension icon launch |
| `chrome.runtime.onInstalled` | Trigger setup flow |
| `chrome.runtime.sendMessage/onMessage` | Tab bar <-> Background communication |
