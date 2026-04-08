# AI Site Wrapper v2 - Browser-Like Redesign

## Overview

Redesign AI Site Wrapper from a single-page tab switcher into a browser-like multi-tab application. Drop the Chrome extension entirely; focus on Electron desktop app only.

**Core change:** Replace single BrowserView with multiple WebContentsView instances, enabling true simultaneous multi-tab with preserved state.

## Architecture

### Tech Stack
- **Electron** with `BaseWindow` + `WebContentsView` (replaces deprecated `BrowserWindow` + `BrowserView`)
- **JSON file storage** in Electron `userData` directory
- **Shared config** from `lib/config.js` (carried over from v1)

### Process Architecture

```
BaseWindow
├── UI WebContentsView (书签栏 + Tab 栏, y: 0, height: 68px)
├── Tab1 WebContentsView (content, y: 68px, visible)
├── Tab2 WebContentsView (content, y: 68px, hidden)
└── Tab3 WebContentsView (content, y: 68px, hidden)
```

Each content tab runs in its own renderer process. Switching tabs toggles `visible` property without reloading.

### File Structure

```
aisitewrapper/
├── package.json
├── lib/
│   └── config.js              # Site list defaults + storage abstraction
├── electron/
│   ├── main.js                # Main process: BaseWindow, IPC handlers
│   ├── preload.js             # Context bridge for UI
│   ├── tab-manager.js         # Tab lifecycle (create/switch/close/resize)
│   ├── ui/
│   │   ├── index.html         # Bookmark bar + Tab bar
│   │   ├── renderer.js        # UI interaction logic
│   │   └── styles.css         # Styles
│   ├── settings/
│   │   ├── settings.html      # Settings page
│   │   ├── settings.js        # Settings logic
│   │   └── settings.css       # Settings styles
│   └── site-picker/
│       ├── picker.html        # "+" button site selection panel
│       └── picker.js          # Picker logic
├── icons/
└── dist/
```

### Files to Delete from v1
- `manifest.json` (Chrome extension)
- `background.js` (extension background)
- `content.js` / `content.css` (content scripts)
- `app/` (extension launch/error pages)
- `setup/` (first-run wizard)
- `settings/` (Chrome version settings, replaced by `electron/settings/`)

## UI Layout

```
┌──────────────────────────────────────────────────┐
│ [🔗DeepSeek] [🔗ChatGPT] [🔗Claude] ...    [⚙] │  ← Bookmark bar (32px)
│ [ChatGPT ×] [DeepSeek ×] [Claude ×]  [+]        │  ← Tab bar (36px)
├──────────────────────────────────────────────────┤
│                                                  │
│              Web content area                    │
│           (WebContentsView)                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

Total toolbar height: 68px. Content area starts at y=68.

### Bookmark Bar (32px)
- Displays **enabled** sites from settings: favicon + name
- **Click**: Create a new tab and load that site
- **Right-click**: Context menu (hide, edit, manage in settings)
- **Drag**: Reorder bookmarks, persisted to `order` field
- **Overflow**: Horizontal scroll or collapse into `>>` expand button
- **Gear icon (⚙)**: Opens settings as a special tab
- No free URL input — only configured sites

### Tab Bar (36px)
- Each tab shows: site name + × close button
- **Click tab**: Switch to that tab (show its WebContentsView, hide others)
- **Click ×**: Close tab, destroy WebContentsView, switch to adjacent tab
- **"+" button**: Opens site picker panel showing all enabled sites from settings
- Active tab highlighted with white text + blue bottom border (`#4a9eff`)
- Horizontal scroll when tabs overflow
- Drag to reorder tabs
- Same site can be opened in multiple tabs

### Style
- Dark theme carried over from v1
- Bookmark bar background: `#1e1e1e`
- Tab bar background: `#2a2a2a`
- Active tab: white text + `#4a9eff` blue bottom border
- Bookmark items: `#aaa` text, brighter on hover
- Window top area supports drag-to-move (`-webkit-app-region: drag`)

## Tab Management

### Tab Data Structure

```javascript
tabs = [
  { id: 'tab_1', siteId: 'deepseek', title: 'DeepSeek', url: '...', view: WebContentsView },
  { id: 'tab_2', siteId: 'chatgpt',  title: 'ChatGPT',  url: '...', view: WebContentsView },
]
activeTabId = 'tab_1'
```

### tab-manager.js API

| Method | Description |
|--------|-------------|
| `createTab(siteId, url)` | Create new WebContentsView, load URL, add to window, switch to it |
| `switchTab(tabId)` | Show target view, hide all others, update activeTabId |
| `closeTab(tabId)` | Destroy view, remove from list, switch to adjacent tab |
| `resizeAllViews()` | Recalculate bounds for all views on window resize |
| `getTabs()` | Return tab list for UI rendering |
| `getActiveTabId()` | Return current active tab ID |

### WebContentsView Positioning

All content views share the same bounds:
- `x: 0, y: 68, width: windowWidth, height: windowHeight - 68`
- Switching only changes `visible` property

### IPC Protocol

```
Renderer (UI) → Main (tab-manager)
  create-tab(siteId)        → creates WebContentsView
  switch-tab(tabId)         → toggles visibility
  close-tab(tabId)          → destroys view
  get-tabs()                → returns tab list
  get-bookmarks()           → returns enabled sites
  open-settings()           → opens settings as tab
  close-settings()          → closes settings tab

Main → Renderer (UI)
  tab-created(tabInfo)      → UI adds tab to bar
  tab-switched(tabId)       → UI updates active highlight
  tab-closed(tabId)         → UI removes tab from bar
  tab-title-updated(tabId, title) → UI updates tab label
```

## OAuth & Popup Handling

- Intercept `new-window` event on each WebContentsView
- OAuth domain whitelist (Google, Apple, Microsoft, GitHub, Auth0) → allow popup
- Same-origin popups → allow (site auth flows)
- External links → open in system default browser
- Non-HTTP(S) URLs → block
- Login sessions persist in Electron's own session storage; users log in once per site

## Data Storage

### File: `aiwrap-store.json`

```json
{
  "sites": [
    { "id": "deepseek", "name": "DeepSeek", "url": "https://chat.deepseek.com", "enabled": true, "builtin": true, "order": 0 },
    { "id": "chatgpt",  "name": "ChatGPT",  "url": "https://chatgpt.com",       "enabled": true, "builtin": true, "order": 1 },
    { "id": "custom_1", "name": "My Bot",    "url": "https://mybot.com",         "enabled": true, "builtin": false, "order": 10 }
  ],
  "defaultSite": "deepseek",
  "lastSession": {
    "tabs": ["deepseek", "chatgpt", "claude"],
    "activeTab": "chatgpt"
  }
}
```

### Site Management
- All sites (including built-in) can be deleted
- Custom sites added via settings with `custom_[timestamp]` ID
- `enabled` controls visibility in bookmark bar and "+" picker
- `order` controls bookmark bar display order

### Session Restore
- On app close: save open tab list + active tab to `lastSession`
- On app start: restore tabs from `lastSession`

### Window State: `window-state.json`
- Persists window size and position
- Restored on next launch

## Startup Flow

```
App launch
  ↓
Read aiwrap-store.json
  ↓
Has lastSession? → Yes: Restore previous tabs
  ↓ No
Has defaultSite? → Yes: Open that site in a tab
  ↓ No
Show welcome page (prompt user to click bookmark or "+")
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Close last tab | Show welcome page |
| Site fails to load | Show error page inside tab with retry button |
| All sites deleted | Empty bookmark bar, prompt to add sites in settings |
| Too many tabs (memory) | No hard limit for now; can add warning later |
| Window resize | All WebContentsView bounds recalculated via `resizeAllViews()` |
| Drag reorder bookmarks | Update `order` field and persist immediately |
| Session restore but site deleted | Skip that tab, restore remaining |
| App crashes during save | Read with fallback to defaults |

## What's NOT Changing
- `lib/config.js` site defaults and storage abstraction (adapted for Electron-only)
- Dark theme color scheme
- Settings page card grid layout and functionality
- Icon assets
