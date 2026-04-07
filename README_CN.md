# AI Site Wrapper

将多个 AI 聊天网站聚合到一个窗口中，一键切换，即开即用。

## 功能特性

- 一键打开独立弹窗，集中访问多个 AI 聊天网站
- 悬浮 Tab 栏 — 鼠标移到顶部自动出现，不影响页面布局
- 支持设置默认打开的站点
- 切换站点时显示 Loading 遮罩（按 ESC 可取消）
- 自动检测连接失败，自动跳转错误页面
- 自定义配置：启用/禁用站点、拖拽排序
- 支持添加自定义 AI 站点
- 单站点缓存清理
- 中英文双语错误提示
- 轻量无依赖（Chrome 扩展版）
- 桌面独立应用版（Electron），可打包为 .exe 安装包

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

### 桌面应用（Electron）

独立桌面应用，无需浏览器。

**快速启动：**

```bash
git clone https://github.com/zoanun/aisitewrapper.git
cd aisitewrapper
npm install
npm start
```

**打包 .exe 安装程序：**

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

### Chrome 扩展

#### Chrome 应用商店
*（即将上线）*

#### 手动安装（开发者模式）
1. 克隆本仓库
2. 打开 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」，选择项目文件夹

## 使用方法

1. 点击浏览器工具栏中的 AI Site Wrapper 图标，打开 AI 聚合窗口
2. 将鼠标移到页面顶部，Tab 栏自动滑出
3. 点击任意 Tab 切换 AI 站点
4. 加载中按 ESC 可取消切换，留在当前站点
5. 右键点击 Tab 可隐藏或刷新该站点
6. 点击齿轮图标打开设置页面
7. 在设置页面点击星标可设置默认站点

## 隐私说明

AI Site Wrapper 不收集、不传输任何个人数据，所有设置均存储在本地。详见 [PRIVACY.md](PRIVACY.md)。

## 开源协议

MIT
