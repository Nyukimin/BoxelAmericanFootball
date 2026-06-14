/**
 * tests/fumble.test.mjs
 * ファンブル純粋関数のユニットテスト。
 * 全件 [OK] なら 0 終了、失敗があれば 1 終了。
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// gamelogic.js は window.BoxelGame を設定するので global.window を準備する
global.window = global;

const code = readFileSync(resolve(__dirname, "../gamelogic.js"), "utf8");
new Function(code)();

const BG = global.window.BoxelGame;

let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log("[OK] " + label);
  } else {
    console.error("[NG] " + label);
    failed++;
  }
}

const N = 100000;

// ------------------------------------------------------------
// 1. fumbleProbability: power 高いほど確率が低い
// ------------------------------------------------------------
var pHigh = BG.fumbleProbability(9);
var pLow  = BG.fumbleProbability(4);
assert("fumbleProbability(9) < fumbleProbability(4)", pHigh < pLow);

// ------------------------------------------------------------
// 2. fumbleProbability: 戻り値が [0.015, 0.10] の範囲内
// ------------------------------------------------------------
var pPower1  = BG.fumbleProbability(1);
var pPower10 = BG.fumbleProbability(10);
assert("fumbleProbability(1) は 0.10 以下", pPower1 <= 0.10);
assert("fumbleProbability(1) は 0.015 以上", pPower1 >= 0.015);
assert("fumbleProbability(10) は 0.10 以下", pPower10 <= 0.10);
assert("fumbleProbability(10) は 0.015 以上", pPower10 >= 0.015);

// ------------------------------------------------------------
// 3. fumbleCheck 大数: power=6 の実測ファンブル率が fumbleProbability(6) の ±0.01 以内
// ------------------------------------------------------------
var expectedRate6 = BG.fumbleProbability(6);
var fumbleCount6  = 0;
for (var i = 0; i < N; i++) {
  if (BG.fumbleCheck({ power: 6 }).fumble === true) fumbleCount6++;
}
var actualRate6 = fumbleCount6 / N;
assert(
  "fumbleCheck(power=6) 大数: 実測率が fumbleProbability(6) の ±0.01 以内",
  Math.abs(actualRate6 - expectedRate6) <= 0.01
);

// ------------------------------------------------------------
// 4. fumbleCheck 大数: power=4 の実測率 > power=9 の実測率
// ------------------------------------------------------------
var fumbleCount4 = 0;
var fumbleCount9 = 0;
for (var j = 0; j < N; j++) {
  if (BG.fumbleCheck({ power: 4 }).fumble === true) fumbleCount4++;
  if (BG.fumbleCheck({ power: 9 }).fumble === true) fumbleCount9++;
}
var actualRate4 = fumbleCount4 / N;
var actualRate9 = fumbleCount9 / N;
assert(
  "fumbleCheck 大数: power=4 の実測ファンブル率 > power=9 の実測ファンブル率",
  actualRate4 > actualRate9
);

// ------------------------------------------------------------
// 5. ファンブル発生時の相手リカバー率が約 0.5（0.45〜0.55）
// ------------------------------------------------------------
var fumbleTotal    = 0;
var recoverTotal   = 0;
for (var k = 0; k < N; k++) {
  var res = BG.fumbleCheck({ power: 4, opponentRecoverRate: 0.5 });
  if (res.fumble === true) {
    fumbleTotal++;
    if (res.lostToOpponent === true) recoverTotal++;
  }
}
var recoverRate = (fumbleTotal > 0) ? (recoverTotal / fumbleTotal) : 0;
assert(
  "ファンブル発生時の相手リカバー率が 0.45〜0.55 の範囲内",
  recoverRate >= 0.45 && recoverRate <= 0.55
);

// ------------------------------------------------------------
// 6. fumble===false のとき lostToOpponent は必ず false（大数で確認）
// ------------------------------------------------------------
var inconsistentCount = 0;
for (var m = 0; m < N; m++) {
  var r = BG.fumbleCheck({ power: 9 });
  if (r.fumble === false && r.lostToOpponent === true) inconsistentCount++;
}
assert(
  "fumble===false のとき lostToOpponent は必ず false（大数で確認）",
  inconsistentCount === 0
);

// ------------------------------------------------------------
// 終了
// ------------------------------------------------------------
console.log("");
if (failed === 0) {
  console.log("全テスト [OK]");
  process.exit(0);
} else {
  console.error(failed + " 件のテストが [NG]");
  process.exit(1);
}
