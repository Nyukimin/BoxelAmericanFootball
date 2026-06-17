/**
 * tests/gamelogic.test.mjs
 * Node で実行する純粋ロジックテスト。
 * 全件 [OK] なら 0 終了、失敗があれば 1 終了。
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// gamelogic.js は window.BoxelGame を設定するので global.window を準備する
global.window = global;

// gamelogic.js を Function で評価して window.BoxelGame を得る
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
// ユーティリティ
// ------------------------------------------------------------

/**
 * N 回試行して平均ヤードを返す。
 */
function avgYards(formation, play, ctx, N) {
  var total = 0;
  for (var i = 0; i < N; i++) {
    total += BG.outcome(formation, play, ctx).yards;
  }
  return total / N;
}

/**
 * N 回試行してショートパス成功率を返す。
 */
function shortCompleteRate(ctx, N) {
  var ok = 0;
  for (var i = 0; i < N; i++) {
    if (BG.outcome("single", "short", ctx).complete) ok++;
  }
  return ok / N;
}

const N = 100000;

// ------------------------------------------------------------
// 1. ランプレー: speed 高 → 平均ヤード↑
// ------------------------------------------------------------
var runLow  = avgYards("single", "run", { rbSpeed: 4, olPower: 6, wrCatch: 6, wrSpeed: 6, tapedRole: null }, N);
var runHigh = avgYards("single", "run", { rbSpeed: 9, olPower: 6, wrCatch: 6, wrSpeed: 6, tapedRole: null }, N);
assert("ラン: rbSpeed=9 の平均ヤード > rbSpeed=4 の平均ヤード", runHigh > runLow);

// ------------------------------------------------------------
// 2. ショートパス: catch 低 → 成功率↓、かつ catch=4 で 95% 未満
// ------------------------------------------------------------
var catchLow  = shortCompleteRate({ rbSpeed: 6, olPower: 6, wrCatch: 4, wrSpeed: 6, tapedRole: null }, N);
var catchHigh = shortCompleteRate({ rbSpeed: 6, olPower: 6, wrCatch: 9, wrSpeed: 6, tapedRole: null }, N);
assert("ショートパス: wrCatch=9 の成功率 > wrCatch=4 の成功率", catchHigh > catchLow);
assert("ショートパス: wrCatch=4 の成功率 < 0.95", catchLow < 0.95);

// ------------------------------------------------------------
// 3. ランプレー: OL power 高 → 平均ヤード↑
// ------------------------------------------------------------
var runPwrLow  = avgYards("single", "run", { rbSpeed: 6, olPower: 3, wrCatch: 6, wrSpeed: 6, tapedRole: null }, N);
var runPwrHigh = avgYards("single", "run", { rbSpeed: 6, olPower: 9, wrCatch: 6, wrSpeed: 6, tapedRole: null }, N);
assert("ラン: olPower=9 の平均ヤード > olPower=3 の平均ヤード", runPwrHigh > runPwrLow);

// ------------------------------------------------------------
// 4. fgProbability
// ------------------------------------------------------------
// 近距離(los大) > 遠距離(los小)
var fgNear = BG.fgProbability(90, 6);   // dist = (110-90)+17 = 37
var fgFar  = BG.fgProbability(40, 6);   // dist = (110-40)+17 = 87
assert("FG: 近距離(los=90) の確率 > 遠距離(los=40) の確率", fgNear > fgFar);

// kick 高 > kick 低
var fgKickHigh = BG.fgProbability(60, 9);
var fgKickLow  = BG.fgProbability(60, 3);
assert("FG: kickStat=9 の確率 > kickStat=3 の確率", fgKickHigh > fgKickLow);

// 遠距離(los=20)は 0.6 未満
var fgVeryFar = BG.fgProbability(20, 6);  // dist = (110-20)+17 = 107
assert("FG: 遠距離(los=20) の確率 < 0.6", fgVeryFar < 0.6);

// 戻り値が [0.1, 0.95] に収まる
assert("FG: fgProbability は 0.1 以上", fgNear >= 0.1 && fgFar >= 0.1);
assert("FG: fgProbability は 0.95 以下", fgNear <= 0.95 && fgFar <= 0.95);

// ------------------------------------------------------------
// 5. opponentDrive: los 小(自陣) → 得点率↑、pinBonus で抑制
// ------------------------------------------------------------
var M = N;

function drivePoints(los, pinBonus) {
  var total = 0;
  for (var i = 0; i < M; i++) {
    total += BG.opponentDrive(los, pinBonus).points;
  }
  return total / M;  // 平均得点（0/3/7）
}

var ptsSelfSide  = drivePoints(20, 0);   // 自陣 los=20（goodness 大）
var ptsOppoSide  = drivePoints(90, 0);   // 相手陣 los=90（goodness 小）
assert("相手ドライブ: 自陣(los=20) の平均得点 > 敵陣(los=90) の平均得点", ptsSelfSide > ptsOppoSide);

var ptsNoPin   = drivePoints(20, 0);
var ptsWithPin = drivePoints(20, 0.4);
assert("相手ドライブ: pinBonus=0.4 で平均得点が抑制される", ptsWithPin < ptsNoPin);

// ------------------------------------------------------------
// 6. 読み合い: coverageMatchup の三角関係
// ------------------------------------------------------------
assert("matchup: run は zone に相性◎(edge=1)",   BG.coverageMatchup("run", "zone").edge === 1);
assert("matchup: run は blitz に相性△(edge=-1)",  BG.coverageMatchup("run", "blitz").edge === -1);
assert("matchup: short は blitz に相性◎(edge=1)", BG.coverageMatchup("short", "blitz").edge === 1);
assert("matchup: short は man に相性△(edge=-1)",  BG.coverageMatchup("short", "man").edge === -1);
assert("matchup: long は man に相性◎(edge=1)",    BG.coverageMatchup("long", "man").edge === 1);
assert("matchup: long は zone に相性△(edge=-1)",  BG.coverageMatchup("long", "zone").edge === -1);
assert("matchup: coverage=null は edge=0(後方互換)", BG.coverageMatchup("run", null).edge === 0);

// ------------------------------------------------------------
// 7. 読み合い: 相性が結果へ有意に効く
// ------------------------------------------------------------
function shortRate(coverage, n) {
  var ok = 0;
  for (var i = 0; i < n; i++) {
    if (BG.outcome("single", "short", { rbSpeed: 6, olPower: 6, wrCatch: 6, wrSpeed: 6, coverage: coverage }).complete) ok++;
  }
  return ok / n;
}
var runVsZone  = avgYards("single", "run", { rbSpeed: 6, olPower: 6, wrCatch: 6, wrSpeed: 6, coverage: "zone" }, N);
var runVsBlitz = avgYards("single", "run", { rbSpeed: 6, olPower: 6, wrCatch: 6, wrSpeed: 6, coverage: "blitz" }, N);
assert("読み合い: ラン対ゾーン(◎)の平均ヤード > ラン対ブリッツ(△)", runVsZone > runVsBlitz);

var shortVsBlitz = shortRate("blitz", N);   // 相性◎
var shortVsMan   = shortRate("man", N);     // 相性△
assert("読み合い: ショート対ブリッツ(◎)の成功率 > ショート対マン(△)", shortVsBlitz > shortVsMan);

// 後方互換: coverage 未指定は従来分布（互角扱い）と一致方向
var shortNeutral = shortRate(null, N);
assert("読み合い: coverage未指定の成功率は ◎ と △ の間", shortNeutral < shortVsBlitz && shortNeutral > shortVsMan);

// ------------------------------------------------------------
// 8. 守備能力（dPower/dSpeed）が結果に効く
// ------------------------------------------------------------
var runVsWeakD   = avgYards("single", "run", { rbSpeed: 6, olPower: 6, dPower: 3 }, N);
var runVsStrongD = avgYards("single", "run", { rbSpeed: 6, olPower: 6, dPower: 9 }, N);
assert("守備: 強い守備ライン(dPower=9)はラン平均ヤードを減らす", runVsStrongD < runVsWeakD);

function shortRateD(dSpeed, n) {
  var ok = 0;
  for (var i = 0; i < n; i++) { if (BG.outcome("single", "short", { wrCatch: 6, dSpeed: dSpeed }).complete) ok++; }
  return ok / n;
}
assert("守備: 速いカバー(dSpeed=9)はショート成功率を下げる", shortRateD(9, N) < shortRateD(3, N));

// 後方互換: dPower/dSpeed 未指定は中立（既存テストと同等）
var runNeutralD = avgYards("single", "run", { rbSpeed: 6, olPower: 6 }, N);
assert("守備: 未指定は弱守備と強守備の間（中立）", runNeutralD < runVsWeakD && runNeutralD > runVsStrongD);

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
