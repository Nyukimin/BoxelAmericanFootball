/**
 * tests/specialteams.test.mjs
 * 特殊チームの純粋関数テスト。
 * 全件 [OK] なら 0 終了、失敗があれば 1 終了。
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

// ============================================================
// kickoffResult
// ============================================================
var kr0 = BG.kickoffResult({ random: 0 });
assert("kickoffResult(0): kind=touchback", kr0.kind === "touchback");
assert("kickoffResult(0): yards=25", kr0.yards === 25);

var kr1 = BG.kickoffResult({ random: 0.6 });
assert("kickoffResult(0.6): kind=fairCatch", kr1.kind === "fairCatch");
assert("kickoffResult(0.6): yards=25", kr1.yards === 25);

var kr2 = BG.kickoffResult({ random: 0.90 });
assert("kickoffResult(0.90): kind=return", kr2.kind === "return");
assert("kickoffResult(0.90): yards in [20,35]", kr2.yards >= 20 && kr2.yards <= 35);

var kr3 = BG.kickoffResult({ random: 0.99 });
assert("kickoffResult(0.99): kind=bigReturn", kr3.kind === "bigReturn");
assert("kickoffResult(0.99): yards in [35,45]", kr3.yards >= 35 && kr3.yards <= 45);

var touchbackCount = 0, N = 10000;
for (var i = 0; i < N; i++) {
  if (BG.kickoffResult({}).kind === "touchback") touchbackCount++;
}
var tbRate = touchbackCount / N;
assert("kickoffResult 大数: touchback率 50-60%", tbRate >= 0.50 && tbRate <= 0.60);

// ============================================================
// onsideRecovered
// ============================================================
assert("onsideRecovered(random=0.10): true", BG.onsideRecovered({ random: 0.10 }) === true);
assert("onsideRecovered(random=0.20): false", BG.onsideRecovered({ random: 0.20 }) === false);
assert("onsideRecovered(random=0.00): true", BG.onsideRecovered({ random: 0.00 }) === true);
assert("onsideRecovered(random=0.15): false (境界)", BG.onsideRecovered({ random: 0.15 }) === false);

var onsideOk = 0;
for (var j = 0; j < N; j++) {
  if (BG.onsideRecovered({})) onsideOk++;
}
var onsideRate = onsideOk / N;
assert("onsideRecovered 大数: 成功率 12-18%", onsideRate >= 0.12 && onsideRate <= 0.18);

// ============================================================
// puntReturn
// ============================================================
var pr0 = BG.puntReturn({ random: 0.10 });
assert("puntReturn(0.10): kind=fairCatch", pr0.kind === "fairCatch");
assert("puntReturn(0.10): yards=0", pr0.yards === 0);

var pr1 = BG.puntReturn({ random: 0.70 });
assert("puntReturn(0.70): kind=return", pr1.kind === "return");
assert("puntReturn(0.70): yards in [2,14]", pr1.yards >= 2 && pr1.yards <= 14);

var fcCount = 0;
for (var k = 0; k < N; k++) {
  if (BG.puntReturn({}).kind === "fairCatch") fcCount++;
}
var fcRate = fcCount / N;
assert("puntReturn 大数: fairCatch率 30-40%", fcRate >= 0.30 && fcRate <= 0.40);

// ============================================================
// 終了
// ============================================================
console.log("");
if (failed === 0) {
  console.log("全テスト [OK]");
  process.exit(0);
} else {
  console.error(failed + " 件のテストが [NG]");
  process.exit(1);
}
