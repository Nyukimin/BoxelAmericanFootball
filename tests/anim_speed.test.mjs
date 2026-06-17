/**
 * tests/anim_speed.test.mjs
 * runDuration（ラン所要時間）純粋ロジックのユニットテスト。
 * 走速を現実的範囲(人間の限界・約27mph=約12.4yd/sを超えない)に抑えることを保証する。
 * 全件 [OK] なら exit 0、失敗があれば exit 1。
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
global.window = global;
new Function(readFileSync(resolve(__dirname, "../gamelogic.js"), "utf8"))();
const BG = global.window.BoxelGame;

let passed = 0, failed = 0;
function assert(label, cond) {
  console.log((cond === true ? "[OK] " : "[NG] ") + label);
  cond === true ? passed++ : failed++;
}

const YD_PER_S_LIMIT = 12.4;   // 約27mph（人類最高速）。走速はこれを超えてはならない。
function speed(yards, sp) { return Math.abs(yards) / BG.runDuration(yards, sp); }

// 1) どんな距離・能力でも走速が人間の限界を超えない（これが本修正の核心）
let maxObserved = 0;
for (const sp of [3, 6, 9, 12]) {
  for (let y = 1; y <= 60; y++) {
    const v = speed(y, sp);
    if (v > maxObserved) maxObserved = v;
  }
}
assert("全距離(1..60yd)×全能力(sp3..12)で走速 <= 12.4 yd/s（人間の限界内）。実測最大=" + maxObserved.toFixed(2),
  maxObserved <= YD_PER_S_LIMIT);

// 2) 旧式(発散)の回帰防止: 40yd 走が 11.5 yd/s 以下（旧式は約15.9 yd/s=32mphだった）
assert("40yd ランの走速 <= 11.5 yd/s（旧式の超人化を防止）。実測=" + speed(40, 6).toFixed(2),
  speed(40, 6) <= 11.5);

// 3) 短距離は遅すぎず（5yd で 3 yd/s 以上、もっさりしない）
assert("5yd ランの走速 >= 3.0 yd/s。実測=" + speed(5, 6).toFixed(2), speed(5, 6) >= 3.0);

// 4) 能力が高いほど速い（同距離で sp9 > sp3）
assert("同距離で speed=9 のほうが speed=3 より速い", speed(20, 9) > speed(20, 3));

// 5) 距離が伸びても所要時間は単調増加（後退しない）
let monotonic = true, prev = -1;
for (let y = 0; y <= 60; y += 5) {
  const d = BG.runDuration(y, 6);
  if (d < prev - 1e-9) monotonic = false;
  prev = d;
}
assert("所要時間は距離に対し単調非減少", monotonic);

// 6) 漸近上限の保証: どんな大入力でも走速は maxSpd(<=12.0) 未満（時間打ち切りで超人化しない）
assert("runDuration(200,12) でも走速 < 12.0 yd/s（漸近上限・キャップ由来の超人化なし）。実測=" + speed(200, 12).toFixed(2),
  speed(200, 12) < 12.0);

// 7) 負ヤード(ロス)も絶対値で時間化し有限値を返す
assert("負ヤードでも有限の正の所要時間", BG.runDuration(-4, 6) > 0 && isFinite(BG.runDuration(-4, 6)));

console.log("\n========================================");
console.log((failed === 0 ? "[OK] " : "[NG] ") + passed + "/" + (passed + failed) + " 件成功");
process.exit(failed === 0 ? 0 : 1);
