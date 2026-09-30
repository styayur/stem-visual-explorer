// Checks the actual Pages build at its deployed subpath, without Vite source imports.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const base = "http://127.0.0.1:1422/stem-visual-explorer/";
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--mode", "web", "--host", "127.0.0.1", "--port", "1422", "--strictPort"], { stdio: "pipe" });
let browser;
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(base)).ok) break; } catch { /* starting */ }
    if (i > 100) throw new Error("Preview server did not start");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.SVE_CHROMIUM ? { executablePath: process.env.SVE_CHROMIUM } : {}) });
  const context = await browser.newContext();
  const errors = [];
  await context.route("**/*", (route) => route.request().url().startsWith(base) ? route.continue() : route.fulfill({ contentType: "text/html", body: "<p>Preview</p>" }));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base); await page.waitForLoadState("networkidle");
  await page.locator("#search-input").fill("site:falstad wave");
  await page.locator("#search-input").press("Enter");
  const rows = page.locator('div[role="option"]');
  await rows.first().waitFor();
  assert.ok(await rows.count());
  await rows.first().getByTitle("Add to workspace", { exact: true }).click();
  const opened = context.waitForEvent("page");
  await page.getByRole("button", { name: /Workspace 1/ }).click();
  const workspace = await opened;
  await workspace.waitForLoadState("networkidle");
  assert.ok(workspace.url().startsWith(base));
  assert.equal(await workspace.locator("[data-preview-capability]").count(), 1);
  await workspace.getByRole("link").click(); await workspace.locator("#search-input").waitFor();
  assert.deepEqual(errors, []);
  console.log("PAGES BUILD: search, index URLs and workspace navigation passed");
} finally { await browser?.close(); server.kill(); }
