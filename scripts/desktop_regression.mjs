// Requires the debug app built with identifier org.stemvisualexplorer.audit20260929,
// a running Vite server, and WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS containing
// --remote-debugging-port=9223. Refuses to change a normal user's app profile.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.connectOverCDP(process.env.SVE_DESKTOP_CDP || "http://127.0.0.1:9223");
const context = browser.contexts()[0];
const main = context.pages().find((p) => p.url().startsWith("http://localhost:1420"));
let verifiedProfile = false;
const children = [];
const errors = [];
let checks = 0;
const ok = (text) => { checks++; console.log(`ok ${checks} - ${text}`); };
const invoke = (command, args = {}) => main.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), { command, args });
try {
  assert.ok(main, "Desktop main page is not running");
  assert.equal(await invoke("plugin:app|identifier"), "org.stemvisualexplorer.audit20260929", "Refusing to modify a non-test profile");
  verifiedProfile = true;
  main.on("pageerror", (e) => errors.push(e.message));
  await context.route("https://example.com/**", (route) => route.fulfill({ contentType: "text/html", body: '<!doctype html><title>Native test page</title><p id="description">Electromagnetic induction demonstration.</p><a href="/next">Next page</a>' }));
  await context.route("https://api.mymemory.translated.net/**", (route) => route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: { responseStatus: 200, responseData: { translatedText: "电磁感应演示" } } }));
  const settings = await invoke("get_settings");
  await main.evaluate(async () => {
    const { useSettingsStore } = await import("/src/stores/settingsStore.ts");
    await useSettingsStore.getState().update({ preview_mode: "off", ui_locale: "en", translate_results: false });
  });
  const providers = await invoke("providers_info");
  assert.equal(providers.length, 7);
  ok("real Tauri IPC, isolated profile and provider registry");
  await main.locator("#search-input").fill("curl");
  await main.locator("#search-input").press("Enter");
  await main.locator('div[role="option"]').first().waitFor({ timeout: 30000 });
  const results = await main.evaluate(async () => (await import("/src/stores/searchStore.ts")).useSearchStore.getState().response);
  assert.ok(results.total > 0);
  const providerErrors = results.providers.filter((p) => p.error);
  assert.equal(providerErrors.length, 0, JSON.stringify(providerErrors));
  ok("live desktop search through Rust providers");
  const saved = results.results[0];
  await invoke("add_favorite", { result: saved });
  await invoke("add_favorite", { result: saved });
  assert.equal((await invoke("list_favorites")).filter((f) => f.result.id === saved.id).length, 1);
  await main.reload(); await main.waitForLoadState("networkidle");
  assert.ok((await invoke("list_favorites")).some((f) => f.result.id === saved.id));
  await invoke("remove_favorite", { id: saved.id });
  await invoke("add_history", { query: "desktop regression", resultCount: 1 });
  await invoke("add_history", { query: "desktop regression", resultCount: 2 });
  assert.equal((await invoke("list_history")).filter((h) => h.query === "desktop regression").length, 1);
  await invoke("clear_history"); assert.equal((await invoke("list_history")).length, 0);
  ok("SQLite favorites persistence, history deduplication and clearing");
  const createdWorkspace = context.waitForEvent("page", { timeout: 20000 });
  const resources = ["one", "two"].map((part) => ({ ...saved, url: `https://example.com/${part}`, title: `Gradient ${part}`, description: "Workspace metadata summary" }));
  const workspaceLabel = await invoke("open_workspace", { urls: resources.map((r) => r.url), resources });
  children.push(workspaceLabel);
  const workspace = await createdWorkspace;
  await workspace.waitForLoadState("networkidle");
  await workspace.locator("textarea").waitFor();
  assert.equal(await workspace.locator("iframe").count(), 0);
  assert.equal(await workspace.getByTestId("resource-card").count(), 2);
  assert.deepEqual(await invoke("get_workspace_items", { label: workspaceLabel }), ["https://example.com/one", "https://example.com/two"]);
  assert.equal((await invoke("get_workspace_resources", { label: workspaceLabel })).length, 2);
  assert.ok((await workspace.getByTestId("resource-card").first().textContent()).includes("Workspace metadata summary"));
  const initialPages = new Set(context.pages());
  await workspace.getByRole("button", { name: "Open all in WebViewers", exact: true }).click();
  const deadline = Date.now() + 15000;
  while (context.pages().filter((p) => !initialPages.has(p)).length < 2) {
    if (Date.now() > deadline) throw new Error("Workspace did not open two viewers");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const viewer of context.pages().filter((p) => !initialPages.has(p))) {
    await viewer.locator("#sve-toolbar").waitFor();
    const closed = viewer.waitForEvent("close");
    await viewer.getByRole("button", { name: "Close window", exact: true }).click(); await closed;
  }
  await workspace.locator("textarea").fill("Native workspace note");
  await workspace.reload(); await workspace.waitForLoadState("networkidle");
  assert.equal(await workspace.locator("textarea").inputValue(), "Native workspace note");
  await workspace.locator('[href="?route=search"]').click(); await workspace.locator("#search-input").waitFor();
  await invoke("close_window", { label: workspaceLabel });
  await main.waitForFunction(async (label) => {
    try { await window.__TAURI_INTERNALS__.invoke("get_workspace_items", { label }); return false; } catch { return true; }
  }, workspaceLabel);
  ok("native workspace permissions, notes, return to search and payload cleanup");
  const createdBrowser = context.waitForEvent("page", { timeout: 20000 });
  const windowLabel = await invoke("open_window", { url: "https://example.com/", title: "Desktop regression" });
  children.push(windowLabel);
  const external = await createdBrowser;
  await external.locator("#sve-toolbar").waitFor({ timeout: 20000 });
  assert.equal(await invoke("toggle_pin", { label: windowLabel }), true);
  assert.equal(await invoke("toggle_pin", { label: windowLabel }), false);
  const remoteAccess = await external.evaluate(async () => {
    try { await window.__TAURI_INTERNALS__.invoke("get_settings"); return true; } catch { return false; }
  });
  assert.equal(remoteAccess, false, "External sites must not receive app IPC access");
  await external.evaluate(() => { window.__copied = ""; Object.defineProperty(navigator, "clipboard", { configurable:true, value:{writeText:async (text) => { window.__copied = text; }} }); });
  await external.getByRole("button", { name: "Copy URL", exact: true }).click();
  assert.equal(await external.evaluate(() => window.__copied), "https://example.com/");
  await external.getByRole("button", { name: "Pin / unpin window", exact: true }).click({ noWaitAfter: true });
  await main.waitForTimeout(200);
  assert.equal(await invoke("toggle_pin", { label: windowLabel }), false, "toolbar pin must set native always-on-top");
  // WebView2 CDP leaves cancelled custom-scheme navigations pending; reload resets that observer state.
  await external.reload(); await external.locator("#sve-toolbar").waitFor();
  const childPromise = context.waitForEvent("page", {timeout:15000});
  await external.evaluate(() => window.open("https://example.com/child", "_blank"));
  const child = await childPromise; await child.locator("#sve-toolbar").waitFor();
  const childClosed = child.waitForEvent("close"); await child.getByRole("button", {name:"Close window",exact:true}).click(); await childClosed;
  await external.getByRole("link", { name: "Next page" }).click();
  await external.waitForURL("https://example.com/next");
  await external.getByRole("button", { name: "Back", exact: true }).click();
  await external.waitForURL("https://example.com/");
  await external.getByRole("button", { name: "Forward", exact: true }).click();
  await external.waitForURL("https://example.com/next");
  await external.getByRole("button", { name: "Reload", exact: true }).click();
  await external.locator("#sve-toolbar").waitFor();
  await external.getByRole("button", { name: "Translate page", exact: true }).click();
  await external.waitForFunction(() => document.querySelector("#sve-translate").title === "Restore original");
  assert.equal(await external.locator("#description").textContent(), "电磁感应演示");
  await external.locator("#sve-translate").click();
  assert.equal(await external.locator("#description").textContent(), "Electromagnetic induction demonstration.");
  await external.goto("http://localhost:1420/");
  const localAccess = await external.evaluate(async () => {
    try { await window.__TAURI_INTERNALS__.invoke("get_settings"); return true; } catch { return false; }
  });
  assert.equal(localAccess, false, "Viewer must remain unprivileged on an app URL");
  const closed = external.waitForEvent("close");
  await external.getByRole("button", { name: "Close window", exact: true }).click();
  await closed;
  ok("native browser toolbar, back/forward/reload, translation, pin and close; remote IPC denied");
  for (const command of ["open_external", "open_window"]) {
    await assert.rejects(invoke(command, { url: "file:///C:/Windows/win.ini", title: "Rejected" }));
  }
  await assert.rejects(invoke("open_workspace", { urls: ["https://example.com/"], resources: [{ ...saved, url: "file:///C:/test" }] }));
  await assert.rejects(invoke("open_workspace", { urls: Array(5).fill("https://example.com/") }));
  await main.locator("#search-input").fill("简谐振动");
  await main.locator("#search-input").press("Enter");
  await main.locator('[data-concept-id="simple-harmonic-motion"]').click();
  const learning = main.getByTestId("learning-panel");
  await learning.locator('nav [data-surface="learn"]').click();
  assert.equal(await learning.locator(".wb-path li").count(),10);
  await learning.locator('nav [data-surface="resources"]').click();
  await learning.getByText("External textbook reference",{exact:true}).first().waitFor();
  assert.equal(await learning.getByText("External textbook reference",{exact:true}).count(),4);
  await learning.locator('nav [data-surface="overview"]').click();
  await learning.getByRole("button", {name:"Open guided visualization",exact:true}).click();
  const lesson = learning.getByTestId("guided-lesson");
  await lesson.getByTestId("visual-board").locator("svg").waitFor();
  for(let i=0;i<4;i++)await lesson.getByRole("button",{name:"Next",exact:true}).click();
  await lesson.getByRole("button",{name:"Play",exact:true}).click();
  await lesson.getByRole("button",{name:"Pause",exact:true}).click();
  await lesson.locator('[data-parameter-id="k"]').fill("3");
  assert.ok((await lesson.getByTestId("lesson-readouts").textContent()).includes("1.732"));
  await lesson.getByRole("button",{name:"Restart",exact:true}).click();
  assert.equal(await lesson.getAttribute("data-step-index"),"0");
  await main.keyboard.press("Control+k");
  await main.getByRole("dialog",{name:"Command Palette",exact:true}).getByRole("option",{name:"Next",exact:true}).click();
  assert.equal(await lesson.getAttribute("data-step-index"),"1");
  await main.keyboard.press("Control+k");await main.keyboard.press("Escape");
  assert.equal(await main.getByRole("dialog",{name:"Command Palette",exact:true}).count(),0);
  await learning.locator('nav [data-surface="graph"]').click();
  await learning.locator('[data-graph-concept="resonance"]').click();
  assert.equal(await learning.getAttribute("data-learning-concept"),"resonance");
  await learning.locator('nav [data-surface="resources"]').click();
  await main.waitForLoadState("networkidle");
  assert.equal(await learning.locator("[data-resource-concept]").getAttribute("data-resource-concept"),"resonance");
  await main.keyboard.press("Alt+ArrowLeft");
  assert.equal(await learning.getAttribute("data-learning-concept"),"simple-harmonic-motion");
  await learning.locator('nav [data-surface="resources"]').click();
  await learning.locator(".wb-resource-title").first().click();
  // Observe the real custom-protocol response; Tauri internals are immutable.
  const externalResponse = main.waitForResponse(r=>r.url()==="http://ipc.localhost/open_external");
  await learning.locator("#wb-inspector").getByRole("button",{name:"Open externally",exact:true}).click();
  const openedExternal = await externalResponse;
  assert.equal(openedExternal.status(),200);
  assert.equal(await openedExternal.text(),"null");
  assert.ok(openedExternal.request().postDataJSON().url.startsWith("https://github.com/tradecatlabs/"));
  await learning.getByRole("button",{name:"Back to search results",exact:true}).click();
  ok("native Workbench: surfaces, JSXGraph lesson controls, commands, graph/trail navigation, isolated resource context and actual safe external-link IPC");
  await invoke("clear_cache");
  assert.ok((await invoke("providers_info")).every((p) => p.indexed_items === null));
  await invoke("save_settings", { settings });
  assert.deepEqual(errors, []);
  await main.screenshot({ path: "dist-release/audit-native.png" });
  ok("URL validation, workspace bounds, cache clearing and settings persistence");
  process.stdout.write(`DESKTOP REGRESSION: ${checks} groups passed on WebView2\n`);
} finally {
  if (verifiedProfile) {
    for (const label of children) { try { await invoke("close_window", { label }); } catch { /* already closed */ } }
    try { await invoke("close_window", { label: "main" }); } catch { /* app exited */ }
  }
  await browser.close();
}
