"""Headless smoke test for the static web build (GitHub Pages variant).

Run via the webapp-testing helper, e.g.:

    python with_server.py --server "npm run preview -- --mode web" --port 4173 \
        -- python scripts/web_smoke_test.py

It types a few queries into the real UI, checks that results render, exercises
the source filter, verifies Chinese synonym expansion, and captures a screenshot
into docs/screenshot.png.
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173/stem-visual-explorer/"
REPO = Path(__file__).resolve().parent.parent
SHOT = REPO / "docs" / "screenshot.png"

errors: list[str] = []


def rows(page):
    return page.locator('div[role="option"]')


def run_query(page, text: str):
    box = page.locator('input[placeholder*="Search math"]')
    box.click()
    box.fill(text)
    box.press("Enter")
    page.wait_for_timeout(2200)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        def on_console(msg):
            # Console noise from third-party embedded pages (X-Frame-Options,
            # CSP, connection resets) is expected; the UI shows a graceful
            # fallback. Only real script errors are treated as failures.
            if msg.type != "error":
                return
            text = msg.text
            for noise in (
                "X-Frame-Options",
                "Refused to display",
                "frame-ancestors",
                "Failed to load resource",
            ):
                if noise in text:
                    return
            errors.append(f"console.error: {text}")

        def on_request_failed(request):
            # Only failures for our own assets matter.
            if request.url.startswith("http://localhost:4173"):
                errors.append(f"requestfailed: {request.url}")

        page.on("console", on_console)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("requestfailed", on_request_failed)

        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        assert page.get_by_text("STEM Visual Explorer").first.is_visible(), "header missing"

        # 1. English query
        run_query(page, "curl")
        n_curl = rows(page).count()
        print(f"query 'curl'          -> {n_curl} rows")
        assert n_curl >= 3, f"expected results for curl, got {n_curl}"
        first = rows(page).first.inner_text().replace("\n", " | ")
        print(f"   first row: {first[:110]}")

        # 2. Chinese synonym expansion
        run_query(page, "旋度")
        n_zh = rows(page).count()
        expanded = page.locator("text=expanded").count()
        print(f"query '旋度'          -> {n_zh} rows (expanded chip: {expanded > 0})")
        assert n_zh >= 3, f"expected results for 旋度, got {n_zh}"
        assert expanded > 0, "synonym expansion chip should be visible"

        # 3. Standing wave (multi-source mixing)
        run_query(page, "standing wave")
        n_sw = rows(page).count()
        sources = set()
        for i in range(min(n_sw, 12)):
            sources.add(rows(page).nth(i).inner_text().split("\n")[0])
        print(f"query 'standing wave' -> {n_sw} rows; top sources: {sorted(sources)}")
        assert n_sw >= 5, "expected standing wave results"
        assert len(sources) >= 2, "mixed-source stream expected"

        # 4. site: filter syntax
        run_query(page, "site:falstad wave")
        n_site = rows(page).count()
        print(f"query 'site:falstad wave' -> {n_site} rows")
        assert n_site >= 1, "site: filter returned no results"

        # 5. Source filter via sidebar (back to a normal query first)
        run_query(page, "gradient")
        sidebar = page.locator("aside").first
        sidebar.get_by_text("Math Insight").click()
        page.wait_for_timeout(600)
        n_filtered = rows(page).count()
        labels = {
            rows(page).nth(i).inner_text().split("\n")[0]
            for i in range(min(n_filtered, 10))
        }
        print(f"Math Insight filter   -> {n_filtered} rows; sources: {labels}")
        assert n_filtered >= 1, "source filter produced no rows"
        assert labels == {"Math Insight"}, f"filter leaked other sources: {labels}"

        page.screenshot(path=str(SHOT))
        print(f"screenshot written to {SHOT}")

        browser.close()

    if errors:
        print("CONSOLE ERRORS:")
        for e in errors[:10]:
            print("  " + e)
        return 1
    print("WEB SMOKE TEST: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())