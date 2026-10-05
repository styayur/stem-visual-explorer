import assert from "node:assert/strict";
/** Exercises built UI as well as Vite; no source-module imports are needed. */
export async function queryResolverRegression(browser, base) {
  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(
      (locale) =>
        localStorage.setItem(
          "sve.settings",
          JSON.stringify({ ui_locale: locale }),
        ),
      locale,
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await context.route("**/*", (r) =>
      r.request().url().startsWith(base)
        ? r.continue()
        : r.fulfill({
            contentType: "text/html",
            body: "<p>External fixture</p>",
          }),
    );
    try {
      await page.goto(base);
      await page.waitForLoadState("networkidle");
      const search = async (q) => {
        await page.locator("#search-input").fill(q);
        await page.locator("#search-input").press("Enter");
        await page.waitForLoadState("networkidle");
      };
      await search("FT");
      const choices = page.getByTestId("query-choices");
      await choices.waitFor();
      assert.equal(await choices.locator("li button").count(), 2);
      assert.equal(await page.getByTestId("learning-panel").count(), 0);
      await choices.locator("li button").first().focus();
      await page.keyboard.press("Escape");
      assert.equal(await choices.count(), 0);
      assert.ok(
        await page
          .locator("#search-input")
          .evaluate((e) => e === document.activeElement),
      );
      for (const [q, id] of [
        ["momemtum", "momentum"],
        ["∇×F", "curl"],
        ["F=-kx", "hookes-law"],
        ["转动的动量", "angular-momentum"],
      ]) {
        await search(q);
        await page.locator(`[data-concept-id="${id}"]`).first().waitFor();
      }
      await search("matrix movie tickets");
      assert.equal(await page.locator("[data-concept-id]").count(), 0);
      assert.equal(await page.getByTestId("learning-panel").count(), 0);
      await search("FT");
      await choices.waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await choices.locator('[data-concept-id="fourier-transform"]').focus();
      await page.keyboard.press("Enter");
      await page.getByTestId("learning-panel").waitFor();
      assert.equal(
        await page
          .getByTestId("learning-panel")
          .getAttribute("data-learning-concept"),
        "fourier-transform",
      );
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
  process.stdout.write(
    "RESOLVER UI: three locales, ambiguity choices, keyboard/Escape, bounded recovery, symbols/formulas, resource fallback and 390px PASS\n",
  );
}
