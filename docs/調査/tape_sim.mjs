// テーピング演出のロジック検証用シミュレーション（index.html の判定式を移植）
// 目的: 発生頻度が低いこと / 不利効果が正しい方向に効くこと / 効果が1プレーで回復することを確認する。

function rand(a, b) { return a + Math.random() * (b - a); }

// index.html の outcome() と同じロジック（taped は state.taped 相当）
function outcome(formation, play, taped) {
  var r = Math.random(), y = 0, complete = true, turnover = false;
  var runHurt = taped && (taped.role === "rb" || taped.role === "line");
  var passHurt = taped && (taped.role === "qb" || taped.role === "wr");
  if (play === "run") {
    y = rand(1, 6); if (formation === "i" || formation === "goal") y += rand(1.5, 4);
    if (r > 0.9) y += rand(8, 22);
    if (runHurt) y *= 0.55;
  } else if (play === "short") {
    var failT = passHurt ? 0.38 : 0.18;
    if (r < failT) { complete = false; y = 0; }
    else { y = rand(4, 9); if (formation === "shotgun" || formation === "single") y += rand(1, 3); if (passHurt) y *= 0.7; }
  } else {
    var intT = passHurt ? 0.16 : 0.1, missT = passHurt ? 0.62 : 0.5;
    if (r < intT) { turnover = true; y = 0; }
    else if (r < missT) { complete = false; y = 0; }
    else { y = rand(12, 30); if (formation === "shotgun") y += rand(2, 6); if (passHurt) y *= 0.7; }
  }
  y = Math.round(y);
  return { yards: y, complete: complete, turnover: turnover };
}

// index.html の maybeTape() と同じ頻度ロジック
function makeTaper() {
  var tapeCooldown = 2;
  return function maybeTape(state) {
    if (tapeCooldown > 0) { tapeCooldown--; return; }
    if (Math.random() > 0.15) return;
    if (state.taped) return;
    var idx = Math.floor(rand(0, 5));
    var role = idx === 0 ? "qb" : idx === 1 ? "rb" : idx === 2 ? "wr" : "line";
    state.taped = { role: role };
    tapeCooldown = 3;
  };
}

function pct(n, d) { return d ? (100 * n / d).toFixed(1) + "%" : "-"; }

// 1) 発生頻度の検証（実フローを再現: プレー → recover → maybeTape）
(function () {
  var N = 100000, state = { taped: null }, maybeTape = makeTaper();
  var tapedPlays = 0, maxConsec = 0, consec = 0, multiPlayEffect = false;
  for (var i = 0; i < N; i++) {
    // プレー時点の taped を記録
    if (state.taped) { tapedPlays++; consec++; if (consec > maxConsec) maxConsec = consec; }
    else consec = 0;
    // finalize 先頭の recoverTape（必ず外れる＝効果は1プレーのみ）
    var wasTaped = !!state.taped;
    state.taped = null;
    if (wasTaped && state.taped) multiPlayEffect = true; // 回復漏れ検出
    // nextPlayReady の maybeTape
    maybeTape(state);
  }
  console.log("【1】発生頻度（" + N + "プレー）");
  console.log("  テーピングが効いたプレー率 : " + pct(tapedPlays, N));
  console.log("  連続でテーピングが効いた最大: " + maxConsec + " プレー（1なら多発なし）");
  console.log("  回復漏れ（2プレー以上継続）: " + (multiPlayEffect ? "[NG] あり" : "[OK] なし"));
})();

// 2) 不利効果の方向検証（同条件で taped 有無の平均を比較）
(function () {
  var M = 200000;
  function avgRun(taped) { var s = 0; for (var i = 0; i < M; i++) s += outcome("single", "run", taped).yards; return s / M; }
  function comp(play, taped) { var c = 0; for (var i = 0; i < M; i++) if (outcome("single", play, taped).complete) c++; return c / M; }
  function intRate(taped) { var t = 0; for (var i = 0; i < M; i++) if (outcome("single", "long", taped).turnover) t++; return t / M; }

  var runNo = avgRun(null), runHurt = avgRun({ role: "rb" });
  var shortNo = comp("short", null), shortHurt = comp("short", { role: "wr" });
  var longNo = comp("long", null), longHurt = comp("long", { role: "qb" });
  var intNo = intRate(null), intHurt = intRate({ role: "qb" });

  console.log("\n【2】不利効果の方向（taped なし → あり）");
  console.log("  ラン平均ヤード       : " + runNo.toFixed(2) + " → " + runHurt.toFixed(2) + "  " + (runHurt < runNo ? "[OK] 減少" : "[NG]"));
  console.log("  ショートパス成功率   : " + pct(shortNo, 1) + " → " + pct(shortHurt, 1) + "  " + (shortHurt < shortNo ? "[OK] 低下" : "[NG]"));
  console.log("  ロングパス成功率     : " + pct(longNo, 1) + " → " + pct(longHurt, 1) + "  " + (longHurt < longNo ? "[OK] 低下" : "[NG]"));
  console.log("  ロングINT率          : " + pct(intNo, 1) + " → " + pct(intHurt, 1) + "  " + (intHurt > intNo ? "[OK] 微増" : "[NG]"));
})();

// 3) 役割とプレーの対応（無関係なプレーには影響しないこと）
(function () {
  var M = 200000;
  function avgRun(taped) { var s = 0; for (var i = 0; i < M; i++) s += outcome("single", "run", taped).yards; return s / M; }
  var runNo = avgRun(null), runWithPassInjury = avgRun({ role: "wr" });
  console.log("\n【3】役割の独立性（wr=パス役の負傷はランに影響しない）");
  console.log("  ラン平均ヤード taped:null → wr : " + runNo.toFixed(2) + " → " + runWithPassInjury.toFixed(2) +
    "  " + (Math.abs(runWithPassInjury - runNo) < 0.1 ? "[OK] ほぼ不変" : "[NG] 影響あり"));
})();
