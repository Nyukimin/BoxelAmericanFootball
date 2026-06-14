/**
 * tests/fg.test.mjs
 * FGミニゲーム純粋関数のユニットテスト。
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

// ------------------------------------------------------------
// 1. fgAngleWindow: 中央(xb=0) では left<0<right（対称的に窓が開く）
// ------------------------------------------------------------
var win0 = BG.fgAngleWindow(0, 40);
assert("fgAngleWindow(0,40): left < 0", win0.left < 0);
assert("fgAngleWindow(0,40): right > 0", win0.right > 0);
assert("fgAngleWindow(0,40): left < right", win0.left < win0.right);

// ------------------------------------------------------------
// 2. ボールが左(xb=-10)のとき、窓が正側に片寄る
//    - right > 0
//    - left も xb=0 のときより大きい（右にシフト）
// ------------------------------------------------------------
var winLeft = BG.fgAngleWindow(-10, 40);
assert("fgAngleWindow(-10,40): right > 0（正側に片寄り）", winLeft.right > 0);
assert("fgAngleWindow(-10,40): left > fgAngleWindow(0,40).left（窓が正方向にシフト）", winLeft.left > win0.left);
assert("fgAngleWindow(-10,40): left < right", winLeft.left < winLeft.right);

// ------------------------------------------------------------
// 3. fgResolve: 中央狙い（xb=0, zb=90, kickStat=9, power=1.0, aim=0）→ success=true
// ------------------------------------------------------------
var res3 = BG.fgResolve({ aim: 0, power: 1.0, xb: 0, zb: 90, kickStat: 9 });
assert("fgResolve 中央狙い(xb=0): success === true", res3.success === true);
assert("fgResolve 中央狙い(xb=0): reason === 'good'", res3.reason === "good");

// ------------------------------------------------------------
// 4. オフセット(xb=-10)で aim=0（真っ直ぐ）は wideLeft で外す
// ------------------------------------------------------------
var res4 = BG.fgResolve({ aim: 0, power: 1.0, xb: -10, zb: 90, kickStat: 9 });
assert("fgResolve オフセット aim=0(xb=-10): success === false", res4.success === false);
assert("fgResolve オフセット aim=0(xb=-10): reason === 'wideLeft'", res4.reason === "wideLeft");

// ------------------------------------------------------------
// 5. 同条件でゴール中心へ狙えば入る
// ------------------------------------------------------------
var center5 = BG.fgAimSwing(-10, 90).center;
var res5 = BG.fgResolve({ aim: center5, power: 1.0, xb: -10, zb: 90, kickStat: 9 });
assert("fgResolve ゴール中心狙い(xb=-10): success === true", res5.success === true);
assert("fgResolve ゴール中心狙い(xb=-10): reason === 'good'", res5.reason === "good");

// ------------------------------------------------------------
// 6. 飛距離不足: zb=40, kickStat=3, power=0.2 → reason === "short"
// ------------------------------------------------------------
var center6 = BG.fgAimSwing(0, 40).center;
var res6 = BG.fgResolve({ aim: center6, power: 0.2, xb: 0, zb: 40, kickStat: 3 });
assert("fgResolve 飛距離不足: success === false", res6.success === false);
assert("fgResolve 飛距離不足: reason === 'short'", res6.reason === "short");

// ------------------------------------------------------------
// 7. fgReach: kickStat 単調増加
// ------------------------------------------------------------
assert("fgReach(9) > fgReach(3)", BG.fgReach(9) > BG.fgReach(3));
assert("fgReach(10) > fgReach(1)", BG.fgReach(10) > BG.fgReach(1));

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
