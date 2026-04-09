# AI Site Wrapper v2

将多个 AI 聊天网站聚合到一个桌面应用中，支持真正的多标签页同时浏览。

## 功能特性

- **多标签页浏览** — 同时打开多个 AI 站点，每个标签页独立运行，切换不重新加载
- **书签栏** — 顶部快速访问栏，一键打开常用 AI 站点
- **标签栏** — 浏览器风格标签页，支持关闭、滚动箭头
- **站点选择器** — 点击 "+" 从启用站点列表中选择打开
- **会话恢复** — 关闭应用后，下次启动自动恢复上次打开的标签页
- **设置页面** — 启用/禁用、排序、编辑、删除任何站点（包括内置站点）
- **自定义站点** — 可添加任意 URL 作为书签
- **单站点缓存清理** — 单独清除某个站点的 Cookie/存储
- **登录状态持久化** — 每个站点只需登录一次，重启后保持登录
- **浅色主题** — 简洁明亮的现代 UI

## 内置站点

| 站点 | 网址 |
|------|------|
| DeepSeek | chat.deepseek.com |
| 豆包 | doubao.com |
| 千问 | chat.qwen.ai |
| 元宝 | yuanbao.tencent.com |
| 智谱清言 | chatglm.cn |
| ChatGPT | chatgpt.com |
| Gemini | aistudio.google.com |
| Claude | claude.ai |
| Kimi | kimi.moonshot.cn |
| 更多... | |

## 安装

### 快速启动

```bash
git clone https://github.com/zoanun/aisitewrapper.git
cd aisitewrapper
git checkout v2
npm install
npm start
```

### 打包 .exe 安装程序

```bash
# 打包安装版（输出到 dist/ 目录）
npm run build

# 或打包免安装版（单个 .exe，无需安装）
npm run build:portable
```

> Windows 下如果遇到 symlink 报错，可以禁用代码签名后打包：
> ```bash
> set CSC_IDENTITY_AUTO_DISCOVERY=false
> npx electron-builder --win --config.win.signAndEditExecutable=false
> ```

打包完成后：
- `dist/AI Site Wrapper Setup x.x.x.exe` — 安装版
- `dist/win-unpacked/` — 免安装版，直接运行 `AI Site Wrapper.exe`

## 使用方法

1. 启动应用 — 自动打开默认站点或恢复上次会话
2. **书签栏**（顶部）：点击书签在新标签页中打开
3. **标签栏**：点击标签切换，点击 × 关闭
4. **"+" 按钮**：弹出下拉菜单，选择要打开的站点
5. **滚动箭头** / **鼠标滚轮**：标签页过多时左右滚动
6. **齿轮图标**：打开设置管理站点
7. **右键书签**：隐藏 | **右键标签**：刷新 / 关闭

## 技术架构

基于 Electron，使用 `BaseWindow` + 多个 `WebContentsView` 实例。每个标签页运行在独立进程中，切换时只改变可见性，不重新加载页面。

```
BaseWindow
├── UI WebContentsView（书签栏 + 标签栏，68px）
├── 标签页 1 WebContentsView（可见）
├── 标签页 2 WebContentsView（隐藏）
└── 标签页 3 WebContentsView（隐藏）
```

## 隐私说明

AI Site Wrapper 不收集、不传输任何个人数据，所有设置和登录会话均存储在本地。详见 [PRIVACY.md](PRIVACY.md)。

## 开源协议

MIT
