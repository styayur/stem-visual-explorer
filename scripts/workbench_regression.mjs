import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
export async function workbenchRegression(browser, base) {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await context.route("**/*", (r) =>
    r.request().url().startsWith(base)
      ? r.continue()
      : r.fulfill({
          contentType: "text/html",
          body: "<p>External fixture</p>",
        }),
  );
  const wb = page.getByTestId("learning-panel");
  const nav = (surface) => wb.locator(`nav [data-surface="${surface}"]`);
  try {
    await page.goto(base);
    await page.waitForLoadState("networkidle");
    await page.locator("#search-input").fill("curl");
    await page.locator("#search-input").press("Enter");
    await page.locator('div[role="option"]').first().click();
    await page.keyboard.press("Space");
    await page
      .getByRole("dialog")
      .locator('[data-resource-concept-link="curl"]')
      .first()
      .click();
    await wb.waitFor();
    assert.equal(await wb.getAttribute("data-learning-concept"), "curl");
    await page.locator("#search-input").fill("simple harmonic motion");
    await page.locator('[data-object-group="concept"]').waitFor();
    assert.ok(await page.locator('[data-object-group="lesson"]').count());
    assert.equal(
      await page.locator('[data-object-group="textbook"]').count(),
      4,
    );
    await page.locator("#search-input").press("Enter");
    await page.locator('[data-concept-id="simple-harmonic-motion"]').click();
    await wb.waitFor();
    await page.waitForLoadState("networkidle");
    assert.ok(
      !requests.some((u) =>
        /GuidedVisualization|jsxgraph|katex|lessons\/(shm|ellipse|linear)/i.test(
          u,
        ),
      ),
      "overview must not load visualization assets",
    );
    await nav("learn").click();
    assert.equal(await wb.locator(".wb-path li").count(), 10);
    await nav("resources").click();
    await page.waitForLoadState("networkidle");
    assert.equal(
      await wb
        .getByText("External textbook reference", { exact: true })
        .count(),
      4,
    );
    await wb.getByRole("button", { name: "Textbooks", exact: true }).click();
    assert.ok(
      !requests.some((u) => /GuidedVisualization|jsxgraph|katex/i.test(u)),
      "resources must not load the runtime",
    );
    await nav("graph").click();
    assert.ok((await wb.locator("[data-graph-concept]").count()) <= 20);
    await wb.locator('[data-graph-concept="resonance"]').click();
    assert.equal(await wb.getAttribute("data-learning-concept"), "resonance");
    await nav("resources").click();
    await page.waitForLoadState("networkidle");
    assert.equal(
      await wb
        .getByRole("button", { name: "All", exact: true })
        .getAttribute("aria-pressed"),
      "true",
      "concept change resets the resource filter",
    );
    assert.equal(
      await wb
        .locator("[data-resource-concept]")
        .getAttribute("data-resource-concept"),
      "resonance",
    );
    const manifest = JSON.parse(
      await readFile("public/index/manifest.json", "utf8"),
    );
    const expected = [];
    for (const p of manifest) {
      const d = JSON.parse(await readFile(`public/index/${p.file}`, "utf8"));
      for (const e of d.entries)
        if (e.concept_ids.includes("resonance"))
          expected.push(`resource:${d.source_id}::${e.url}`);
    }
    const actual = await wb
      .locator(".wb-resources li")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.capabilityId));
    assert.deepEqual(
      actual.sort(),
      [...new Set(expected)].sort(),
      "resource set must be direct resonance annotations, independent of SHM search",
    );
    assert.deepEqual(
      await wb.locator(".wb-trail ol button").allTextContents(),
      ["simple harmonic motion", "resonance"],
    );
    await page.keyboard.press("Alt+ArrowLeft");
    assert.equal(
      await wb.getAttribute("data-learning-concept"),
      "simple-harmonic-motion",
    );
    await page.keyboard.press("Alt+ArrowRight");
    assert.equal(await wb.getAttribute("data-learning-concept"), "resonance");
    await page.keyboard.press("Alt+ArrowLeft");
    await nav("overview").click();
    await wb.locator('[data-target-concept="hookes-law"]').click();
    assert.equal(await wb.getAttribute("data-learning-concept"), "hookes-law");
    assert.equal(await nav("visualize").count(), 0);
    await page.keyboard.press("Alt+ArrowLeft");
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", {
      name: "Command Palette",
      exact: true,
    });
    await palette.waitFor();
    await palette
      .getByRole("option", { name: "Open Visualize", exact: true })
      .click();
    await page.getByTestId("visual-board").locator("svg").waitFor();
    assert.ok(
      !requests.some((u) =>
        /lessons\/(ellipse|linear)|\/ellipse-[\w-]+\.js|\/linear-[\w-]+\.js/.test(
          u,
        ),
      ),
      "opening SHM must not download sibling definitions",
    );
    await page.keyboard.press("Control+k");
    await palette.getByRole("option", { name: "Next", exact: true }).click();
    assert.equal(
      await page.getByTestId("guided-lesson").getAttribute("data-step-index"),
      "1",
    );
    await page.keyboard.press("Control+k");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Escape");
    assert.equal(await palette.count(), 0);
    assert.ok(
      await wb
        .getByTestId("guided-lesson")
        .getByRole("button", { name: "Next", exact: true })
        .isVisible(),
    );
    await nav("learn").click();
    await wb.locator(".wb-path button").nth(5).click();
    await page.getByTestId("guided-lesson").waitFor();
    assert.equal(
      await page.getByTestId("guided-lesson").getAttribute("data-step-index"),
      "5",
    );
    assert.ok(
      (await wb.locator("#wb-inspector").textContent()).includes(
        "do not imply zero velocity",
      ),
    );
    await mkdir("artifacts/workbench", { recursive: true });
    await page.screenshot({ path: "artifacts/workbench/desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("visual-board").scrollIntoViewIfNeeded();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await wb.getByRole("button", { name: "Navigation", exact: true }).click();
    await nav("resources").click();
    const resource = wb.locator(".wb-resource-title").first();
    await resource.waitFor();
    await resource.click();
    assert.ok(await wb.locator("#wb-inspector").isVisible());
    assert.ok(
      (await wb.locator("#wb-inspector").textContent()).includes(
        "Rights status",
      ),
    );
    await page.screenshot({ path: "artifacts/workbench/mobile.png" });
    await wb.getByRole("button", { name: "Inspector", exact: true }).click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await wb
      .getByRole("button", { name: "Back to search results", exact: true })
      .click();
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page
      .getByRole("button", { name: "Resume Concept Session", exact: true })
      .click();
    await wb.waitFor();
    assert.equal(
      await wb.getAttribute("data-learning-concept"),
      "simple-harmonic-motion",
    );
    assert.equal(
      await wb.getByTestId("work-surface").getAttribute("data-surface"),
      "resources",
    );
    assert.deepEqual(errors, []);
    process.stdout.write(
      "WORKBENCH BROWSER: object search, surfaces, SHM→resonance direct resources, graph/trail, commands, context, lazy boundaries, 390px and persistence PASS\n",
    );
  } finally {
    await context.close();
  }
}
