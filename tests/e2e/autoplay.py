"""ワンコマンドで「実ブラウザ自動プレー」を完結させる。

何をするか:
  1. ローカルHTTPサーバを立て、リポジトリのファイル(index.html等)を配信する。
  2. あなたの「普段のブラウザ」を自動で開く（?autoplay=N で開いた瞬間に自動プレー開始）。
  3. ページが N 試合をランダム自動プレーし、結果(JSON)をこのサーバへ自動POSTする。
  4. サーバが結果を tests/e2e/logs/ に保存し、要約を表示して自動終了する。

Playwright は使わない（本機ではChromiumがクラッシュするため）。普段のブラウザで完結する。

使い方:
    cd /Users/yukimikawaguchi/Documents/BoxelAmericanFootball
    python tests/e2e/autoplay.py            # 10試合
    python tests/e2e/autoplay.py 5          # 5試合
出力:
    tests/e2e/logs/autoplay_<JST>.json  ... 全試合 sysLog＋状態＋例外
    tests/e2e/logs/latest.json          ... 最新（レビュー時に読む）
    tests/e2e/logs/latest.md            ... 人間/レビュー用の要約
"""
import sys
import json
import time
import threading
import webbrowser
import datetime
import pathlib
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = pathlib.Path(__file__).resolve().parents[2]
LOGS = pathlib.Path(__file__).resolve().parent / "logs"
LOGS.mkdir(exist_ok=True)

GAMES = int(sys.argv[1]) if len(sys.argv) > 1 else 10
HOST = "127.0.0.1"
# 1試合 turbo で数秒。試合数に応じてタイムアウトを自動延長（最低5分、+5秒/試合、上限2時間）。
TIMEOUT = min(7200, max(300, GAMES * 5 + 120))

_done = threading.Event()
_result = {"data": None}


class Handler(SimpleHTTPRequestHandler):
    # リポジトリ直下を配信ルートにする
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, *a):
        pass  # アクセスログは抑制

    def do_POST(self):
        if self.path.split("?")[0] == "/__autoplay_result":
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length) if length else b""
            try:
                _result["data"] = json.loads(body.decode("utf-8"))
            except Exception as e:
                _result["data"] = {"parseError": str(e), "raw": body[:500].decode("utf-8", "replace")}
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(b"ok")
            _done.set()
        else:
            self.send_response(404)
            self.end_headers()


def write_outputs(out, ts):
    jpath = LOGS / ("autoplay_%s.json" % ts)
    jpath.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    (LOGS / "latest.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    summ = out.get("summary") or {}
    results = out.get("results") or []
    errors = out.get("errors") or []
    lines = ["# 自動プレー %d試合 ログ要約 (%s)" % (GAMES, ts), ""]
    lines.append("- 総合: %s （NG %s / %s, 例外 %s）" % (
        "ALL OK" if summ.get("ng", 1) == 0 and not errors else "要確認",
        summ.get("ng"), summ.get("total"), summ.get("errors")))
    lines.append("- UA: " + str(out.get("ua", ""))[:120])
    for g in results:
        ok = g.get("ended") and not g.get("fatal") and not g.get("anomalies") and (g.get("newErrors", 0) == 0)
        lines.append("- seed=%s %s 終了=%s 得点=%s-%s steps=%s Q=%s 異常=%s err=%s%s" % (
            g.get("seed"), "[OK]" if ok else "[NG]", g.get("ended"),
            g.get("home"), g.get("away"), g.get("steps"), g.get("quarter"),
            len(g.get("anomalies") or []), g.get("newErrors", 0),
            (" fatal:" + g["fatal"]) if g.get("fatal") else ""))
        for a in (g.get("anomalies") or [])[:5]:
            lines.append("    - 異常: " + str(a))
    if errors:
        lines.append("")
        lines.append("## 例外（最大20件）")
        for e in errors[:20]:
            lines.append("- game=%s ln=%s %s" % (e.get("game"), e.get("ln"), str(e.get("msg"))[:160]))
    md = "\n".join(lines)
    (LOGS / ("autoplay_%s.md" % ts)).write_text(md, encoding="utf-8")
    (LOGS / "latest.md").write_text(md, encoding="utf-8")
    return jpath


def main():
    httpd = ThreadingHTTPServer((HOST, 0), Handler)
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()

    url = "http://%s:%d/index.html?autoplay=%d&post=/__autoplay_result" % (HOST, port, GAMES)
    print("[INFO] サーバ起動: %s" % url)
    print("[INFO] ブラウザを開いて %d 試合を自動プレーします… 完了まで数十秒お待ちください。" % GAMES)
    webbrowser.open(url)

    ok = _done.wait(TIMEOUT)
    time.sleep(0.2)
    httpd.shutdown()

    if not ok or _result["data"] is None:
        print("[NG] タイムアウト/結果未受信（%ds）。ブラウザが開いたか、ネット接続(three.js CDN)を確認してください。" % TIMEOUT)
        return 1

    out = _result["data"]
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    jpath = write_outputs(out, ts)
    summ = out.get("summary") or {}
    print("\n==== 完了 ====")
    print("  " + str(LOGS / "latest.json") + " / " + str(LOGS / "latest.md"))
    ng = summ.get("ng", "?")
    print("  %s  NG=%s/%s  例外=%s" % (
        "[OK] ALL OK" if (ng == 0 and not out.get("errors")) else "[NG] 要確認",
        ng, summ.get("total"), summ.get("errors")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
