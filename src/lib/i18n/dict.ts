// UI translations. English is the source of truth; other locales fall back to
// it per-key, so partially translated locales are safe.
import type { UiLocale } from "../types";

export type Dict = Record<string, string>;

const en: Dict = {
  "app.subtitle": "Visual search for mathematics and physics.",
  "nav.search": "Search",
  "nav.favorites": "Favorites",
  "nav.settings": "Settings",
  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.tooltip": "Theme: {theme}",

  "search.placeholder": "Search math & physics visually — try curl, 旋度, standing wave…",
  "search.expanded": "expanded",

  "filter.all": "All",
  "filter.count": "{n} results",
  "type.article": "ARTICLE",
  "type.interactive": "INTERACTIVE",
  "type.simulation": "SIMULATION",
  "type.applet": "APPLET",
  "type.experiment": "EXPERIMENT",
  "type.visualization": "VISUALIZATION",
  "type.video": "VIDEO",
  "type.unknown": "UNKNOWN",

  "sources.all": "All sources",
  "cat.math": "Mathematics",
  "cat.mathphys": "Mathematics & Physics",
  "cat.phys": "Physics",

  "results.searching": "Searching across sources…",
  "results.filteredOut": "No results match the current filters.",
  "results.explore": "Explore visually",
  "results.emptyHint":
    "Search mathematics and physics resources from multiple interactive sites.",
  "results.noResults": "No results for that query. Try one of the suggestions below.",

  "row.favorite": "Add favorite",
  "row.unfavorite": "Remove favorite",
  "row.workspace": "Add to workspace",
  "row.openWindow": "Open in new window",
  "ctx.open": "Open",
  "ctx.openWindow": "Open in New Window",
  "ctx.openBrowser": "Open in System Browser",
  "ctx.copyUrl": "Copy URL",
  "ctx.favorite": "Favorite",
  "ctx.unfavorite": "Remove Favorite",

  "preview.empty": "Select a result to preview it here.",
  "preview.reload": "Reload preview",
  "preview.copy": "Copy URL",
  "preview.browser": "Open in system browser",
  "preview.embedNote":
    "Some sites block embedded previews (X-Frame-Options/CSP). If the page does not load, open it in a new window or the system browser.",
  "preview.viewOriginal": "Original",
  "preview.viewTranslated": "Translated",
  "preview.translatePage": "Translate page",
  "preview.openTranslated": "Open translated page",
  "preview.translating": "Translating…",
  "preview.translateFailed": "Translation unavailable — showing the original page.",

  "quicklook.openWindow": "Open in new window",
  "quicklook.browser": "Open in system browser",
  "quicklook.close": "Close",

  "workspace.title": "Workspace",
  "workspace.panes": "{n} panes",
  "workspace.reloadAll": "Reload all",
  "workspace.openAll": "Open all externally",
  "workspace.newSearch": "New search",
  "workspace.empty": "No items. Select results and choose “Open Workspace”.",
  "workspace.notes": "Notes for this workspace…",

  "fav.searchPlaceholder": "Search favorites…",
  "fav.allSources": "All sources",
  "fav.saved": "{n} saved",
  "fav.empty": "No favorites yet. Use the star on a result or press Ctrl+D.",

  "settings.title": "Settings",
  "settings.appearance": "Appearance",
  "settings.theme": "Theme",
  "settings.previewMode": "Preview mode",
  "settings.mockMode": "Mock mode (dev only)",
  "settings.sources": "Sources",
  "settings.sourcesHint":
    "Enable or disable individual providers, refresh their local indexes and clear the on-disk cache. Cached indexes older than 7 days are refreshed automatically in the background.",
  "settings.indexed": "Indexed",
  "settings.lastUpdated": "Last updated",
  "settings.never": "never",
  "settings.refreshIndex": "Refresh index",
  "settings.clearCache": "Clear cache",
  "settings.cacheNote": "Cached indexes are stored locally only.",
  "settings.about": "About",
  "settings.aboutText":
    "STEM Visual Explorer is a deterministic local search client. It performs no AI ranking, requires no account, sends no telemetry and never talks to a cloud database. Network requests go directly to the source websites you search.",
  "settings.license": "Licensed under the GNU Affero General Public License v3.0.",

  "settings.translation": "Language & translation",
  "settings.uiLanguage": "Interface language",
  "settings.targetLanguage": "Translate into",
  "settings.translateResults": "Translate result titles & descriptions",
  "settings.translateResultsHint":
    "Uses a free machine-translation service (MyMemory) with an offline STEM glossary fallback. Cached locally.",
  "settings.pageProxy": "Custom page-translation proxy",
  "settings.pageProxyHint":
    "Optional. Use {url} and {lang} placeholders, e.g. https://your-proxy/?url={url}&lang={lang}. When set, the preview can embed translated pages directly.",
  "settings.engineNote":
    "Translations are produced by the third-party MyMemory API and require network access. Stem-term glosses come from the built-in offline glossary.",

  "common.original": "Original",
  "common.translated": "Translated",
  "common.translating": "Translating…",
  "common.retry": "Retry",
};

const zhCN: Dict = {
  "app.subtitle": "数学与物理可视化搜索。",
  "nav.search": "搜索",
  "nav.favorites": "收藏",
  "nav.settings": "设置",
  "theme.system": "跟随系统",
  "theme.light": "浅色",
  "theme.dark": "深色",
  "theme.tooltip": "主题：{theme}",

  "search.placeholder": "搜索数学与物理可视化资源 —— 试试 curl、旋度、驻波…",
  "search.expanded": "已扩展",

  "filter.all": "全部",
  "filter.count": "{n} 条结果",
  "type.article": "文章",
  "type.interactive": "互动",
  "type.simulation": "模拟",
  "type.applet": "小程序",
  "type.experiment": "实验",
  "type.visualization": "可视化",
  "type.video": "视频",
  "type.unknown": "未知",

  "sources.all": "全部来源",
  "cat.math": "数学",
  "cat.mathphys": "数学与物理",
  "cat.phys": "物理",

  "results.searching": "正在并发搜索各来源…",
  "results.filteredOut": "当前筛选条件下没有结果。",
  "results.explore": "开始可视化探索",
  "results.emptyHint": "同时检索多个数学与物理互动网站资源。",
  "results.noResults": "没有找到相关结果，试试下面的建议关键词。",

  "row.favorite": "加入收藏",
  "row.unfavorite": "取消收藏",
  "row.workspace": "加入工作区",
  "row.openWindow": "在新窗口打开",
  "ctx.open": "打开",
  "ctx.openWindow": "在新窗口打开",
  "ctx.openBrowser": "用系统浏览器打开",
  "ctx.copyUrl": "复制链接",
  "ctx.favorite": "收藏",
  "ctx.unfavorite": "取消收藏",

  "preview.empty": "选择一条结果即可在此预览。",
  "preview.reload": "重新加载预览",
  "preview.copy": "复制链接",
  "preview.browser": "用系统浏览器打开",
  "preview.embedNote":
    "部分网站禁止嵌入预览（X-Frame-Options/CSP）。若页面无法加载，请在新窗口或系统浏览器中打开。",
  "preview.viewOriginal": "原文",
  "preview.viewTranslated": "译文",
  "preview.translatePage": "翻译此页",
  "preview.openTranslated": "打开翻译版页面",
  "preview.translating": "翻译中…",
  "preview.translateFailed": "翻译服务不可用，已显示原文。",

  "quicklook.openWindow": "在新窗口打开",
  "quicklook.browser": "用系统浏览器打开",
  "quicklook.close": "关闭",

  "workspace.title": "工作区",
  "workspace.panes": "{n} 个面板",
  "workspace.reloadAll": "全部重载",
  "workspace.openAll": "全部用外部浏览器打开",
  "workspace.newSearch": "新搜索",
  "workspace.empty": "暂无内容。请选择结果后点击「打开工作区」。",
  "workspace.notes": "在这里记录工作区笔记…",

  "fav.searchPlaceholder": "搜索收藏…",
  "fav.allSources": "全部来源",
  "fav.saved": "已收藏 {n} 条",
  "fav.empty": "还没有收藏。点击结果上的星标，或按 Ctrl+D。",

  "settings.title": "设置",
  "settings.appearance": "外观",
  "settings.theme": "主题",
  "settings.previewMode": "预览模式",
  "settings.mockMode": "模拟模式（仅开发）",
  "settings.sources": "来源",
  "settings.sourcesHint":
    "启用或停用各个来源、刷新本地索引、清除磁盘缓存。超过 7 天的缓存会在后台自动刷新。",
  "settings.indexed": "已索引",
  "settings.lastUpdated": "最近更新",
  "settings.never": "从未",
  "settings.refreshIndex": "刷新索引",
  "settings.clearCache": "清除缓存",
  "settings.cacheNote": "索引缓存仅保存在本地。",
  "settings.about": "关于",
  "settings.aboutText":
    "STEM Visual Explorer 是一个确定性的本地搜索客户端：不做 AI 排序、无需登录、不上报遥测、也不使用云数据库。网络请求直接发往你搜索的来源网站。",
  "settings.license": "本项目基于 GNU Affero 通用公共许可证 v3.0 发布。",

  "settings.translation": "语言与翻译",
  "settings.uiLanguage": "界面语言",
  "settings.targetLanguage": "翻译为",
  "settings.translateResults": "翻译结果标题与摘要",
  "settings.translateResultsHint":
    "使用免费机器翻译服务（MyMemory），并以内置 STEM 术语表作为离线兜底，结果会本地缓存。",
  "settings.pageProxy": "自定义网页翻译代理",
  "settings.pageProxyHint":
    "可选。支持 {url} 与 {lang} 占位符，例如 https://your-proxy/?url={url}&lang={lang}。设置后预览可直接内嵌翻译后的页面。",
  "settings.engineNote":
    "翻译由第三方 MyMemory API 提供，需要联网；专业术语来自内置离线词表。",

  "common.original": "原文",
  "common.translated": "译文",
  "common.translating": "翻译中…",
  "common.retry": "重试",
};

const zhTW: Dict = {
  "app.subtitle": "數學與物理視覺化搜尋。",
  "nav.search": "搜尋",
  "nav.favorites": "收藏",
  "nav.settings": "設定",
  "theme.system": "跟隨系統",
  "theme.light": "淺色",
  "theme.dark": "深色",
  "theme.tooltip": "主題：{theme}",

  "search.placeholder": "搜尋數學與物理視覺化資源 —— 試試 curl、旋度、駐波…",
  "search.expanded": "已擴展",

  "filter.all": "全部",
  "filter.count": "{n} 筆結果",
  "type.article": "文章",
  "type.interactive": "互動",
  "type.simulation": "模擬",
  "type.applet": "小程式",
  "type.experiment": "實驗",
  "type.visualization": "視覺化",
  "type.video": "影片",
  "type.unknown": "未知",

  "sources.all": "全部來源",
  "cat.math": "數學",
  "cat.mathphys": "數學與物理",
  "cat.phys": "物理",

  "results.searching": "正在同時搜尋各來源…",
  "results.filteredOut": "目前篩選條件下沒有結果。",
  "results.explore": "開始視覺化探索",
  "results.emptyHint": "同時檢索多個數學與物理互動網站資源。",
  "results.noResults": "找不到相關結果，試試下面的建議關鍵字。",

  "row.favorite": "加入收藏",
  "row.unfavorite": "取消收藏",
  "row.workspace": "加入工作區",
  "row.openWindow": "在新視窗開啟",
  "ctx.open": "開啟",
  "ctx.openWindow": "在新視窗開啟",
  "ctx.openBrowser": "用系統瀏覽器開啟",
  "ctx.copyUrl": "複製連結",
  "ctx.favorite": "收藏",
  "ctx.unfavorite": "取消收藏",

  "preview.empty": "選擇一筆結果即可在此預覽。",
  "preview.reload": "重新載入預覽",
  "preview.copy": "複製連結",
  "preview.browser": "用系統瀏覽器開啟",
  "preview.embedNote":
    "部分網站禁止嵌入預覽（X-Frame-Options/CSP）。若頁面無法載入，請在新視窗或系統瀏覽器開啟。",
  "preview.viewOriginal": "原文",
  "preview.viewTranslated": "譯文",
  "preview.translatePage": "翻譯此頁",
  "preview.openTranslated": "開啟翻譯版頁面",
  "preview.translating": "翻譯中…",
  "preview.translateFailed": "翻譯服務無法使用，已顯示原文。",

  "quicklook.openWindow": "在新視窗開啟",
  "quicklook.browser": "用系統瀏覽器開啟",
  "quicklook.close": "關閉",

  "workspace.title": "工作區",
  "workspace.panes": "{n} 個面板",
  "workspace.reloadAll": "全部重新載入",
  "workspace.openAll": "全部用外部瀏覽器開啟",
  "workspace.newSearch": "新搜尋",
  "workspace.empty": "尚無內容。請選擇結果後點選「開啟工作區」。",
  "workspace.notes": "在這裡記錄工作區筆記…",

  "fav.searchPlaceholder": "搜尋收藏…",
  "fav.allSources": "全部來源",
  "fav.saved": "已收藏 {n} 筆",
  "fav.empty": "還沒有收藏。點擊結果上的星號，或按 Ctrl+D。",

  "settings.title": "設定",
  "settings.appearance": "外觀",
  "settings.theme": "主題",
  "settings.previewMode": "預覽模式",
  "settings.mockMode": "模擬模式（僅開發）",
  "settings.sources": "來源",
  "settings.sourcesHint":
    "啟用或停用各來源、重新整理本機索引、清除磁碟快取。超過 7 天的快取會在背景自動重新整理。",
  "settings.indexed": "已索引",
  "settings.lastUpdated": "最近更新",
  "settings.never": "從未",
  "settings.refreshIndex": "重新整理索引",
  "settings.clearCache": "清除快取",
  "settings.cacheNote": "索引快取僅保存在本機。",
  "settings.about": "關於",
  "settings.aboutText":
    "STEM Visual Explorer 是確定性的本機搜尋客戶端：不做 AI 排序、無需登入、不回傳遙測、也不使用雲端資料庫。網路請求直接送往你搜尋的來源網站。",
  "settings.license": "本專案採用 GNU Affero 通用公共授權條款 v3.0 發布。",

  "settings.translation": "語言與翻譯",
  "settings.uiLanguage": "介面語言",
  "settings.targetLanguage": "翻譯為",
  "settings.translateResults": "翻譯結果標題與摘要",
  "settings.translateResultsHint":
    "使用免費機器翻譯服務（MyMemory），並以內建 STEM 詞彙表作為離線備援，結果會快取於本機。",
  "settings.pageProxy": "自訂網頁翻譯代理",
  "settings.pageProxyHint":
    "選填。支援 {url} 與 {lang} 佔位符，例如 https://your-proxy/?url={url}&lang={lang}。設定後預覽可直接嵌入翻譯後的頁面。",
  "settings.engineNote":
    "翻譯由第三方 MyMemory API 提供，需要網路連線；專業術語來自內建離線詞彙表。",

  "common.original": "原文",
  "common.translated": "譯文",
  "common.translating": "翻譯中…",
  "common.retry": "重試",
};

export const DICTS: Record<UiLocale, Dict> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

Object.assign(en, {
  "common.close": "Dismiss", "cat.other": "Other sources", "history.title": "Search history",
  "history.clear": "Clear history", "history.empty": "No search history yet.",
  "settings.refreshed": "Index refreshed.", "settings.cleared": "Index cache cleared.",
  "row.removeWorkspace": "Remove from workspace", "workspace.limit": "Maximum four pages",
  "workspace.select": "Select up to four results to build a workspace",
  "preview.mode.side": "Side", "preview.mode.inline": "Inline", "preview.mode.off": "Off",
});
Object.assign(zhCN, {
  "common.close": "关闭提示", "cat.other": "其他来源", "history.title": "搜索历史",
  "history.clear": "清空历史", "history.empty": "暂无搜索历史。",
  "settings.refreshed": "索引已刷新。", "settings.cleared": "索引缓存已清除。",
  "row.removeWorkspace": "从工作区移除", "workspace.limit": "最多选择四个页面",
  "workspace.select": "选择最多四条结果创建工作区",
  "preview.mode.side": "分栏", "preview.mode.inline": "底部", "preview.mode.off": "关闭",
});
Object.assign(zhTW, {
  "common.close": "關閉提示", "cat.other": "其他來源", "history.title": "搜尋歷史",
  "history.clear": "清空歷史", "history.empty": "暫無搜尋歷史。",
  "settings.refreshed": "索引已重新整理。", "settings.cleared": "索引快取已清除。",
  "row.removeWorkspace": "從工作區移除", "workspace.limit": "最多選擇四個頁面",
  "workspace.select": "選擇最多四筆結果建立工作區",
  "preview.mode.side": "分欄", "preview.mode.inline": "底部", "preview.mode.off": "關閉",
});

export const UI_LOCALES: Array<{ code: UiLocale; label: string }> = [
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
];
