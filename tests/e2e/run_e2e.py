"""ボクセル・フットボール E2E スモークテスト（Playwright）。

実行は「通常のターミナル（Terminal.app / iTerm）」で:
    cd /Users/yukimikawaguchi/Documents/BoxelAmericanFootball
    python tests/e2e/run_e2e.py

ブラウザ自動選択: インストール済み Google Chrome → WebKit → Firefox →
同梱Chromium の順に、起動できたものを使う（同梱Chromiumはこの環境でクラッシュするため後回し）。
ヘッドレスにしたい場合: E2E_HEADLESS=1 python tests/e2e/run_e2e.py
"""
import os
import sys
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
INDEX = ROOT / "index.html"
SHOTS = pathlib.Path(__file__).resolve().parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

HEADLESS = os.environ.get("E2E_HEADLESS", "0") == "1"

results = []
def check(label, ok):
    results.append((label, ok))
    print(("[OK] " if ok else "[NG] ") + label)

def launch_any(p):
    """起動できたブラウザを返す。(name, browser) か (None, None)。"""
    attempts = [
        ("Google Chrome (channel)", lambda: p.chromium.launch(headless=HEADLESS, channel="chrome")),
        ("WebKit", lambda: p.webkit.launch(headless=HEADLESS)),
        ("Firefox", lambda: p.firefox.launch(headless=HEADLESS)),
        ("Chromium (bundled)", lambda: p.chromium.launch(
            headless=HEADLESS, args=["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])),
    ]
    for name, fn in attempts:
        try:
            b = fn()
            pg = b.new_page()
            pg.goto("about:blank")
            pg.close()
            print("[INFO] 起動成功: " + name)
            return name, b
        except Exception as e:
            print("[WARN] 起動失敗: " + name + " -> " + str(e).splitlines()[0][:120])
    return None, None

def main():
    page_errors = []
    console_errors = []
    with sync_playwright() as p:
        name, browser = launch_any(p)
        if browser is None:
            print("[NG] どのブラウザも起動できませんでした")
            return 1

        page = browser.new_page(viewport={"width": 1024, "height": 720})
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("crash", lambda: page_errors.append("PAGE CRASHED (renderer)"))

        try:
            page.goto(INDEX.as_uri(), wait_until="domcontentloaded")
        except Exception as e:
            print("[NG] goto 失敗: " + str(e).splitlines()[0][:200])
            browser.close()
            return 1
        page.wait_for_timeout(1800)  # three.js(CDN) ロード待ち

        check("スタートボタンが表示される", page.is_visible("#startBtn"))
        page.screenshot(path=str(SHOTS / "01_start.png"))

        page.click("#startBtn")
        page.wait_for_selector(".cards .card", timeout=8000)
        check("隊形カードが表示される", page.locator(".cards .card").count() >= 1)
        page.screenshot(path=str(SHOTS / "02_formation.png"))

        page.locator(".cards .card").first.click()
        page.wait_for_selector(".cards .card", timeout=8000)
        check("プレーカードが表示される(3枚以上)", page.locator(".cards .card").count() >= 3)
        page.screenshot(path=str(SHOTS / "03_play.png"))

        page.locator(".cards .card").first.click()  # ラン
        page.wait_for_timeout(4000)  # アニメ+finalize待ち
        page.screenshot(path=str(SHOTS / "04_after_play.png"))

        check("プレー後もHUDが表示されている", page.is_visible("#downdist") and page.is_visible("#yardline"))
        dd = page.inner_text("#downdist")
        check("ダウン表示が取得できる(現在: %s)" % dd, bool(dd))
        check("pageerror が 0（実際: %d）" % len(page_errors), len(page_errors) == 0)
        check("console error が 0（実際: %d）" % len(console_errors), len(console_errors) == 0)

        browser.close()

    if page_errors:
        print("\n--- pageerror ---")
        for e in page_errors:
            print("  " + e)
    if console_errors:
        print("\n--- console error ---")
        for e in console_errors:
            print("  " + e)

    passed = sum(1 for _, ok in results if ok)
    print("\n========================================")
    print("%s %d/%d チェック成功（スクショ: %s）" % (
        "[OK]" if passed == len(results) else "[NG]", passed, len(results), SHOTS))
    return 0 if passed == len(results) else 1

if __name__ == "__main__":
    sys.exit(main())
