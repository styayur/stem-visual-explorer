# STEM Visual Explorer

数学与物理交互资源的聚合搜索工具。一次搜索七个来源，在同一界面中筛选、预览、收藏，并将最多四个页面放在工作区里对照学习。

[在线使用](https://styayur.github.io/stem-visual-explorer/) · [下载 Windows 版](https://github.com/styayur/stem-visual-explorer/releases/latest) · [English documentation](README.en.md)

![中文界面](docs/screenshot-zh.png)

## 快速开始

**直接使用网页版：** 打开[在线应用](https://styayur.github.io/stem-visual-explorer/)，输入 `梯度`、`curl` 或 `standing wave`。不需要注册、API Key 或部署服务。

**使用 Windows 桌面版：** 在 [Releases](https://github.com/styayur/stem-visual-explorer/releases/latest) 下载 Windows x64 安装程序，或下载 `windows-x64.zip`，解压后运行 `stem-visual-explorer.exe`。桌面版需要 Microsoft Edge WebView2 Runtime；安装程序会按配置处理缺失的运行时，便携版需使用系统已有的运行时。发布文件附带 `SHA256SUMS.txt` 校验值。

当前版本：**v0.1.1**。本次修复重点包括搜索竞态、缓存恢复、设置保存、翻译取消，以及 Windows 新建窗口死锁，详细验证记录见[功能检查报告](docs/functional-audit.md)。

## 可以做什么

- **统一搜索：** 并发检索已启用的来源，按固定规则排序，支持来源和内容类型筛选。
- **中英查询：** 内置数学、物理术语映射，支持常用繁体查询与多词英文概念。
- **预览与多窗口：** 侧边或底部预览、空格 Quick Look，以及桌面独立网页窗口。
- **学习工作区：** 选择最多四个结果并排浏览；笔记按页面组合分别保存。
- **收藏与历史：** 本地保存收藏，查看、重搜或清空历史；历史去重并保留最近 200 条。
- **翻译：** 支持简体中文、繁体中文、英文界面；可选结果翻译和桌面网页原位翻译。翻译默认关闭，术语优先使用本地词典。
- **个性化：** 深色、浅色、跟随系统主题，预览模式和来源开关。
- **缓存与错误恢复：** 缓存索引、请求超时、失败重试及明确的保存失败提示。

## 来源

| 来源 | 主要内容 |
| --- | --- |
| [Math Insight](https://mathinsight.org/) | 数学文章、交互示例、视频 |
| [Falstad](https://falstad.com/mathphysics.html) | 数学与物理交互模拟 |
| [PhET](https://phet.colorado.edu/) | 科学与数学仿真 |
| [BetterExplained](https://betterexplained.com/) | 直观数学解释与交互文章 |
| [Physics Fundamentals](https://physicsfundamentalsinfo.com/labs/) | 物理实验与模拟 |
| [PhysicStuff](https://physicstuff.com/lab) | 物理交互实验，实验性适配 |
| [猫田の物理](https://maotian.nomaki.jp/) | 物理可视化，实验性适配 |

网页版使用随项目发布的索引快照，目前约 **1,075 条**；桌面版通过 Rust 获取来源索引，并在适用时使用站点原生搜索。桌面索引缓存有效期为七天，自动刷新失败时继续使用可用旧缓存，手动刷新会报告失败。

## 搜索示例

| 输入 | 用法 |
| --- | --- |
| `梯度` / `gradient` | 术语搜索与中英扩展 |
| `"standing wave"` | 短语匹配 |
| `site:falstad wave` | 限定来源 |
| `source:phet` | 浏览指定来源的索引 |
| `type:interactive gradient` | 限定内容类型 |

点击结果打开预览；双击或 `Ctrl/Cmd + Enter` 打开独立窗口。`Ctrl/Cmd + K` 聚焦搜索，方向键选择，空格打开 Quick Look，`Esc` 关闭弹层。各结果旁的工作区按钮可切换选中状态。

## 网页版与桌面版

| 功能 | 网页版 | Windows 桌面版 |
| --- | --- | --- |
| 搜索数据 | 发布时的静态索引 | 来源索引与适用的实时搜索 |
| 收藏、历史 | 浏览器 localStorage | 本机 SQLite |
| 独立页面 | 浏览器标签页，受弹窗策略限制 | WebView2 窗口，支持置顶及工具栏 |
| 工作区 | 浏览器内多窗格 | 独立工作区窗口 |
| 外部网页翻译 | 打开翻译页面或自定义代理 | 可原位翻译、取消和还原 |
| 离线搜索 | 已缓存的索引可用 | 已缓存的索引可用 |

第三方网站可通过 CSP 或 X-Frame-Options 禁止嵌入，遇到这种情况可打开独立窗口或系统浏览器。离线索引不等于外部页面可以离线浏览；网页版也不是完整离线 PWA。MyMemory 翻译需要联网，受服务额度和可用性限制。

## 本地开发

技术栈：React 18、TypeScript、Vite 8、Tailwind CSS、Zustand、Tauri 2、Rust、SQLite。

要求：**Node.js 22.12+**、npm；桌面开发另需 Rust、WebView2 及 Windows C++ 构建工具链。通常可使用 Visual Studio C++ Build Tools 与 Windows SDK；GNU 工具链需配套 MinGW 资源工具。

```bash
npm ci
npm run dev             # 前端开发服务，端口 1420
npm run tauri dev       # 桌面开发
npm run build           # 桌面前端构建
npm run build:web       # GitHub Pages 子路径构建
npm run tauri build     # 桌面应用和安装包
```

### 验证

```bash
npm test
npx playwright install chromium
npm run test:web
npm run test:web:build

cd src-tauri
cargo fmt --check
cargo test --no-default-features
cargo clippy --no-default-features --all-targets -- -D warnings
cargo check --locked
cargo run --no-default-features --example probe
```

本轮已通过 30 项 JavaScript 测试、28 项 Rust 测试、21 组浏览器回归及 6 组实际 Windows WebView2 回归。桌面回归使用独立应用标识和测试数据，运行 `npm run test:desktop` 前请按[检查报告](docs/functional-audit.md)准备环境。外部网页和翻译响应在交互测试中使用固定数据；来源联网检查独立执行。

推送 `main` 会运行 CI 并部署 GitHub Pages；推送版本标签会构建 Windows 便携包和 NSIS 安装包，产物位于 GitHub Actions 的 `windows-release` artifact，经检查后附加到 Release。

## 数据与隐私

无需账号，无遥测、分析或云端数据库。收藏、历史、设置和索引缓存在本机保存。桌面搜索直接访问来源网站；启用机器翻译后，待翻译文本会发送给 MyMemory。打开外部翻译页面或设置自定义代理时，也会向相应服务发送请求。

应用只接受 HTTP/HTTPS 外部地址。独立外部网页没有应用 IPC 权限；主窗口和工作区使用限定的 Tauri 能力。

## 许可证

[GNU Affero General Public License v3.0](LICENSE)。Copyright © 2026 Yur Stya.
