# AI Site Wrapper

将多个 AI 聊天网站聚合到一个窗口中，一键切换，即开即用。

## 版本

### [v2 — 桌面应用（多标签页浏览器）](https://github.com/zoanun/aisitewrapper/tree/v2)

基于 Electron 的独立桌面应用，支持真正的多标签页同时浏览。每个标签页独立运行，切换不重新加载。包含书签栏、标签栏、会话恢复、浅色主题。

```bash
git clone https://github.com/zoanun/aisitewrapper.git
cd aisitewrapper
git checkout v2
npm install
npm start
```

### [v1 — Chrome 扩展 + Electron 应用](https://github.com/zoanun/aisitewrapper/tree/v1)

初始版本，支持双平台：Chrome 扩展（悬浮标签栏）+ 基础 Electron 桌面应用（单标签切换）。

```bash
git clone https://github.com/zoanun/aisitewrapper.git
cd aisitewrapper
git checkout v1
npm install
npm start        # Electron 应用
# 或以开发者模式加载为 Chrome 扩展
```

## 版本对比

| 功能 | v1 | v2 |
|------|----|----|
| Chrome 扩展 | 支持 | 不支持 |
| Electron 桌面应用 | 支持 | 支持 |
| 多标签页（同时存在） | 不支持（单标签） | 支持 |
| 书签栏 | 无 | 有 |
| 会话恢复 | 无 | 有 |
| 所有站点可删除 | 不支持（内置保护） | 支持 |
| 主题 | 深色 | 浅色 |

## 隐私说明

AI Site Wrapper 不收集、不传输任何个人数据，所有设置均存储在本地。详见 [PRIVACY.md](PRIVACY.md)。

## 开源协议

MIT
