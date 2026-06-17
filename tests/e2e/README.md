# E2E テスト手順

## 結論: 実ブラウザ検証は「ページ内 自動プレー」を使う

このMac（Apple Silicon）では Playwright/Chromium が起動時にクラッシュする（`signal 10 BUS_ADRALN` /
`Target page closed`）。`tests/e2e/random_games.py` ・`run_e2e.py` は環境依存で不安定なため、実ブラウザ検証は
**ページ自身が自動プレーする方式**（`index.html` 内 `autoPlay()`）を正とする。

### 使い方A（推奨・ワンコマンドで全自動）

```
cd /Users/yukimikawaguchi/Documents/BoxelAmericanFootball
python tests/e2e/autoplay.py        # 10試合（試合数を変えるなら: python tests/e2e/autoplay.py 5）
```
これだけで:
1. ローカルHTTPサーバが index.html を配信し、
2. あなたの普段のブラウザが自動で開き、
3. seed=1..N をランダム自動プレーし、
4. 結果をサーバへ自動POST → `tests/e2e/logs/latest.json` ＋ `latest.md` に保存して自動終了。

手元のファイル操作は不要。終わったらこちらが `tests/e2e/logs/latest.json` を読む。
（three.js を CDN から読むためネット接続が必要。ブラウザは閉じてOK。）

### 使い方B（サーバ無しで直接開く・フォールバック）

ターミナルで:
```
open "/Users/yukimikawaguchi/Documents/BoxelAmericanFootball/index.html?autoplay=10"
```
開いた瞬間に自動プレーし、完了時に **`baf_autoplay.json`** がダウンロードフォルダ（`~/Downloads`）へ保存される。
コンソールで `__BoxelTest.autoPlay(10)` を直接呼んでもよい。

### baf_autoplay.json の中身
- `summary` … `{ng, total, errors}`（NG試合数・総試合・例外数）
- `errors[]` … 実行中に捕捉した例外（`window.onerror` ＋カード/タップ操作の try-catch）
- `results[]` … 各試合 `{seed, steps, ended, home, away, quarter, anomalies[], newErrors, sysLog}`
  - `anomalies` … down範囲外・clock増加などの軽い不変条件違反
  - `sysLog` … 構造化システムログ（seed＋同操作で100%再現可能）

各試合は seed で再現できるので、不具合が出たら同じ seed を再現モードに入れて追える。

## 大量試合（統計・低頻度バグ探索）はヘッドレスで

実ブラウザの自動プレーは、タブが裏に回ると `requestAnimationFrame`/タイマーが間引かれ
（バックグラウンドtab throttling）大量試合だと激遅になる。**大量試合は Node のヘッドレス
シミュレーション（user_sim）を使う**。ブラウザ不要・throttlingなし・桁違いに高速。

```
GAMES=200  node tests/e2e/user_sim.mjs    # 200試合（約0.5秒）
GAMES=1000 node tests/e2e/user_sim.mjs    # 1000試合（約1.4秒）
```
各 seed で invariant（例外なし/down・quarter範囲/クロック単調/得点単調・増分妥当/必ず試合終了/
味方手前・相手奥）を検証。末尾に「完走 x/N・得点あり y/N・NG z」の集計を出す。

使い分け:
- **実ブラウザ確認（autoplay.py）**: 描画・DOM・実ブラウザ例外の確認。少数（10前後）で十分。
- **大量試合（user_sim GAMES=...）**: ロジックの統計的検証・低頻度バグ探索。数百〜数千。

## 単体テスト（純粋ロジック・サンドボックス内で実行可）
```
node tests/run.mjs             # 純粋ロジック単体テスト
node tests/headless/flow.mjs   # THREE/DOMモックで本体フロー統合テスト
node tests/e2e/user_sim.mjs    # ユーザー視点シミュレーション（既定 seed 1..10 invariant検証）
```

## （参考・非推奨）Playwright スクリプト
`run_e2e.py` / `random_games.py` は環境が許せば動くが、本機ではクラッシュするため当てにしない。
