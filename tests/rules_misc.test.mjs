/**
 * tests/rules_misc.test.mjs
 * 追加ルールの純粋関数テスト（rollPassFoul / turnoverReturn）。
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
global.window = global;
new Function(readFileSync(resolve(__dirname, "../gamelogic.js"), "utf8"))();
const BG = global.window.BoxelGame;

let failed = 0;
function assert(label, cond) { if (cond) { console.log("[OK] " + label); } else { console.error("[NG] " + label); failed++; } }

// ===== rollPassFoul =====
// 低乱数では反則なし（Math.random=0 固定テストに影響させない）
assert("passFoul: random=0 で反則なし", BG.rollPassFoul({ play: "short", complete: false, random: 0 }) === null);
assert("passFoul: ラン/キックでは null（パス以外は対象外）", BG.rollPassFoul({ play: "run", random: 0.99 }) === null);

// 高乱数で発生・種別分岐
var gf = BG.rollPassFoul({ play: "long", complete: false, random: 0.99, random2: 0.1 });
assert("passFoul: 不成功+r2<0.34 でグラウンディング(ロスオブダウン)",
  gf && gf.type === "grounding" && gf.lossOfDown === true && gf.yards > 0);
// 成功パスでは grounding を出さない（次の分岐 ineligible になる）
var gf2 = BG.rollPassFoul({ play: "long", complete: true, random: 0.99, random2: 0.1 });
assert("passFoul: 成功パスでは grounding にならない", gf2 && gf2.type !== "grounding");
var inel = BG.rollPassFoul({ play: "short", complete: true, random: 0.99, random2: 0.5 });
assert("passFoul: r2 0.34-0.67 でイリジブル(-5・ダウンやり直し)",
  inel && inel.type === "ineligible" && inel.yards === 5 && inel.lossOfDown === false);
var illf = BG.rollPassFoul({ play: "short", complete: false, random: 0.99, random2: 0.9 });
assert("passFoul: r2>=0.67 でイリーガルフォワード(-5・ロスオブダウン)",
  illf && illf.type === "illegalForward" && illf.yards === 5 && illf.lossOfDown === true);

// ===== turnoverReturn =====
// 高乱数側(r2>0.94)でリターンTD
var trTd = BG.turnoverReturn({ random: 0.5, random2: 0.99 });
assert("turnoverReturn: r2>0.94 でリターンTD・yards大", trTd.td === true && trTd.yards >= 30);
// 通常リターン（td なし）
var trN = BG.turnoverReturn({ random: 0.0, random2: 0.0 });
assert("turnoverReturn: 低乱数では td=false・yards=0", trN.td === false && trN.yards === 0);
var trN2 = BG.turnoverReturn({ random: 1.0, random2: 0.0 });
assert("turnoverReturn: random=1 で yards=22（上限付近）", trN2.td === false && trN2.yards === 22);

console.log("");
if (failed === 0) { console.log("全テスト [OK]"); process.exit(0); }
else { console.error(failed + " 件のテストが [NG]"); process.exit(1); }
