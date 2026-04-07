# AI Site Wrapper

[中文说明](README_CN.md)

Aggregate AI chat websites into one window. Switch between multiple AI assistants instantly.

## Features

- One-click access to multiple AI chat sites in a single popup window
- Hover-to-show tab bar — zero impact on page layout
- Set a default site to open on launch
- Loading overlay with spinner when switching sites (press ESC to cancel)
- Auto-detect connection failures with friendly error page
- Configurable: enable/disable sites, drag to reorder
- Add custom AI sites
- Per-site cache clearing
- Chinese + English error messages
- Lightweight, no external dependencies (Chrome extension)
- Desktop app version (Electron) with standalone .exe packaging

## Supported Sites

| Site | URL |
|------|-----|
| DeepSeek | chat.deepseek.com |
| ChatGPT | chatgpt.com |
| Claude | claude.ai |
| Gemini | aistudio.google.com |
| Kimi | kimi.moonshot.cn |
| Doubao (豆包) | doubao.com |
| Qwen (千问) | chat.qwen.ai |
| Yuanbao (元宝) | yuanbao.tencent.com |
| GLM (智谱清言) | chatglm.cn |
| And more... | |

## Install

### Desktop App (Electron)

Standalone desktop app, no browser required.

**Quick Start:**

```bash
git clone https://github.com/zoanun/aisitewrapper.git
cd aisitewrapper
npm install
npm start
```

**Build .exe Installer:**

```bash
# Build installer (outputs to dist/ folder)
npm run build

# Or build portable version (single .exe, no install needed)
npm run build:portable
```

> On Windows, if you see a symlink error during build, run with code signing disabled:
> ```bash
> set CSC_IDENTITY_AUTO_DISCOVERY=false
> npx electron-builder --win --config.win.signAndEditExecutable=false
> ```

After build, you will find:
- `dist/AI Site Wrapper Setup x.x.x.exe` — installer
- `dist/win-unpacked/` — portable version, run `AI Site Wrapper.exe` directly

### Chrome Extension

#### From Chrome Web Store
*(Coming soon)*

#### Manual Install (Developer Mode)
1. Clone this repository
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project folder

## Usage

1. Click the AI Site Wrapper icon in the Chrome toolbar to open the AI hub window
2. Hover near the top edge of the page to reveal the tab bar
3. Click any tab to switch between AI sites
4. Press ESC during loading to cancel and stay on the current site
5. Right-click a tab for options (hide, refresh)
6. Click the gear icon to open settings
7. Set a default site by clicking the star icon in settings

## Privacy

AI Site Wrapper does not collect or transmit any personal data. All settings are stored locally. See [PRIVACY.md](PRIVACY.md) for details.

## License

MIT
