# AI Site Wrapper

[中文说明](README_CN.md)

Aggregate multiple AI chat websites into one window. Switch between AI assistants instantly.

## Versions

### [v2 — Desktop App (Multi-Tab Browser)](https://github.com/zoanun/aisitewrapper/tree/v2)

A standalone Electron desktop app with browser-like multi-tab support. Open multiple AI sites simultaneously — each tab preserves its own state. Features bookmark bar, tab bar, session restore, and light theme UI.

```bash
git clone https://github.com/zoanun/aisitewrapper.git
cd aisitewrapper
git checkout v2
npm install
npm start
```

### [v1 — Chrome Extension + Electron App](https://github.com/zoanun/aisitewrapper/tree/v1)

The original version with dual-platform support: a Chrome extension with hover-to-show tab bar, plus a basic Electron desktop app with single-tab switching.

```bash
git clone https://github.com/zoanun/aisitewrapper.git
cd aisitewrapper
git checkout v1
npm install
npm start        # Electron app
# Or load as Chrome extension in developer mode
```

## Comparison

| Feature | v1 | v2 |
|---------|----|----|
| Chrome Extension | Yes | No |
| Electron Desktop App | Yes | Yes |
| Multi-tab (simultaneous) | No (single tab) | Yes |
| Bookmark bar | No | Yes |
| Session restore | No | Yes |
| All sites deletable | No (built-in protected) | Yes |
| Theme | Dark | Light |

## Privacy

AI Site Wrapper does not collect or transmit any personal data. All settings are stored locally. See [PRIVACY.md](PRIVACY.md).

## License

MIT
