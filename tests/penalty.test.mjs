/**
 * tests/penalty.test.mjs
 * 反則ロジック（rollPrePenalty / rollPlayPenalty）の純粋関数テスト。
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

// 低乱数では反則なし（テスト安定の保証）
assert("pre: random=0 で反則なし", BG.rollPrePenalty({ random: 0 }) === null);
assert("play: random=0 で反則なし", BG.rollPlayPenalty({ random: 0 }) === null);

// 高乱数で反則発生・種別分岐
var pre1 = BG.rollPrePenalty({ random: 0.99, random2: 0.1 });
assert("pre: 高乱数+r2<0.5 で攻撃フォルススタート", pre1 && pre1.team === "off" && pre1.type === "falseStart" && pre1.yards === 5);
var pre2 = BG.rollPrePenalty({ random: 0.99, random2: 0.6 });
assert("pre: r2 0.5-0.8 で守備オフサイド", pre2 && pre2.team === "def" && pre2.type === "offside");

var p1 = BG.rollPlayPenalty({ random: 0.99, random2: 0.1 });
assert("play: r2<0.3 で攻撃ホールディング(-10・自動FDなし)", p1 && p1.team === "off" && p1.yards === 10 && p1.autoFirst === false);
var p2 = BG.rollPlayPenalty({ random: 0.99, random2: 0.4 });
assert("play: 守備ホールディング(+5・自動FD)", p2 && p2.team === "def" && p2.autoFirst === true);
var p3 = BG.rollPlayPenalty({ random: 0.99, random2: 0.6 });
assert("play: 守備パスインターフェア(+15・自動FD)", p3 && p3.type === "defPI" && p3.yards === 15 && p3.autoFirst === true);
var p4 = BG.rollPlayPenalty({ random: 0.99, random2: 0.95 });
assert("play: アンネセサリーラフネス(+15・自動FD)", p4 && p4.type === "roughness" && p4.autoFirst === true);

console.log("");
if (failed === 0) { console.log("全テスト [OK]"); process.exit(0); }
else { console.error(failed + " 件のテストが [NG]"); process.exit(1); }
