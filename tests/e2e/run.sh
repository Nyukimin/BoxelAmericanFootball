#!/usr/bin/env bash
# ボクセル・フットボール E2E 実行スクリプト。
# 使い方（通常のターミナル＝Terminal.app / iTerm で）:
#   bash tests/e2e/run.sh
#
# 注意: Claude Code の `!` 経由では Chromium がサンドボックスで起動できないため、
#       必ず普通のターミナルで実行すること。
set -e

# このスクリプトの場所からプロジェクトルートへ移動
cd "$(dirname "$0")/../.."

echo "== 単体テスト（純粋ロジック36件） =="
node tests/run.mjs

echo
echo "== E2E（ブラウザ・スモークテスト） =="
python tests/e2e/run_e2e.py

echo
echo "完了。スクショは tests/e2e/screenshots/ を確認してください。"
