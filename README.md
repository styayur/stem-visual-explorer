# STEM Visual Explorer

数学与物理交互资源的聚合搜索工具。一次搜索七个来源，在同一界面中筛选、预览、收藏，并将最多四个页面放在工作区里对照学习。

[在线使用](https://styayur.github.io/stem-visual-explorer/) · [下载 Windows 版](https://github.com/styayur/stem-visual-explorer/releases/latest) · [English documentation](README.en.md)

![中文界面](docs/screenshot-zh.png)

## 快速开始

**直接使用网页版：** 打开[在线应用](https://styayur.github.io/stem-visual-explorer/)，输入 `梯度`、`curl` 或 `standing wave`。不需要注册、API Key 或部署服务。

**使用 Windows 桌面版：** 在 [Releases](https://github.com/styayur/stem-visual-explorer/releases/latest) 下载 Windows x64 安装程序，或下载 `windows-x64.zip`，解压后运行 `stem-visual-explorer.exe`。桌面版需要 Microsoft Edge WebView2 Runtime；安装程序会按配置处理缺失的运行时，便携版需使用系统已有的运行时。发布文件附带 `SHA256SUMS.txt` 校验值。

当前版本：**v0.2.0**。本次新增 Provider 预览能力、原生资源卡片、受控多窗口 WebViewer，以及离线跨语言概念图与带权查询归一化，详细验证记录见[功能检查报告](docs/functional-audit.md)。

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

## 预览能力与独立 WebViewer

每个 Provider 通过共享的 `src/lib/previewCapabilities.json` 声明预览能力，Rust `SearchProvider` 和浏览器使用同一份策略，来源元数据也返回 `preview_capability`：

| 能力 | 当前来源 | 行为 |
| --- | --- | --- |
| `Embed` | Falstad | 仅匹配已声明来源域名的 HTTP/HTTPS 页面可以加载 iframe；支持切换为资源卡片。 |
| `NativeCard` | Math Insight、PhET、BetterExplained、Physics Fundamentals、PhysicStuff | 直接展示资源卡片，不先请求 iframe。 |
| `ExternalOnly` | 猫田の物理 | 显示资源卡片和独立打开入口，不提供嵌入。 |

未知来源、来源 ID 与网址域名不匹配的资源一律使用卡片。以上是保守的应用策略，不代表所有来源都必然发送禁止嵌入的响应头。卡片包含标题、摘要、类型、标签、相关概念、先修概念和独立窗口/浏览器打开按钮；没有摘要或概念映射时会明确说明。概念关系来自离线词典，不冒充来源作者给出的课程先修要求。

预览、Quick Look 和工作区遵循同一策略。应用不通过代理移除或绕过 CSP / X-Frame-Options，也不会将翻译代理当作 iframe 回退。对于声明为 Embed 后发生策略变化的外站，跨域浏览器无法可靠检测所有拦截，因此保留“显示资源卡片”入口。

桌面 WebViewer 支持 Back、Forward、Reload、Copy URL、Open External、Always on Top、Close；普通结果和工作区都可以打开多个窗口。新窗口及后续导航只允许 HTTP/HTTPS，网页弹出的新页面也通过同一 WebViewer 创建流程。`sve://` 仅用于当前窗口工具栏的有限控制，不用于获取应用数据。外部 WebViewer 不授予应用 IPC；即使导航到应用本地地址，窗口级校验仍拒绝访问主应用命令。

工作区在保存 URL 的同时传递资源元数据，刷新后仍保留摘要和标签。旧版仅含 URL 的工作区链接仍可打开，缺失元数据时显示 URL 卡片。

## 跨语言概念归一化

查询层使用 `src/lib/concepts.json` 中的 STEM 术语词典与概念图，无需 LLM、翻译 API 或网络。每个概念都有稳定的 `id`、英文 `en`、简中 `zh_cn`、繁中 `zh_tw`、同义词 `synonyms`、别名 `aliases`、相关概念 `related` 和先修概念 `prerequisites`。

归一化先按最长术语识别概念，例如 `partial derivative` 作为一个概念处理；中英、繁简和别名均可作为入口，按 `concept_id` 去重，而不是将中文简单翻译为英文。

| 查询变体 | 权重 |
| --- | --- |
| 原始词 `original` | 1.0 |
| 规范名称 `canonical`（英/简/繁） | 0.95 |
| 同义词 `synonym` | 0.9 |
| 别名 `alternate` | 0.75 |
| 一层相关概念 `related` | 0.35 |

同一概念的同一文本只保留最高权重。相关概念只展开一层，不递归；先修概念仅用于资源卡片，不作为同义词扩展。未知词保留原始权重；引号仍要求原始短语匹配，`site:` / `source:` / `type:` 不参与概念展开。

排序保留精确标题优先和交互资源加分，其余标题、标签、摘要匹配使用变体权重。每个字段取最强匹配，避免堆叠别名增加分数；“全部匹配”以直接概念分组计算，相关概念不能冒充直接查询。排序使用来源、标题和结果 ID 作为稳定的同分规则，浏览器与 Rust 实现保持一致。

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

本轮已通过 36 项 JavaScript 测试、34 项 Rust 测试、22 组浏览器回归及 6 组实际 Windows WebView2 回归。桌面回归使用独立应用标识和测试数据，运行 `npm run test:desktop` 前请按[检查报告](docs/functional-audit.md)准备环境。外部网页和翻译响应在交互测试中使用固定数据；来源联网检查独立执行。

推送 `main` 会运行 CI 并部署 GitHub Pages；推送版本标签会构建 Windows 便携包和 NSIS 安装包，产物位于 GitHub Actions 的 `windows-release` artifact，经检查后附加到 Release。

## 数据与隐私

无需账号，无遥测、分析或云端数据库。收藏、历史、设置和索引缓存在本机保存。桌面搜索直接访问来源网站；启用机器翻译后，待翻译文本会发送给 MyMemory。打开外部翻译页面或设置自定义代理时，也会向相应服务发送请求。

应用只接受 HTTP/HTTPS 外部地址。独立外部网页没有应用 IPC 权限；主窗口和工作区使用限定的 Tauri 能力。

## 许可证

[GNU Affero General Public License v3.0](LICENSE)。Copyright © 2026 Yur Stya.
