"""Local browser validation of Resolver v2 user flows; accepts an existing Vite URL."""
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:1424"
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get("SVE_CHROMIUM"))
    context = browser.new_context(viewport={"width": 1200, "height": 900})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base)
    page.wait_for_load_state("networkidle")
    # Inspect the rendered surface before choosing controls.
    assert page.locator("#search-input").count() == 1
    Path("artifacts").mkdir(exist_ok=True)
    page.screenshot(path="artifacts/query-resolver-browser-before.png")
    def search(query):
        entry = page.locator("#search-input")
        entry.fill(query)
        entry.press("Enter")
        page.wait_for_function("""async q => {
          const {useSearchStore} = await import('/src/stores/searchStore.ts');
          const s=useSearchStore.getState();return !s.loading && s.response?.query===q;
        }""", arg=query)
    for locale in ["en", "zh-CN", "zh-TW"]:
        page.evaluate("""async locale => {
          const {useSettingsStore} = await import('/src/stores/settingsStore.ts');
          await useSettingsStore.getState().update({ui_locale:locale});
        }""", locale)
        search("FT")
        choices = page.get_by_test_id("query-choices")
        expect(choices).to_be_visible()
        assert choices.locator("li button").count() == 2
        assert page.get_by_test_id("learning-panel").count() == 0
        choices.locator("li button").first.focus()
        page.keyboard.press("Escape")
        expect(choices).to_have_count(0)
        expect(page.locator("#search-input")).to_be_focused()
        search("curl")
        search("FT")
        choices.locator('[data-concept-id="fourier-transform"]').focus()
        page.keyboard.press("Enter")
        expect(page.get_by_test_id("learning-panel")).to_have_attribute("data-learning-concept", "fourier-transform")
        page.evaluate("""async () => {
          const {useWorkbenchStore}=await import('/src/workbench/workbenchStore.ts');useWorkbenchStore.getState().close();
        }""")
    for query, concept in [("momemtum", "momentum"), ("∇×F", "curl"), ("F=-kx", "hookes-law"), ("转动的动量", "angular-momentum")]:
        search(query)
        expect(page.locator(f'[data-concept-id="{concept}"]').first).to_be_visible()
    search("matrix movie tickets")
    assert page.locator("[data-concept-id]").count() == 0
    assert page.get_by_test_id("learning-panel").count() == 0
    page.set_viewport_size({"width": 390, "height": 844})
    search("FT")
    expect(page.get_by_test_id("query-choices")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.screenshot(path="artifacts/query-resolver-browser-mobile.png", full_page=True)
    assert not errors, errors
    browser.close()
    print("RESOLVER BROWSER: EN/zh-CN/zh-TW ambiguity, explicit keyboard selection, Escape, recovery, resource fallback and 390px PASS")
