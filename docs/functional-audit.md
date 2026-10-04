# 功能检查与修复记录

本轮检查覆盖浏览器前端、静态索引搜索、七个 Rust 来源适配器、收藏与历史、设置、预览、工作区、翻译，以及实际 Windows WebView2 桌面窗口。

## 2026-10-04 v0.3 检索升级

新的实现、真实检索结果、来源质量和最终命令状态统一记录在 [v0.3 审计报告](audits/v0.3-report.md)，架构与复现命令见 [retrieval.md](retrieval.md)。本次保留了修改前全部检查与 v0.2 搜索原始结果。测试中的 iframe/翻译响应仍是 fixture；真实来源抓取独立记录在 `artifacts/provider-probe.json`，不能混同。

升级修复概念覆盖不足、词典双来源、related 混入默认候选、缩写 substring、多概念 OR、混合字段评分、URL 召回、元数据缺口、快照无刷新门禁和缺少检索指标等问题。新增共享 golden parity、缓存迁移、精确字段解释、零结果分层诊断及显式 related control。原有安全/产品边界不变。初始 precision hints 的三项标注错误及修订理由单独公开在 [relevance review](audits/v0.3-relevance-review.md)。

以下是历史版本检查记录，不代表此次重新执行了历史桌面 GUI 审计。

## 2026-09-30 三项升级

- **PreviewCapability**：七个来源在共享策略文件中声明 `Embed / NativeCard / ExternalOnly`，未知来源默认为卡片。预览、Quick Look、工作区共用资源卡片组件；卡片显示摘要、类型、标签和离线概念关系。已验证卡片来源不发起 iframe 请求，即使配置翻译代理也不会嵌入代理页面。
- **独立 WebViewer**：结果、工作区和外部页面弹窗复用受控窗口创建流程，支持多个窗口。HTTP/HTTPS 校验覆盖初始地址、后续导航和弹窗。增加窗口标签级 IPC 拒绝，实际 WebView2 测试确认外部页面和导航到本地应用地址的 WebViewer 均不能调用主应用命令。
- **跨语言概念归一化**：TypeScript 与 Rust 共享概念词典；最长词匹配、五档权重、按概念去重、一层相关扩展和确定性排序均有测试。先修概念仅用于卡片，精确短语及来源/类型语法保持原有语义。

最新结果：**36 项 JavaScript 测试、34 项 Rust 测试、22 组浏览器回归、6 组实际 WebView2 桌面回归通过**；Pages 子路径构建与冒烟测试通过，Rust 全量/纯逻辑 clippy 通过。桌面回归新增工作区多窗口、元数据持久化、复制按钮、工具栏置顶、外部弹窗和本地导航后的 IPC 拒绝。复制测试注入剪贴板写入桩；系统默认浏览器的实际唤起仍不在自动化范围内。

以下保留上一轮 v0.1.1 修复记录与验证范围。

## 已修复

| 模块 | 修复与完善 |
| --- | --- |
| 搜索 | 防止旧请求覆盖新请求；清空查询会使未完成请求失效；搜索错误显示重试入口；筛选计数和选中项与实际可见结果保持一致。 |
| 查询与排序 | 多词英文概念能反向展开中文；补充常用繁体术语；只输入来源或类型时可浏览索引；引号内空白规范化；查询语法不再影响精确标题加分；排序增加最终稳定排序键。 |
| 来源 | 从后端元数据生成来源列表；复选框不再误触发来源筛选；启用状态改变后重搜；按来源显示失败信息和筛选后的数量。 |
| 键盘与菜单 | 搜索建议支持方向键与 Enter；兼容输入法组合输入；跨页面的搜索焦点快捷键可用；设置/收藏页不会操作隐藏的搜索结果；关闭快捷键只在 Quick Look 打开时拦截；菜单放到独立浮层。 |
| 收藏与历史 | 收藏写入串行处理；历史去重并限制为 200 条；设置页新增历史查看、重搜和清空；收藏筛选在来源被清空后恢复；旧设置和无效本地数据不会直接导致页面崩溃。 |
| 预览与工作区 | 小屏显示底部预览且只挂载一个预览；修复窄屏工具栏重叠；工作区有选中反馈和四页上限；笔记按页面组合分别保存；返回搜索不会再次进入工作区；补齐桌面工作区权限与窗口销毁后的载荷清理。 |
| 翻译 | 默认预览不会偷偷翻译；切换结果/语言不会显示上一条译文；重复请求合并；取消时移除排队请求；请求具有超时；按 UTF-8 字节限制分块；服务错误不会当成译文；繁体目标使用繁体术语；翻译代理仅允许 HTTP/HTTPS。 |
| 桌面网页工具栏 | 独立脚本可测试；长文本完整分块；翻译中可取消并还原；避免翻译代码和可编辑区域；修复异步复制失败时的后备路径；外部打开再次校验 URL。 |
| 桌面窗口与开发服务 | 创建工作区和网页窗口的命令改为异步，修复 Windows WebView2 同步创建窗口死锁；开发服务器忽略本地输出和 WebView2 配置目录，避免文件锁导致监听崩溃。 |
| 缓存 | 桌面索引写入磁盘；启动后可复用；自动刷新失败保留旧索引；手动刷新失败返回错误；清理同时处理内存和磁盘；浏览器缓存损坏后重新获取；缓存清理不依赖服务器在线；缓存清理期间的旧请求不会重新写回浏览器缓存。 |
| 设置与错误 | 保存按顺序执行；保存失败显示错误并回退设置；桌面设置采用原子文件替换，磁盘保存失败不污染内存设置；移除没有实现的 mock mode 开关。 |
| 开发依赖 | 升级 Vite 8.3.1 和 React 插件 6.1.1，安装结果报告 0 项依赖漏洞；Node.js 要求提升至 22.12+。 |

## 验证方式

```bash
npm ci
npx playwright install chromium
npm test
npm run build
npm run test:web
npm run test:web:build

cd src-tauri
cargo fmt --check
cargo test --no-default-features
cargo clippy --no-default-features --all-targets -- -D warnings
cargo run --no-default-features --example probe
```

- JavaScript 单元测试：30 项，覆盖查询、排序、术语、URL、代理、UTF-8 分块及翻译服务错误。
- Rust 测试：28 项，覆盖全部来源解析器，以及查询、排序、缓存、数据库、设置写入失败和来源任务崩溃隔离。
- Playwright 回归：21 组场景，包含真实界面交互、收藏持久化、剪贴板、窗口、预览、四窗格、笔记、主题、语言、历史、竞态、缓存损坏、离线索引、存储失败、翻译取消和桌面工具栏脚本。
- Pages 生产构建测试：在实际 `/stem-visual-explorer/` 路径验证资源、搜索和工作区路由。
- Windows 桌面回归：独立测试配置下的实际 WebView2 共 6 组通过，覆盖 Rust IPC、真实搜索、SQLite 收藏与历史、工作区权限与笔记、返回搜索、窗口载荷清理、网页前进/后退/刷新、翻译还原、置顶/关闭、外部网页 IPC 拒绝、URL 校验与缓存清理。
- 完整 Tauri `cargo check`、`cargo clippy -- -D warnings` 和调试应用编译通过；桌面前端与 Pages 前端构建均通过。
- 真实来源探测：11 个中英文查询执行成功；七个来源均成功建立索引并在查询集合中返回结果。索引条目数分别为 Math Insight 447、Falstad 85、PhET 120、BetterExplained 144、Physics Fundamentals 134、PhysicStuff 52、猫田の物理 93。

浏览器自动化使用真实应用和项目静态索引；第三方页面与翻译返回值使用固定测试响应，避免上游网站和翻译额度影响回归稳定性。来源的实时可用性由独立联网探测验证。截图位于被 Git 忽略的 `dist-release/audit-desktop.png`、`audit-mobile.png` 和 `audit-native.png`。

CI 已加入浏览器回归、Pages 构建测试及 Windows 桌面编译任务。新增 CI 配置需在仓库工作流运行后才有远端验证结果。

## 桌面回归复现与验证范围

- 本机 MSVC 缺少 `link.exe`，因此使用已安装的 GNU Rust 工具链，配合本地便携 LLVM MinGW 资源工具完成编译；没有修改系统工具链。便携工具与测试浏览器数据位于被忽略的 `dist-release/`。
- `npm run test:desktop` 连接 `http://127.0.0.1:9223`（可用 `SVE_DESKTOP_CDP` 覆盖），只允许应用标识 `org.stemvisualexplorer.audit20260929`，以避免修改正常用户的数据库和设置。测试完成会关闭测试应用。
- 先启动 `npm run dev`，在构建测试桌面应用的 PowerShell 中设置 `$env:TAURI_CONFIG = '{"identifier":"org.stemvisualexplorer.audit20260929"}'`，然后运行 `cargo build`。启动生成的应用前设置 `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9223 --remote-debugging-address=127.0.0.1'`，以及独立的 `$env:WEBVIEW2_USER_DATA_FOLDER` 测试目录。此配置仅用于本机测试。
- 系统默认浏览器的实际唤起没有纳入自动化；相关 URL 校验已验证。翻译回归使用固定服务响应，不代表第三方服务始终可用。
- 网站的嵌入限制、浏览器多弹窗策略、MyMemory 网络/额度限制依然由第三方控制；没有承诺所有外部页面都能嵌入或翻译。

依赖迁移参考：[Vite 官方迁移说明](https://vite.dev/guide/migration)。


## v0.3 merge-readiness hygiene

The native audit profile is built on this host with the available MSVC toolchain. The initial cold-cache search exceeded the unchanged desktop test deadline; repeated ontology/field normalization was removed from deterministic index annotation. Shared TS/Rust golden annotations remain exact. The isolated WebView2 desktop suite subsequently passed all six groups, including provider health, persistence and viewer IPC denial. Raw logs/screenshots remain ignored local output; the committed v0.3 report and compact summaries retain the results. Ordinary CI permissions are read-only, and index quality now compares to the PR base/current main snapshot using local Git objects.
