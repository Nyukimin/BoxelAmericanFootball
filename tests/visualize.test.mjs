/**
 * tests/visualize.test.mjs
 * 1プレー可視化 純粋ロジックのユニットテスト。
 * 全件 [OK] なら exit 0、失敗があれば exit 1。
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

global.window = global;

const code = readFileSync(resolve(__dirname, "../gamelogic.js"), "utf8");
new Function(code)();

const BG = global.window.BoxelGame;

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition === true) {
    console.log("[OK] " + label);
    passed += 1;
  } else {
    console.log("[NG] " + label);
    failed += 1;
  }
}

function assertEq(label, actual, expected) {
  if (actual === expected) {
    console.log("[OK] " + label);
    passed += 1;
  } else {
    console.log("[NG] " + label + " (expected=" + expected + ", actual=" + actual + ")");
    failed += 1;
  }
}

function assertClose(label, actual, expected, eps) {
  var e = eps !== undefined ? eps : 1e-9;
  if (Math.abs(actual - expected) <= e) {
    console.log("[OK] " + label);
    passed += 1;
  } else {
    console.log("[NG] " + label + " (expected=" + expected + ", actual=" + actual + ")");
    failed += 1;
  }
}

// --- nearestDefenderIndex ---

// 複数配置で最も近い守備の index を返す
(function () {
  var carrier = { x: 0, z: 0 };
  var defenders = [
    { x: 10, z: 0 },  // dist2 = 100
    { x: 3,  z: 4 },  // dist2 = 25  <- nearest
    { x: 5,  z: 5 }   // dist2 = 50
  ];
  var idx = BG.nearestDefenderIndex(carrier, defenders);
  assertEq("nearestDefenderIndex: 複数配置で index 1 が最近傍", idx, 1);
})();

// 別の配置でも正しい index を返す
(function () {
  var carrier = { x: 5, z: 5 };
  var defenders = [
    { x: 0,  z: 0  },  // dist2 = 50
    { x: 10, z: 10 },  // dist2 = 50
    { x: 5,  z: 7  }   // dist2 = 4  <- nearest
  ];
  var idx = BG.nearestDefenderIndex(carrier, defenders);
  assertEq("nearestDefenderIndex: 別配置で index 2 が最近傍", idx, 2);
})();

// defenders 空配列で -1
(function () {
  var carrier = { x: 0, z: 0 };
  var idx = BG.nearestDefenderIndex(carrier, []);
  assertEq("nearestDefenderIndex: defenders 空配列で -1", idx, -1);
})();

// --- lineClashShift ---

// olPower=9, dlPower=3 で正の値
(function () {
  var shift = BG.lineClashShift(9, 3, 2);
  assert("lineClashShift: olPower>dlPower で正の値", shift > 0);
})();

// olPower=3, dlPower=9 で負の値
(function () {
  var shift = BG.lineClashShift(3, 9, 2);
  assert("lineClashShift: olPower<dlPower で負の値", shift < 0);
})();

// 等しいと 0
(function () {
  var shift = BG.lineClashShift(6, 6, 2);
  assertClose("lineClashShift: olPower===dlPower で 0", shift, 0);
})();

// 差が大きいとき絶対値が maxShift にクランプ（maxShift=2 で 2 を超えない）
(function () {
  var shift = BG.lineClashShift(100, 1, 2);
  assert("lineClashShift: 大差・正方向でクランプ (<=2)", Math.abs(shift) <= 2 + 1e-9);
  assertClose("lineClashShift: 大差・正方向で maxShift に等しい", shift, 2);
})();

(function () {
  var shift = BG.lineClashShift(1, 100, 2);
  assert("lineClashShift: 大差・負方向でクランプ (>=-2)", Math.abs(shift) <= 2 + 1e-9);
  assertClose("lineClashShift: 大差・負方向で -maxShift に等しい", shift, -2);
})();

// --- pursuitTarget ---

// t=0 で defender と一致
(function () {
  var defender = { x: 1, z: 2 };
  var carrier  = { x: 7, z: 9 };
  var result = BG.pursuitTarget(defender, carrier, 0);
  assertClose("pursuitTarget: t=0 で x が defender.x と一致", result.x, defender.x);
  assertClose("pursuitTarget: t=0 で z が defender.z と一致", result.z, defender.z);
})();

// t=1 で carrier と一致
(function () {
  var defender = { x: 1, z: 2 };
  var carrier  = { x: 7, z: 9 };
  var result = BG.pursuitTarget(defender, carrier, 1);
  assertClose("pursuitTarget: t=1 で x が carrier.x と一致", result.x, carrier.x);
  assertClose("pursuitTarget: t=1 で z が carrier.z と一致", result.z, carrier.z);
})();

// t=0.5 で中点
(function () {
  var defender = { x: 0, z: 0 };
  var carrier  = { x: 8, z: 4 };
  var result = BG.pursuitTarget(defender, carrier, 0.5);
  assertClose("pursuitTarget: t=0.5 で x が中点 4", result.x, 4);
  assertClose("pursuitTarget: t=0.5 で z が中点 2", result.z, 2);
})();

// t=2 でも carrier 止まり（クランプ）
(function () {
  var defender = { x: 1, z: 2 };
  var carrier  = { x: 7, z: 9 };
  var result = BG.pursuitTarget(defender, carrier, 2);
  assertClose("pursuitTarget: t=2 でクランプされ x が carrier.x", result.x, carrier.x);
  assertClose("pursuitTarget: t=2 でクランプされ z が carrier.z", result.z, carrier.z);
})();

// --- 結果サマリ ---
console.log("\n========================================");
console.log((failed === 0 ? "[OK] " : "[NG] ") + passed + "/" + (passed + failed) + " 件成功");
process.exit(failed === 0 ? 0 : 1);
