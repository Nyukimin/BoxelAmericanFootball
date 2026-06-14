"""Playwright 疎通確認プローブ。
あなたの環境（サンドボックス外）で:  python tests/e2e/probe.py
'LAUNCH_OK ok' が出れば Playwright でブラウザを起動できる。
"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_content("<h1 id='x'>ok</h1>")
    print("LAUNCH_OK", page.inner_text("#x"))
    browser.close()
