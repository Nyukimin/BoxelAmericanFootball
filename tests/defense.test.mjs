/**
 * tests/defense.test.mjs
 * 守備の采配ロジック（pickCpuStyle / defenseDrive）の統計的単体テスト。
 * 実行: node tests/defense.test.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../");

// BoxelGame を Node 環境に読み込む
global.window = global;
const code = fs.readFileSync(path.join(ROOT, "gamelogic.js"), "utf8");
new Function(code)();
const { pickCpuStyle, defenseDrive } = window.BoxelGame;

// ============================================================
// assert ヘルパー
// ============================================================
let allPass = true;

function assert(label, cond) {
  const ok = cond === true;
  if (ok === false) allPass = false;
  console.log((ok ? "[OK]" : "[NG]") + " " + label);
}

// ============================================================
// 統計ヘルパー
// ============================================================
const TRIALS = 100000;

/**
 * defenseDrive を TRIALS 回呼んで平均失点と各確率を返す。
 * turnoverWon === true のときは points===0 として扱う。
 */
function runTrials(opts) {
  let totalPoints = 0;
  let tdCount = 0;
  let turnoverCount = 0;

  for (let i = 0; i < TRIALS; i++) {
    const res = defenseDrive(opts);
    totalPoints += res.points;
    if (res.points === 7) tdCount++;
    if (res.turnoverWon === true) turnoverCount++;
  }

  return {
    avgPoints: totalPoints / TRIALS,
    tdRate: tdCount / TRIALS,
    turnoverRate: turnoverCount / TRIALS
  };
}

// ============================================================
// テスト 1: 刺さる隊形が有利
//   front="runStop",cpuStyle="run" の平均失点 < front="passDef",cpuStyle="run"
// ============================================================
{
  const base = { tactic: "normal", los: 40, pinBonus: 0, dPower: 6, dSpeed: 6 };
  const runStop = runTrials({ ...base, front: "runStop", cpuStyle: "run" });
  const passDef = runTrials({ ...base, front: "passDef", cpuStyle: "run" });
  assert(
    "刺さる隊形が有利: runStop vs run の平均失点 < passDef vs run",
    runStop.avgPoints < passDef.avgPoints
  );
}

// ============================================================
// テスト 2: goalLine が run に最強
//   front="goalLine",cpuStyle="run" の平均失点 < front="runStop",cpuStyle="run"
// ============================================================
{
  const base = { tactic: "normal", los: 40, pinBonus: 0, dPower: 6, dSpeed: 6 };
  const goalLine = runTrials({ ...base, front: "goalLine", cpuStyle: "run" });
  const runStop  = runTrials({ ...base, front: "runStop",  cpuStyle: "run" });
  assert(
    "goalLine が run に最強: goalLine vs run < runStop vs run",
    goalLine.avgPoints < runStop.avgPoints
  );
}

// ============================================================
// テスト 3: stats が効く
//   dPower=9,dSpeed=9 の平均失点 < dPower=3,dSpeed=3
// ============================================================
{
  const base = { front: "balanced", tactic: "normal", los: 40, pinBonus: 0, cpuStyle: "balanced" };
  const strong = runTrials({ ...base, dPower: 9, dSpeed: 9 });
  const weak   = runTrials({ ...base, dPower: 3, dSpeed: 3 });
  assert(
    "stats が効く: dPower/dSpeed=9 の平均失点 < dPower/dSpeed=3",
    strong.avgPoints < weak.avgPoints
  );
}

// ============================================================
// テスト 4: blitz の奪取
//   tactic="blitz" の turnoverWon 率 > 0.05
//   tactic="normal" の turnoverWon 率 === 0
// ============================================================
{
  const base = { front: "balanced", los: 40, pinBonus: 0, dPower: 6, dSpeed: 6, cpuStyle: "balanced" };
  const blitz  = runTrials({ ...base, tactic: "blitz" });
  const normal = runTrials({ ...base, tactic: "normal" });
  assert(
    "blitz の奪取率 > 0.05",
    blitz.turnoverRate > 0.05
  );
  assert(
    "normal の奪取率 === 0",
    normal.turnoverRate === 0
  );
}

// ============================================================
// テスト 5: zone は大失点を抑える
//   tactic="zone" の TD 率 < tactic="normal" の TD 率
// ============================================================
{
  const base = { front: "balanced", los: 40, pinBonus: 0, dPower: 6, dSpeed: 6, cpuStyle: "balanced" };
  const zone   = runTrials({ ...base, tactic: "zone" });
  const normal = runTrials({ ...base, tactic: "normal" });
  assert(
    "zone は大失点を抑える: zone の TD 率 < normal の TD 率",
    zone.tdRate < normal.tdRate
  );
}

// ============================================================
// テスト 6: pickCpuStyle は run/pass/balanced のいずれかを返す（3種全出現）
// ============================================================
{
  const seen = new Set();
  for (let i = 0; i < 10000; i++) {
    seen.add(pickCpuStyle());
  }
  const validValues = ["run", "pass", "balanced"];
  const allValid = [...seen].every(v => validValues.includes(v));
  const allSeen  = validValues.every(v => seen.has(v));
  assert(
    "pickCpuStyle が run/pass/balanced のみを返す",
    allValid === true
  );
  assert(
    "pickCpuStyle で run/pass/balanced の3種が全て出現する",
    allSeen === true
  );
}

// ============================================================
// 結果まとめ
// ============================================================
console.log("");
console.log(allPass ? "[OK] 全テスト通過" : "[NG] 失敗あり");
process.exit(allPass ? 0 : 1);
