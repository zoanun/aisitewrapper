# AI Site Wrapper v2

[中文说明](README_CN.md)

A browser-like desktop app that aggregates multiple AI chat websites into one window with true multi-tab support.

## Features

- **Multi-tab browsing** — Open multiple AI sites simultaneously, each in its own tab with preserved state
- **Bookmark bar** — Quick-access bar at top for your favorite AI sites
- **Tab bar** — Browser-style tabs with close buttons, scroll arrows for overflow
- **Site picker** — Click "+" to open any enabled site in a new tab
- **Session restore** — Reopens your last tabs automatically on next launch
- **Settings page** — Enable/disable, reorder, edit, delete any site (including built-in ones)
- **Add custom sites** — Add any URL as a bookmark
- **Per-site cache clearing** — Clear cookies/storage for individual sites
- **Persistent login** — Log in once per site, stays logged in across restarts
- **Light theme** — Clean, modern UI inspired by Chrome

## Supported Sites

| Site | URL |
|------|-----|
| DeepSeek | chat.deepseek.com |
| ChatGPT | chatgpt.com |
| Claude | claude.ai |
| Gemini | aistudio.google.com |
| Doubao | doubao.com |
| Qwen | chat.qwen.ai |
| Yuanbao | yuanbao.tencent.com |
| GLM | chatglm.cn |
| Kimi | kimi.moonshot.cn |
| And more... | |

## Install

### Quick Start

```bash
git clone https://github.com/zoanun/aisitewrapper.git
cd aisitewrapper
git checkout v2
npm install
npm start
```

### Build .exe Installer

```bash
# Build installer (outputs to dist/ folder)
npm run build

# Or build portable version (single .exe, no install needed)
npm run build:portable
```

> On Windows, if you see a symlink error during build:
> ```bash
> set CSC_IDENTITY_AUTO_DISCOVERY=false
> npx electron-builder --win --config.win.signAndEditExecutable=false
> ```

After build:
- `dist/AI Site Wrapper Setup x.x.x.exe` — installer
- `dist/win-unpacked/` — portable version

## Usage

1. Launch the app — your default site (or last session) opens automatically
2. **Bookmark bar** (top): Click any bookmark to open it in a new tab
3. **Tab bar**: Click tabs to switch, click x to close
4. **"+" button**: Opens a dropdown to pick from all enabled sites
5. **Scroll arrows** / **mouse wheel**: Navigate when tabs overflow
6. **Gear icon**: Opens settings to manage your sites
7. **Right-click** bookmark: Hide from bar | Right-click tab: Refresh / Close

## Architecture

Built with Electron using `BaseWindow` + multiple `WebContentsView` instances. Each tab runs in its own process, enabling true simultaneous browsing without page reloads on tab switch.

```
BaseWindow
├── UI WebContentsView (bookmark bar + tab bar, 68px)
├── Tab 1 WebContentsView (visible)
├── Tab 2 WebContentsView (hidden)
└── Tab 3 WebContentsView (hidden)
```

## Privacy

AI Site Wrapper does not collect or transmit any personal data. All settings and login sessions are stored locally on your machine. See [PRIVACY.md](PRIVACY.md) for details.

## License

MIT
