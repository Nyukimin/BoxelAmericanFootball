# E2E テスト手順

## 結論: 実ブラウザ検証は「ページ内 自動プレー」を使う

このMac（Apple Silicon）では Playwright/Chromium が起動時にクラッシュする（`signal 10 BUS_ADRALN` /
`Target page closed`）。`tests/e2e/random_games.py` ・`run_e2e.py` は環境依存で不安定なため、実ブラウザ検証は
**ページ自身が自動プレーする方式**（`index.html` 内 `autoPlay()`）を正とする。

### 使い方（あなたの普段のブラウザでOK）

1. ファイルを直接開く（どちらでも可）:
   - Finder で `index.html` をダブルクリック、または
   - ターミナルで:
     ```
     open "/Users/yukimikawaguchi/Documents/BoxelAmericanFootball/index.html?autoplay=10"
     ```
   `?autoplay=10` を付けると、開いた瞬間に **seed=1..10 の10試合を自動でランダムプレー**する。
2. 画面の吹き出しが「自動プレー中… n/10」→「完了」に変わるまで待つ（turbo短縮で数十秒程度）。
3. 完了時に **`baf_autoplay.json`** がダウンロードフォルダ（`~/Downloads`）に保存される。
4. 「終わった」と伝えてくれれば、こちらが `~/Downloads/baf_autoplay.json` を読んで全試合を解析する。

URLを付けずに開いた場合でも、コンソールで `__BoxelTest.autoPlay(10)` を実行すれば同じことができる。

### baf_autoplay.json の中身
- `summary` … `{ng, total, errors}`（NG試合数・総試合・例外数）
- `errors[]` … 実行中に捕捉した例外（`window.onerror` ＋カード/タップ操作の try-catch）
- `results[]` … 各試合 `{seed, steps, ended, home, away, quarter, anomalies[], newErrors, sysLog}`
  - `anomalies` … down範囲外・clock増加などの軽い不変条件違反
  - `sysLog` … 構造化システムログ（seed＋同操作で100%再現可能）

各試合は seed で再現できるので、不具合が出たら同じ seed を再現モードに入れて追える。

## 単体テスト（純粋ロジック・サンドボックス内で実行可）
```
node tests/run.mjs        # 純粋ロジック単体テスト
node tests/headless/flow.mjs   # THREE/DOMモックで本体フロー統合テスト
node tests/e2e/user_sim.mjs    # ユーザー視点シミュレーション（seed 1..10 invariant検証）
```

## （参考・非推奨）Playwright スクリプト
`run_e2e.py` / `random_games.py` は環境が許せば動くが、本機ではクラッシュするため当てにしない。
