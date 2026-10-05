<div align="center">

<img src="docs/assets/brand/logo-mark.svg" width="84" alt="STEM Visual Explorer logo" />

# STEM Visual Explorer

**面向数学与物理的概念驱动 STEM 学习工作台。**

**Status:** 🟡 Alpha (0.4.0-alpha.3)

[Web 应用](https://styayur.github.io/stem-visual-explorer/) · [Windows](https://github.com/styayur/stem-visual-explorer/releases/latest) · [文档](docs/architecture.md) · [Releases](https://github.com/styayur/stem-visual-explorer/releases) · [Discussions](https://github.com/styayur/stem-visual-explorer/discussions)

[中文](README.zh-CN.md) · [English](README.md)

[![release](https://img.shields.io/github/v/release/styayur/stem-visual-explorer)](https://github.com/styayur/stem-visual-explorer/releases/latest)
[![CI](https://github.com/styayur/stem-visual-explorer/actions/workflows/ci.yml/badge.svg)](https://github.com/styayur/stem-visual-explorer/actions/workflows/ci.yml)
[![license: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)]()
[![Rust](https://img.shields.io/badge/Rust-black?logo=rust&logoColor=white)]()
[![Tauri](https://img.shields.io/badge/Tauri-24C8D8?logo=tauri&logoColor=white)]()

![STEM Visual Explorer 中文界面](docs/screenshot-zh.png)

</div>

## 查询解析器 v2（0.4.0-alpha.3）

独立查询层提供有限拼写纠错、符号与公式识别、确定性评分和歧义／拒答，不扩充规范本体。整体精确率为 88.64%，开发集 95.15%、holdout 69.09%；泛化差距仍明确保留，本次为草稿成熟度升级。参见[架构](docs/query-resolver-v2.md)与[实测限制](docs/audits/v0.4-query-resolver-report.md)。

## 概念工作台（0.4.0-alpha.2）

打开概念后，可在概览、学习、可视化、资源与概念图之间保持同一上下文。Inspector、概念轨迹和 Ctrl/Cmd+K 命令面板将现有三门课程与索引资源、教材引用连接起来。[架构与快捷键](docs/workbench-architecture.md)。

## 快速开始

**原生可视化学习：** 搜索简谐振动、椭圆或行列式，点击“可视化学习”进入概念工作台，再通过学习与可视化工作区打开课程。三套课程提供英／简／繁内容、参数调整、逐步推演与减少动态效果；教材仅显示章节元数据与外部链接。参见[课程与扩展指南](docs/visual-learning.md)。

**直接使用网页版：** 打开[在线应用](https://styayur.github.io/stem-visual-explorer/)，输入 `梯度`、`curl` 或 `standing wave`。不需要注册、API Key 或部署服务。

**使用 Windows 桌面版：** 在 [Releases](https://github.com/styayur/stem-visual-explorer/releases/latest) 下载 Windows x64 安装程序，或下载 `windows-x64.zip`，解压后运行 `stem-visual-explorer.exe`。桌面版需要 Microsoft Edge WebView2 Runtime；安装程序会按配置处理缺失的运行时，便携版需使用系统已有的运行时。发布文件附带 `SHA256SUMS.txt` 校验值。

检索升级：**v0.3** 使用 490 个本科 STEM 概念、分层检索和语义索引，修复中文漏召回及缩写 substring 误召回。真实 before/after 见 [v0.3 检查报告](docs/audits/v0.3-report.md)。

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

## 产品边界与 Provider 扩展

**核心领域是 STEM 资源发现、比较和学习上下文，不是通用浏览器。** 完整边界见 [docs/architecture.md](docs/architecture.md)。 WebViewer 只支持查看当前选中的外部资源，不扩展为标签页浏览器或绕过 CSP/X-Frame-Options 的代理。新增 Provider 必须遵守 [Provider extension contract](docs/provider-extension.md)，并通过 registry metadata、host policy、PreviewCapability 和 parser fixture 契约测试。

## 跨语言概念归一化

`src/lib/concepts.json` 是中、英、繁体术语与翻译词典的唯一来源，包含 490 个本科概念、稳定 ID、标签、同义词、带匹配模式的别名、学科、层级和相关/先修关系。

默认搜索按概念组 AND、组内同义变体 OR 检索。Direct/Equivalent 可以召回，Related/Prerequisite 只在显式“扩展相关概念”时参与，并标注为 Related、降低排序。ASCII 缩写按词边界匹配：`FT` 不会命中 `left`，`rot` 不会命中 `prototype`。URL 不参与普通全文搜索。

排序分别记录标题、语义概念、标签和描述证据，可在 benchmark 或开发模式查看解释。页面显示双语概念 chip、先修/相关链接、零结果原因；Web 还显示静态索引日期和超过 30 天的过期提示，不冒充实时搜索。桌面缓存版本升级到 2，浏览器 v1 索引缓存自动失效；收藏、历史和工作区保持兼容。

共有 465 个 benchmark case、1,395 个三语查询、36 组人工直接相关标题规则及 41 个 TS/Rust 共享 golden case。周更工作流必须通过来源健康、检索质量、构建、浏览器和 Rust 回归，才创建索引更新 PR。详见 [检索架构与验证方法](docs/retrieval.md)。


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

工作台已通过检索、课程、会话与安全测试，以及 38 项 Rust 测试、23 组浏览器回归和 7 组实际 Windows WebView2 回归；完整命令与指标见[工作台验证报告](docs/audits/v0.4-workbench-report.md)。桌面回归使用独立应用标识和测试数据，运行 `npm run test:desktop` 前请按[环境准备说明](docs/functional-audit.md)操作。外部网页和翻译响应在交互测试中使用固定数据；来源联网检查独立执行。

推送 `main` 会运行 CI 并部署 GitHub Pages；推送版本标签会构建 Windows 便携包和 NSIS 安装包，产物位于 GitHub Actions 的 `windows-release` artifact，经检查后附加到 Release。

## 数据与隐私

无需账号，无遥测、分析或云端数据库。收藏、历史、设置和索引缓存在本机保存。桌面搜索直接访问来源网站；启用机器翻译后，待翻译文本会发送给 MyMemory。打开外部翻译页面或设置自定义代理时，也会向相应服务发送请求。

应用只接受 HTTP/HTTPS 外部地址。独立外部网页没有应用 IPC 权限；主窗口和工作区使用限定的 Tauri 能力。

## 路线图

### 当前

- 支持概念搜索、能力感知预览与跨语言概念归一化。
- 双语文档与网页版静态索引。

### 下一步

- 增加更多 Provider 适配器，解析器配套 fixture 测试。
- 提升解析器稳定性与索引自动更新。

### 未来

- 用户自建收藏与更丰富的可视化界面。

### 暂不计划

- 成为通用浏览器；预览始终是辅助能力。
- 绕过来源网站访问限制或中转需登录的内容。

## 社区与治理

- GitHub Issues：可复现 bug 与范围明确的功能请求。
- Discord：[加入社区](https://discord.gg/wA2xy6VPK)，用于快速交流、设计讨论和早期反馈；不是 SLA 支持渠道。
- Security：按 [SECURITY.md](SECURITY.md) 私下报告，不要开公开 Issue。
- Contributing：开发、Provider 契约与架构边界见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- Release：使用 `vX.Y.Z` tag；Windows 发布包含便携包、安装包和 SHA-256 清单，维护者负责发布。

## 许可证

[GNU Affero General Public License v3.0](LICENSE)。Copyright © 2026 Yur Stya.
