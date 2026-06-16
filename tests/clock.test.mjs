/**
 * tests/clock.test.mjs
 * playClockCost 純粋関数のユニットテスト
 * 実行: node tests/clock.test.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
global.window = global;
const code = readFileSync(resolve(__dirname, "../gamelogic.js"), "utf8");
new Function(code)();
const BG = global.window.BoxelGame;

let failed = 0;
function assert(label, condition) {
  if (condition) { console.log("[OK] " + label); }
  else { console.error("[NG] " + label); failed++; }
}

// playClockCost のテスト
assert("run は 40秒消費", BG.playClockCost({ kind: "run" }) === 40);
assert("short_complete は 40秒消費", BG.playClockCost({ kind: "short_complete" }) === 40);
assert("long_complete は 40秒消費", BG.playClockCost({ kind: "long_complete" }) === 40);
assert("incomplete は 6秒消費", BG.playClockCost({ kind: "incomplete" }) === 6);
assert("oob は 6秒消費", BG.playClockCost({ kind: "oob" }) === 6);
assert("score は 6秒消費", BG.playClockCost({ kind: "score" }) === 6);
assert("timeout は 6秒消費", BG.playClockCost({ kind: "timeout" }) === 6);
assert("turnover は 6秒消費", BG.playClockCost({ kind: "turnover" }) === 6);
assert("引数なしは 6秒消費", BG.playClockCost({}) === 6);
assert("未知のkindは 6秒消費", BG.playClockCost({ kind: "unknown_kind" }) === 6);

console.log("");
if (failed === 0) { console.log("全テスト [OK]"); process.exit(0); }
else { console.error(failed + " 件のテストが [NG]"); process.exit(1); }
