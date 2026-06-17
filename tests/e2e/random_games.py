"""ボクセル・フットボール: 実ブラウザでランダム自動プレー（10試合）してログを集める。

使い方（通常ターミナル＝Terminal.app / iTerm。Claudeのサンドボックスでは Chromium がクラッシュするため不可）:
    cd /Users/yukimikawaguchi/Documents/BoxelAmericanFootball
    python tests/e2e/random_games.py
    # 試合数やヘッドレスを変えたい場合:
    #   E2E_GAMES=10 E2E_HEADLESS=1 python tests/e2e/random_games.py

出力:
    tests/e2e/logs/random_games_<JST時刻>.json   ... 全試合のシステムログ＋状態＋エラー（解析用）
    tests/e2e/logs/random_games_<JST時刻>.md     ... 人間/レビュー用の要約
    tests/e2e/logs/latest.json / latest.md       ... 最新へのコピー（レビュー時に読む）
    tests/e2e/screenshots/game_<n>_end.png       ... 各試合終了時のスクショ

各試合は seed=1..N で「再現モードON」にして実行するので、不具合があれば
ブラウザで同じ seed を再現モードに入れて再現できる。アニメは turbo で短縮（結果は乱数依存で不変）。
"""
import os
import sys
import json
import time
import random
import pathlib
import datetime
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
INDEX = ROOT / "index.html"
LOGS = pathlib.Path(__file__).resolve().parent / "logs"
SHOTS = pathlib.Path(__file__).resolve().parent / "screenshots"
LOGS.mkdir(exist_ok=True)
SHOTS.mkdir(exist_ok=True)

HEADLESS = os.environ.get("E2E_HEADLESS", "0") == "1"
GAMES = int(os.environ.get("E2E_GAMES", "10"))
TURBO = float(os.environ.get("E2E_TURBO", "0.12"))
MAXSTEPS = 5000
PER_GAME_WALL = 180  # 秒


def launch_any(p):
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


# 1試合のドライブ。ページの実状態を読みながらランダムに操作する。
DRIVE_READ = """() => {
  const $ = (id) => document.getElementById(id);
  const startEl = $('start');
  const h1 = startEl && startEl.querySelector ? startEl.querySelector('h1') : null;
  const over = startEl && startEl.style.display !== 'none' && h1 && (h1.textContent||'').indexOf('試合終了') >= 0;
  const tap = $('tapNext');
  const hasTap = !!(tap && tap.style && tap.style.display === 'block');
  const cs = $('cards') ? $('cards').children : [];
  const titles = [];
  for (let i=0;i<cs.length;i++){ titles.push((cs[i]._innerHTML||cs[i].innerHTML||'').replace(/<[^>]+>/g,'').slice(0,24)); }
  const BT = window.__BoxelTest;
  const s = (BT && BT.getState) ? BT.getState() : {};
  return { over: !!over || (BT&&BT.isGameOver?BT.isGameOver():false), hasTap, nCards: cs.length, titles,
           mode: s.mode, down: s.down, oppDown: s.oppDown, los: s.los, toGo: s.toGo,
           quarter: s.quarter, clock: Math.round(s.clock||0), home: s.home, away: s.away };
}"""

CLICK_CARD = """(k) => { const cs = document.getElementById('cards').children; if (cs[k] && cs[k].onclick) cs[k].onclick(); }"""
CLICK_TAP = """() => { const t = document.getElementById('tapNext'); if (t && t.onclick) t.onclick(); }"""
CLICK_START = """() => { const b = document.getElementById('startBtn'); if (b && b.onclick) b.onclick(); }"""


def play_one_game(page, seed):
    rng = random.Random(seed * 7919 + 13)
    # 再現モードON＋turbo（同じ seed で後から再現可能・アニメ短縮）
    page.evaluate("(s) => { window.__BoxelTest.setTurbo(%f); window.__BoxelTest.enableReplay(s); }" % TURBO, seed)
    page.evaluate(CLICK_START)
    t0 = time.time()
    steps = 0
    last_clock = None
    last_q = None
    anomalies = []
    while steps < MAXSTEPS and (time.time() - t0) < PER_GAME_WALL:
        st = page.evaluate(DRIVE_READ)
        if st.get("over"):
            break
        # 軽い異常チェック（詳細はsysLogで）
        try:
            if st.get("mode") == "offense" and st.get("down") and not (1 <= st["down"] <= 4):
                anomalies.append("down範囲外 " + json.dumps(st, ensure_ascii=False))
            if last_q is not None and st.get("quarter") == last_q and last_clock is not None and (st.get("clock", 0) > last_clock + 1):
                anomalies.append("clock増加 %s->%s Q%s" % (last_clock, st.get("clock"), st.get("quarter")))
            last_q = st.get("quarter"); last_clock = st.get("clock")
        except Exception:
            pass
        if st.get("hasTap"):
            page.evaluate(CLICK_TAP)
            page.wait_for_timeout(20)
        elif st.get("nCards", 0) > 0:
            idx = rng.randrange(st["nCards"])
            page.evaluate(CLICK_CARD, idx)
            page.wait_for_timeout(60)
        else:
            page.wait_for_timeout(50)
        steps += 1
    sys_json = page.evaluate("() => window.__BoxelTest.sysLogJSON()")
    final = page.evaluate("() => { const s = window.__BoxelTest.getState(); return { home:s.home, away:s.away, quarter:s.quarter, gameEnded: !!s.gameEnded }; }")
    ended = bool(final.get("gameEnded"))
    return {
        "seed": seed, "ended": ended, "steps": steps,
        "wall": round(time.time() - t0, 1),
        "final": final, "anomalies": anomalies[:10],
        "sysLog": json.loads(sys_json) if sys_json else None,
    }


def main():
    page_errors = []
    console_errors = []
    games = []
    with sync_playwright() as p:
        name, browser = launch_any(p)
        if browser is None:
            print("[NG] どのブラウザも起動できませんでした")
            return 1
        page = browser.new_page(viewport={"width": 1024, "height": 720})
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("crash", lambda: page_errors.append("PAGE CRASHED"))

        for seed in range(1, GAMES + 1):
            err_before = len(page_errors) + len(console_errors)
            try:
                page.goto(INDEX.as_uri(), wait_until="domcontentloaded")
                page.wait_for_function("() => !!window.__BoxelTest", timeout=15000)
            except Exception as e:
                games.append({"seed": seed, "ended": False, "loadError": str(e).splitlines()[0][:200]})
                print("seed=%d [NG] load: %s" % (seed, str(e).splitlines()[0][:80]))
                continue
            try:
                g = play_one_game(page, seed)
            except Exception as e:
                g = {"seed": seed, "ended": False, "driveError": str(e).splitlines()[0][:200]}
            g["newErrors"] = (len(page_errors) + len(console_errors)) - err_before
            try:
                page.screenshot(path=str(SHOTS / ("game_%d_end.png" % seed)))
            except Exception:
                pass
            games.append(g)
            print("seed=%d %s steps=%s wall=%ss score=%s-%s ended=%s anomalies=%d newErrors=%d" % (
                seed, "[OK]" if (g.get("ended") and not g.get("anomalies") and g.get("newErrors", 0) == 0) else "[NG]",
                g.get("steps"), g.get("wall"),
                (g.get("final") or {}).get("home"), (g.get("final") or {}).get("away"),
                g.get("ended"), len(g.get("anomalies", []) or []), g.get("newErrors", 0)))
        browser.close()

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    out = {
        "ts": ts, "games": GAMES, "turbo": TURBO,
        "pageErrors": page_errors, "consoleErrors": console_errors,
        "results": games,
    }
    jpath = LOGS / ("random_games_%s.json" % ts)
    jpath.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    (LOGS / "latest.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    # 人間/レビュー用 要約
    lines = ["# ランダム10試合 E2E ログ要約 (%s)" % ts, ""]
    lines.append("- 試合数: %d / turbo: %s / pageError: %d / consoleError: %d" % (GAMES, TURBO, len(page_errors), len(console_errors)))
    ng = 0
    for g in games:
        ok = g.get("ended") and not g.get("anomalies") and g.get("newErrors", 0) == 0 and not g.get("loadError") and not g.get("driveError")
        if not ok:
            ng += 1
        fin = g.get("final") or {}
        lines.append("- seed=%s %s 終了=%s 得点=%s-%s steps=%s 異常=%s err=%s %s%s" % (
            g.get("seed"), "[OK]" if ok else "[NG]", g.get("ended"),
            fin.get("home"), fin.get("away"), g.get("steps"),
            len(g.get("anomalies", []) or []), g.get("newErrors", 0),
            ("load:" + g["loadError"]) if g.get("loadError") else "",
            ("drive:" + g["driveError"]) if g.get("driveError") else ""))
        for a in (g.get("anomalies") or [])[:5]:
            lines.append("    - 異常: " + a)
    lines.append("")
    lines.append("- 総合: %s （NG %d / %d）" % ("ALL OK" if ng == 0 else "要確認", ng, GAMES))
    if page_errors:
        lines.append("- pageError 例: " + " | ".join(page_errors[:5]))
    if console_errors:
        lines.append("- consoleError 例: " + " | ".join(console_errors[:5]))
    lines.append("")
    lines.append("詳細(全システムログ)は同名 .json / latest.json を参照。")
    md = "\n".join(lines)
    (LOGS / ("random_games_%s.md" % ts)).write_text(md, encoding="utf-8")
    (LOGS / "latest.md").write_text(md, encoding="utf-8")

    print("\n==== 出力 ====")
    print("  " + str(jpath))
    print("  " + str(LOGS / "latest.json") + " / " + str(LOGS / "latest.md"))
    print("  スクショ: " + str(SHOTS))
    print(("[OK] ALL OK" if ng == 0 else "[NG] 要確認 NG=%d" % ng) + " / pageError=%d consoleError=%d" % (len(page_errors), len(console_errors)))
    return 0 if (ng == 0 and not page_errors and not console_errors) else 1


if __name__ == "__main__":
    sys.exit(main())
