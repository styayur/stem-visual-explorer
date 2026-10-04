import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

export async function visualLearningRegression(browser, base) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) =>
    requests.push({ url: r.url(), type: r.resourceType() }),
  );
  await context.route("**/*", (route) =>
    route.request().url().startsWith(base)
      ? route.continue()
      : route.fulfill({
          contentType: "text/html",
          body: "<p>External fixture</p>",
        }),
  );
  const panel = page.getByTestId("learning-panel"),
    lesson = page.getByTestId("guided-lesson");
  const poll = async (predicate, message) => {
    for (let i = 0; i < 100; i++) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(message);
  };
  const search = async (query) => {
    await page.locator("#search-input").fill(query);
    await page.locator("#search-input").press("Enter");
  };
  const open = async (query, id) => {
    await search(query);
    await page.locator(`[data-concept-id="${id}"]`).click();
    await panel.waitFor();
    await panel
      .getByRole("button", {
        name: /Open guided visualization|打开引导式可视化|開啟引導式視覺化/,
      })
      .click();
    await page.getByTestId("visual-board").locator("svg").waitFor();
  };
  const change = async (id, value) => {
    await lesson.locator(`[data-parameter-id="${id}"]`).fill(String(value));
  };
  const drag = async (id, dx, dy) => {
    const point = lesson.locator(`[data-scene-id="${id}"]`);
    await point.scrollIntoViewIfNeeded();
    const box = await point.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + dx,
      box.y + box.height / 2 + dy,
      { steps: 10 },
    );
    await page.mouse.up();
  };
  const step = async (index) =>
    poll(
      async () =>
        Number(await lesson.getAttribute("data-step-index")) === index,
      `Expected step ${index}`,
    );
  const screenshot = async (name) => {
    await page.setViewportSize({ width: 1440, height: 1800 });
    await lesson.scrollIntoViewIfNeeded();
    await lesson.screenshot({ path: `artifacts/visual-learning/${name}.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
  };
  await mkdir("artifacts/visual-learning", { recursive: true });
  try {
    await page.goto(base);
    await page.waitForLoadState("networkidle");
    assert.ok(
      !requests.some((r) => /jsxgraph|GuidedVisualization|katex/i.test(r.url)),
      "search must not request the visualization engine",
    );
    await search("简谐振动");
    await page.locator('[data-concept-id="simple-harmonic-motion"]').click();
    await panel.waitFor();
    assert.ok(
      !requests.some((r) => /jsxgraph|GuidedVisualization|katex/i.test(r.url)),
      "overview must not request renderer assets",
    );
    assert.equal(
      await panel
        .getByText("External textbook reference", { exact: true })
        .count(),
      4,
    );
    // Exercise the actual adapter with dynamic execution blocked. All numeric
    // scene callbacks are pre-written; CDP function calls do not use these APIs.
    await page.evaluate(() => {
      window.__dynamicCalls = 0;
      window.__dynamicStacks = [];
      window.__originalEval = window.eval;
      window.__originalFunction = window.Function;
      const blocked = () => {
        window.__dynamicCalls++;
        const error = new Error("Dynamic code execution is forbidden");
        window.__dynamicStacks.push(error.stack);
        throw error;
      };
      window.eval = blocked;
      window.Function = new Proxy(window.Function, {
        apply: blocked,
        construct: blocked,
      });
    });
    await panel
      .getByRole("button", { name: "Open guided visualization", exact: true })
      .click();
    await page.getByTestId("visual-board").locator("svg").waitFor();
    assert.equal(await lesson.getAttribute("data-lesson-id"), "guided-shm");
    await lesson.getByRole("button", { name: "Next", exact: true }).click();
    await step(1);
    const old = await lesson.locator('[data-parameter-id="A"]').inputValue();
    await drag("mass", 35, 0);
    assert.notEqual(
      await lesson.locator('[data-parameter-id="A"]').inputValue(),
      old,
      "mass must really drag",
    );
    const slider = lesson.getByRole("slider", {
      name: "Amplitude A",
      exact: true,
    });
    await slider.focus();
    const before = Number(await slider.inputValue());
    await slider.press("ArrowLeft");
    assert.ok(Number(await slider.inputValue()) < before);
    await lesson.getByRole("button", { name: "Previous", exact: true }).click();
    await step(0);
    for (let i = 0; i < 4; i++)
      await lesson.getByRole("button", { name: "Next", exact: true }).click();
    await lesson.getByRole("button", { name: "Play", exact: true }).click();
    await poll(
      async () => (await lesson.getAttribute("data-playback")) === "playing",
      "SHM did not play",
    );
    await lesson.getByRole("button", { name: "Pause", exact: true }).click();
    assert.equal(await lesson.getAttribute("data-playback"), "paused");
    await change("k", 3);
    assert.ok(
      (await lesson.getByTestId("lesson-readouts").textContent()).includes(
        "1.732",
      ),
    );
    await lesson.getByRole("button", { name: "Restart", exact: true }).click();
    await step(0);
    await lesson.getByRole("button", { name: "Next", exact: true }).click();
    assert.equal(Number(await slider.inputValue()), 1.2);
    for (let i = 1; i < 10; i++) {
      if (i > 1)
        await lesson.getByRole("button", { name: "Next", exact: true }).click();
      assert.ok(await lesson.getByTestId("step-title").textContent());
      assert.ok(await lesson.locator("math").count());
    }
    await screenshot("shm");
    console.log(
      "VISUAL: SHM search, lazy loading, textbook metadata, steps, pointer + keyboard control, play/pause and restart PASS",
    );

    await panel
      .getByRole("button", { name: "Back to search results", exact: true })
      .click();
    assert.equal(
      await page
        .locator('[data-concept-id="simple-harmonic-motion"]:focus')
        .count(),
      1,
    );
    await open("ellipse", "ellipse");
    assert.equal(
      await panel
        .getByText("External textbook reference", { exact: true })
        .count(),
      3,
    );
    for (let i = 0; i < 3; i++)
      await lesson.getByRole("button", { name: "Next", exact: true }).click();
    const theta = await lesson
      .locator('[data-parameter-id="theta"]')
      .inputValue();
    await drag("p", -30, 35);
    assert.notEqual(
      await lesson.locator('[data-parameter-id="theta"]').inputValue(),
      theta,
      "P must really drag on the locus",
    );
    await change("a", 1);
    assert.ok(
      Number(await lesson.locator('[data-parameter-id="c"]').inputValue()) < 1,
    );
    await lesson.getByRole("button", { name: "Play", exact: true }).click();
    await lesson.getByRole("button", { name: "Pause", exact: true }).click();
    for (let i = 3; i < 6; i++)
      await lesson.getByRole("button", { name: "Next", exact: true }).click();
    assert.ok(await lesson.locator("math").count());
    await screenshot("ellipse");
    console.log(
      "VISUAL: ellipse search, constrained focal geometry, pointer trace, equation and references PASS",
    );

    await open("determinant", "determinant");
    for (let i = 0; i < 6; i++)
      await lesson.getByRole("button", { name: "Next", exact: true }).click();
    for (const [id, text] of [
      ["rotation", "preserved"],
      ["scaling", "preserved"],
      ["shear", "preserved"],
      ["reflection", "reversed"],
      ["singular", "collapsed"],
    ]) {
      await lesson.locator(`[data-preset-id="${id}"]`).click();
      assert.ok(
        (await lesson.getByTestId("orientation").textContent()).includes(text),
      );
    }
    await lesson.locator('[data-preset-id="reflection"]').click();
    await change("blend", 0.5);
    assert.ok(
      (await lesson.getByTestId("orientation").textContent()).includes(
        "collapsed",
      ),
    );
    await change("blend", 1);
    await screenshot("determinant");
    await lesson.getByRole("button", { name: "Play", exact: true }).click();
    await lesson.getByRole("button", { name: "Pause", exact: true }).click();
    console.log(
      "VISUAL: determinant, all five presets, intermediate B, area and signed orientation PASS",
    );

    for (const [locale, name] of [
      ["zh-CN", "简体中文"],
      ["zh-TW", "繁體中文"],
      ["en", "English"],
    ]) {
      await page
        .getByTitle(/Language & translation|语言与翻译|語言與翻譯/)
        .click();
      await page.getByRole("button", { name, exact: true }).click();
      await page.locator("#search-input").click();
      for (const [query, id, count] of [
        ["simple harmonic motion", "simple-harmonic-motion", 10],
        ["ellipse", "ellipse", 7],
        ["linear transformation", "linear-transformation", 7],
      ]) {
        await open(query, id);
        for (let i = 0; i < count; i++) {
          assert.ok(
            (await lesson.getByTestId("step-title").textContent()).length > 0,
          );
          if (i < count - 1)
            await lesson
              .getByRole("button", { name: /^Next$|^下一步$/ })
              .click();
        }
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
      }
    }
    console.log("VISUAL: all 24 lesson states in all three UI languages PASS");

    // Inspect using CDP: Playwright's locator.evaluate itself uses global eval.
    const result = await cdp.send("Runtime.evaluate", {
      expression: "JSON.stringify(window.__dynamicStacks)",
      returnByValue: true,
    });
    const stacks = JSON.parse(result.result.value);
    assert.ok(
      stacks.every((stack) => stack.includes("UtilityScript.evaluate")),
      "application must never attempt dynamic execution; Playwright's own string evaluation is also blocked",
    );
    await cdp.send("Runtime.evaluate", {
      expression:
        "window.eval=window.__originalEval;window.Function=window.__originalFunction;",
      returnByValue: true,
    });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await open("simple harmonic motion", "simple-harmonic-motion");
    for (let i = 0; i < 4; i++)
      await lesson.getByRole("button", { name: "Next", exact: true }).click();
    assert.ok(
      await lesson
        .getByRole("button", { name: "Play", exact: true })
        .isDisabled(),
    );
    assert.equal(await lesson.getAttribute("data-playback"), "paused");
    assert.ok(await lesson.locator('[role="status"]').textContent());
    await page.setViewportSize({ width: 390, height: 844 });
    await change("A", 1.8);
    await lesson.getByTestId("visual-board").scrollIntoViewIfNeeded();
    await poll(async () => {
      const board = await lesson.getByTestId("visual-board").boundingBox();
      const mass = await lesson.locator('[data-scene-id="mass"]').boundingBox();
      return board && mass && mass.x >= board.x && mass.x + mass.width <= board.x + board.width && mass.y >= board.y && mass.y + mass.height <= board.y + board.height;
    }, "mobile resizing must keep the physical mass inside the diagram");
    await page.screenshot({ path: "artifacts/visual-learning/mobile.png" });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok(await lesson.evaluate((e) => e.scrollWidth <= e.clientWidth));
    await lesson.getByRole("button", { name: "Previous", exact: true }).focus();
    await page.keyboard.press("Enter");
    await step(3);
    await page.keyboard.press("Escape");
    assert.equal(await panel.count(), 0);
    await search("curl");
    await page.locator('[data-concept-id="curl"]').click();
    assert.ok((await panel.textContent()).includes("no native guided lesson"));
    assert.equal(await panel.getByTestId("guided-lesson").count(), 0);
    await search("倔强系数");
    await page.getByText(/倔强系数 → spring constant/).waitFor();
    assert.ok(
      await page.evaluate(() =>
        window.__dynamicStacks.every((stack) =>
          stack.includes("UtilityScript.evaluate"),
        ),
      ),
    );
    assert.ok(
      !requests.some((r) => r.type === "script" && !r.url.startsWith(base)),
      "no remote scripts",
    );
    assert.deepEqual(errors, []);
    console.log(
      "VISUAL: reduced motion, mobile width, keyboard, graceful fallback, legacy recognition and blocked dynamic execution PASS",
    );
  } finally {
    await context.close();
  }
}
