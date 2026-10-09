import { chromium } from "playwright";
import { visualLearningRegression } from "./visual_learning_regression.mjs";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.SVE_CHROMIUM
    ? { executablePath: process.env.SVE_CHROMIUM }
    : {}),
});
try {
  await visualLearningRegression(
    browser,
    process.env.SVE_BASE || "http://127.0.0.1:1420/",
  );
} finally {
  await browser.close();
}
