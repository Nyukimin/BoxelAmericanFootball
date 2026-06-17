/**
 * tests/depth.test.mjs
 * sackChance / staminaFactor の純粋関数テスト。
 * 実行: node tests/depth.test.mjs
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
function assert(label, cond) {
  if (cond) { console.log("[OK] " + label); }
  else { console.error("[NG] " + label); failed++; }
}

// ------------------------------------------------------------
// sackChance
// ------------------------------------------------------------
assert("sackChance: olPower高(9)はolPower低(3)より確率が低い",
  BG.sackChance({ olPower: 9, dPower: 6 }) < BG.sackChance({ olPower: 3, dPower: 6 }));
assert("sackChance: dPower高(9)はdPower低(3)より確率が高い",
  BG.sackChance({ olPower: 6, dPower: 9 }) > BG.sackChance({ olPower: 6, dPower: 3 }));
assert("sackChance: 下限0.03以上",
  BG.sackChance({ olPower: 10, dPower: 1 }) >= 0.03);
assert("sackChance: 上限0.30以下",
  BG.sackChance({ olPower: 1, dPower: 10 }) <= 0.30);
assert("sackChance: 未指定は中立値(0.03〜0.30内)",
  BG.sackChance({}) >= 0.03 && BG.sackChance({}) <= 0.30);

// サックは _rng()=0 では発火しない（後方互換）
Math.random = () => 0;
const o0 = BG.outcome("single", "short", { olPower: 1, dPower: 10 });
assert("サック: _rng()=0 では発火しない(short)", o0.reason !== "sack");
const o1 = BG.outcome("single", "long", { olPower: 1, dPower: 10 });
assert("サック: _rng()=0 では発火しない(long)", o1.reason !== "sack");

// サックは高乱数で発火する
Math.random = () => 0.9999;
let sackFound = false;
for (let i = 0; i < 20; i++) {
  const r = BG.outcome("single", "short", { olPower: 1, dPower: 10 });
  if (r.reason === "sack") { sackFound = true; break; }
}
assert("サック: 高乱数で発火する", sackFound);

// サック時の属性確認
Math.random = () => 0.9999;
let sackResult = null;
for (let i = 0; i < 20; i++) {
  const r = BG.outcome("single", "short", {});
  if (r.reason === "sack") { sackResult = r; break; }
}
assert("サック: yards < 0", sackResult !== null && sackResult.yards < 0);
assert("サック: complete === true", sackResult !== null && sackResult.complete === true);
assert("サック: turnover === false", sackResult !== null && sackResult.turnover === false);

// ------------------------------------------------------------
// staminaFactor
// ------------------------------------------------------------
assert("staminaFactor: 満タン(current=max)は1.0",
  BG.staminaFactor({ current: 8, max: 8 }) === 1.0);
assert("staminaFactor: 空(current=0)は0.7",
  BG.staminaFactor({ current: 0, max: 8 }) === 0.7);
assert("staminaFactor: 半分は0.85",
  BG.staminaFactor({ current: 4, max: 8 }) === 0.85);
assert("staminaFactor: 未設定は1.0(current=1,max=1)",
  BG.staminaFactor({}) === 1.0);
assert("staminaFactor: max=0 は 1.0(ゼロ除算ガード)",
  BG.staminaFactor({ current: 0, max: 0 }) === 1.0);
assert("staminaFactor: 範囲[0.7, 1.0]",
  BG.staminaFactor({ current: 5, max: 8 }) >= 0.7 && BG.staminaFactor({ current: 5, max: 8 }) <= 1.0);

console.log("");
if (failed === 0) { console.log("全テスト [OK]"); process.exit(0); }
else { console.error(failed + " 件のテストが [NG]"); process.exit(1); }
