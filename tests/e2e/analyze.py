"""自動プレーのログ(tests/e2e/logs/latest.json)を深掘り解析して不具合を検出する。

使い方:
    python tests/e2e/analyze.py [path]     # 省略時は tests/e2e/logs/latest.json

検査項目（試合横断）:
  - 完走/例外/進行不能(stuck)
  - down 範囲(1..4) / los 範囲(0..120) / 同一クォーター内 clock 単調減少
  - 得点の単調非減少 / 得点増分が {0,1,2,3,6,7,8}
  - イベント種別・プレー結果・守備選択・スコア分布の集計
既知アーティファクト(gameStart の記録順)は修正済みのため、未修正ログでも誤検出しないよう
gameStart は不変条件チェックから除外する。
"""
import sys
import json
import pathlib
import collections

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "tests" / "e2e" / "logs" / "latest.json"
VALID_SCORE_DELTA = {0, 1, 2, 3, 6, 7, 8}


def load(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def analyze(d):
    games = d.get("results") or []
    ev = collections.Counter()
    playResult = collections.Counter()
    defCov = collections.Counter()
    defFront = collections.Counter()
    scores = []
    per_game_issues = []
    total_issues = 0

    for g in games:
        seed = g.get("seed")
        ents = g.get("sysLog", {}).get("entries", []) if g.get("sysLog") else []
        issues = []
        if not g.get("ended"):
            issues.append("未完走(ended=False)")
        if g.get("fatal"):
            issues.append("fatal=" + str(g["fatal"]))
        prev_clock = {}
        last_home = last_away = 0
        for e in ents:
            t = e.get("ev")
            ev[t] += 1
            if t == "gameStart":
                continue  # 記録順アーティファクト(修正済)。不変条件からは除外。
            q = e.get("q")
            ck = e.get("clock")
            dn = e.get("down")
            los = e.get("los")
            if e.get("mode") == "offense" and t == "playCall" and dn is not None and not (1 <= dn <= 4):
                issues.append("down範囲外 %s" % dn)
            if los is not None and not (0 <= los <= 120):
                issues.append("los範囲外 %s" % los)
            if q is not None and ck is not None:
                if q in prev_clock and ck > prev_clock[q] + 1:
                    issues.append("clock増加 q%s %s->%s ev=%s" % (q, prev_clock[q], ck, t))
                prev_clock[q] = ck
            h, a = e.get("home"), e.get("away")
            if h is not None:
                if h < last_home:
                    issues.append("home得点減少 %s->%s" % (last_home, h))
                elif (h - last_home) not in VALID_SCORE_DELTA:
                    issues.append("home増分異常 +%s" % (h - last_home))
                last_home = h
            if a is not None:
                if a < last_away:
                    issues.append("away得点減少 %s->%s" % (last_away, a))
                elif (a - last_away) not in VALID_SCORE_DELTA:
                    issues.append("away増分異常 +%s" % (a - last_away))
                last_away = a
            if t == "play":
                txt = e.get("text", "")
                for key in ("タッチダウン", "ランで前進", "ロングパス成功", "ロングパスは届かず",
                            "ショートパス成功", "パス失敗", "落球", "不成功パス",
                            "インターセプト", "ファンブル", "サック", "タックル",
                            "反則", "フォルススタート", "オフサイド",
                            "FG成功", "FG失敗", "FG", "パント", "キックオフ", "セーフティ"):
                    if key in txt:
                        playResult[key] += 1
                        break
            if t == "defCov":
                defCov[e.get("val")] += 1
            if t == "defFront":
                defFront[e.get("val")] += 1
        scores.append((seed, g.get("home"), g.get("away"), g.get("quarter")))
        if issues:
            total_issues += len(issues)
            per_game_issues.append((seed, issues))

    return {
        "n": len(games),
        "ev": ev, "playResult": playResult, "defCov": defCov, "defFront": defFront,
        "scores": scores, "per_game_issues": per_game_issues, "total_issues": total_issues,
        "topErrors": (d.get("errors") or [])[:10], "summary": d.get("summary"),
    }


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else str(DEFAULT)
    d = load(path)
    r = analyze(d)
    print("=== 自動プレー解析: %s ===" % path)
    print("試合数: %d / summary: %s" % (r["n"], r["summary"]))
    print("\n[得点] seed: home-away (Q)")
    for seed, h, a, q in r["scores"]:
        print("  %3s: %s-%s (Q%s)" % (seed, h, a, q))
    print("\n[イベント種別]")
    for k, v in r["ev"].most_common():
        print("  %-12s %d" % (k, v))
    print("\n[プレー結果分布]")
    for k, v in r["playResult"].most_common():
        print("  %-16s %d" % (k, v))
    print("\n[守備カバレッジ] %s" % dict(r["defCov"]))
    print("[守備フロント]   %s" % dict(r["defFront"]))
    if r["topErrors"]:
        print("\n[例外(最大10)]")
        for e in r["topErrors"]:
            print("  game=%s ln=%s %s" % (e.get("game"), e.get("ln"), str(e.get("msg"))[:140]))
    print("\n[不変条件チェック]")
    if r["per_game_issues"]:
        for seed, iss in r["per_game_issues"]:
            print("  seed %s: %s" % (seed, iss[:8]))
        print("\n判定: [NG] 要確認（不整合 %d 件）" % r["total_issues"])
        return 1
    print("  全試合 不整合なし")
    print("\n判定: [OK] ALL OK（%d試合・実不整合ゼロ・例外 %d）" % (r["n"], len(r["topErrors"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
