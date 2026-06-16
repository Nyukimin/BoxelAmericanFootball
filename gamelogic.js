/**
 * gamelogic.js - BoxelAmericanFootball 純粋数値ロジック
 * window.BoxelGame として公開する（characters.js の window.BoxelChars と同じ流儀）。
 * 描画・DOM・THREE には一切依存しない。
 */
(function () {
  "use strict";

  /**
   * プレー結果を計算する。
   * @param {string} formation "shotgun"|"i"|"single"|"goal"
   * @param {string} play "run"|"short"|"long"
   * @param {object} ctx
   *   ctx.rbSpeed   {number} 1-10 (RB の speed stat)
   *   ctx.olPower   {number} 1-10 (OL の power stat 平均)
   *   ctx.wrCatch   {number} 1-10 (WR の catch stat)
   *   ctx.wrSpeed   {number} 1-10 (WR の speed stat)
   *   ctx.tapedRole {string|null} "QB"|"RB"|"WR"|"OL"|null
   * @returns {{ yards:number, complete:boolean, turnover:boolean, msg:string }}
   */
  function outcome(formation, play, ctx) {
    var rbSpeed  = (ctx && ctx.rbSpeed  != null) ? ctx.rbSpeed  : 6;
    var olPower  = (ctx && ctx.olPower  != null) ? ctx.olPower  : 6;
    var wrCatch  = (ctx && ctx.wrCatch  != null) ? ctx.wrCatch  : 6;
    var wrSpeed  = (ctx && ctx.wrSpeed  != null) ? ctx.wrSpeed  : 6;
    var tapedRole = (ctx && ctx.tapedRole) ? ctx.tapedRole : null;
    var coverage  = (ctx && ctx.coverage) ? ctx.coverage : null;
    var edge      = coverageMatchup(play, coverage).edge;   // -1/0/1（守備の読み合い）

    var r = Math.random(), y = 0, complete = true, turnover = false, msg = "", reason = "";
    var runHurt  = tapedRole === "RB" || tapedRole === "OL";
    var passHurt = tapedRole === "QB" || tapedRole === "WR";

    // 能力（6が平均=係数1.0）
    var spd   = rbSpeed  / 6;
    var pwr   = olPower  / 6;
    var cat   = wrCatch  / 6;
    var wrSpd = wrSpeed  / 6;

    function rand(a, b) { return a + Math.random() * (b - a); }

    if (play === "run") {
      y = rand(1, 5) * (0.7 + 0.3 * pwr);
      if (formation === "i" || formation === "goal") y += rand(1.5, 4) * pwr;
      if (r > (1 - 0.10 * spd)) y += rand(8, 22) * spd;   // 速いほどブレイク
      if (Math.random() < 0.12 / pwr) y -= rand(2, 5);     // 弱いと止められる
      if (runHurt) y *= 0.55;
      y *= (1 + 0.5 * edge);                                // 読み合い: 相性◎で+50%/△で-50%
      // タックル・フォー・ロス（約8%）。高乱数側で判定し Math.random()=0 固定のテストでは発生しない。
      if (Math.random() > 0.92) { y = -(1 + Math.round(rand(0, 4))); msg = "止められて後退…！"; reason = "loss"; }
      else { msg = "ランで前進！"; reason = "run"; }
    } else if (play === "short") {
      var dropS = 0.16 / cat;                               // 捕球低いほど落球
      var failT = (passHurt ? 0.30 : 0.10) + dropS;
      failT = Math.max(0.02, Math.min(0.95, failT - 0.18 * edge)); // 読み合い: ◎で成功しやすく
      if (r < failT) {
        complete = false; y = 0;
        msg = (r < dropS ? "あっ、落球…！" : "パス失敗…ドンマイ！");
        reason = (r < dropS ? "drop" : "miss");
      } else {
        y = rand(4, 8) + rand(0, 3) * wrSpd;
        if (formation === "shotgun" || formation === "single") y += rand(1, 3);
        if (passHurt) y *= 0.7;
        y *= (1 + 0.4 * edge);
        msg = "ショートパス成功！"; reason = "catch";
      }
    } else {
      // long
      var dropL = 0.14 / cat;
      var intT  = passHurt ? 0.16 : 0.1;
      if (edge < 0) intT += 0.04;                           // 相性△（ロング対ゾーン）は奪われやすい
      var missT = (passHurt ? 0.55 : 0.42) + dropL;
      missT = Math.max(0.05, Math.min(0.97, missT - 0.20 * edge)); // 読み合い: ◎で通りやすく
      if (r < intT) {
        turnover = true; y = 0; msg = "インターセプト！相手ボールに…"; reason = "intercept";
      } else if (r < missT) {
        complete = false; y = 0;
        msg = (r < intT + dropL ? "あぁ落球…！" : "ロングパスは届かず…！");
        reason = (r < intT + dropL ? "drop" : "overthrow");
      } else {
        y = rand(12, 26) + rand(0, 8) * wrSpd;
        if (formation === "shotgun") y += rand(2, 6);
        if (passHurt) y *= 0.7;
        y *= (1 + 0.4 * edge);
        msg = "ロングパス成功！大きく前進！"; reason = "catch";
      }
    }
    y = Math.round(y);
    if (reason !== "loss") y = Math.max(0, y);            // ロス（負ヤード）以外は0未満にしない
    if (edge > 0)      msg += "（相性バッチリ！）";
    else if (edge < 0) msg += "（相手の守りにハマった…）";
    return { yards: y, complete: complete, turnover: turnover, msg: msg, reason: reason };
  }

  /**
   * 相手チームの攻撃をシミュレートして得点を返す（副作用なし）。
   * @param {number} los       自チームの LOS（フィールド座標値、通常 10-110）
   * @param {number} pinBonus  パントで押し込んだ際のボーナス（0 〜 0.45 程度）
   * @returns {{ points: 0|3|7, msg: string }}
   */
  function opponentDrive(los, pinBonus) {
    var GOAL_NEAR = 10;
    var goodness = Math.max(0, Math.min(1, 1 - (los - GOAL_NEAR) / 100 - (pinBonus || 0)));
    var r = Math.random();
    var tdC = 0.12 + 0.30 * goodness;
    var fgC = tdC + 0.18 + 0.15 * goodness;
    if (r < tdC) return { points: 7, msg: "相手にタッチダウンされた…！" };
    if (r < fgC) return { points: 3, msg: "相手にフィールドゴールを決められた。" };
    return { points: 0, msg: "守備陣がストップ！ ナイスディフェンス！" };
  }

  /**
   * フィールドゴール成功確率を返す。
   * @param {number} los      現在の LOS（フィールド座標値）
   * @param {number} kickStat キッカーの kick stat (1-10)
   * @returns {number} 確率 [0.1, 0.95]
   */
  function fgProbability(los, kickStat) {
    var GOAL_FAR = 110;
    var dist = Math.round((GOAL_FAR - los) + 17);
    var kf   = kickStat / 6;
    return Math.min(0.95, Math.max(0.1, (1.15 - dist * 0.012) * kf));
  }

  /**
   * FGミニゲーム: 左右アップライトへの方位角ウィンドウを返す。
   * @param {number} xb ボールの横位置（ハッシュ相当、[-6,6] 程度）
   * @param {number} zb ボールの縦位置（LOS、フィールド座標）
   * @returns {{ left: number, right: number }} 方位角ラジアン。left < right が保証される。
   */
  function fgAngleWindow(xb, zb) {
    var left  = Math.atan2(-3 - xb, 120 - zb);
    var right = Math.atan2( 3 - xb, 120 - zb);
    return { left: left, right: right };
  }

  /**
   * FGミニゲーム: フルパワーで届く距離を返す。
   * @param {number} kickStat キッカーの kick stat (1-10)
   * @returns {number} 到達距離（ヤード換算）
   */
  function fgReach(kickStat) {
    return 35 + 4 * kickStat;
  }

  /**
   * FGミニゲーム: 角度メーターの可動域を返す。
   * @param {number} xb ボールの横位置
   * @param {number} zb ボールの縦位置（LOS）
   * @returns {{ center: number, half: number }} center=ゴール中心への角度(rad)、half=可動域の半分(rad)
   */
  function fgAimSwing(xb, zb) {
    var center = Math.atan2(-xb, 120 - zb);
    return { center: center, half: 0.28 };
  }

  /**
   * FGミニゲーム: 狙い・パワーからキック成否を判定する（純粋関数）。
   * @param {object} opts
   *   opts.aim      {number} 狙い角度(rad)
   *   opts.power    {number} パワー [0,1]
   *   opts.xb       {number} ボールの横位置
   *   opts.zb       {number} ボールの縦位置（LOS）
   *   opts.kickStat {number} キッカーの kick stat (1-10)
   * @returns {{ success: boolean, reason: "good"|"wideLeft"|"wideRight"|"short" }}
   */
  function fgResolve(opts) {
    var aim      = opts.aim;
    var power    = opts.power;
    var xb       = opts.xb;
    var zb       = opts.zb;
    var kickStat = opts.kickStat;

    // 飛距離チェック
    var dist   = (120 - zb) + 17;
    var needed = dist / fgReach(kickStat);
    if (power < needed) {
      return { success: false, reason: "short" };
    }

    // 左右チェック
    var win = fgAngleWindow(xb, zb);
    var tol = 0.01 * (kickStat / 6);
    if (aim < win.left - tol) {
      return { success: false, reason: "wideLeft" };
    }
    if (aim > win.right + tol) {
      return { success: false, reason: "wideRight" };
    }

    return { success: true, reason: "good" };
  }

  /**
   * ファンブル発生確率を返す（純粋関数・乱数不使用）。
   * @param {number} power    ボールキャリアの power stat (1-10)
   * @param {number} baseRate 基準確率（省略時 0.045）
   * @returns {number} 確率 [0.015, 0.10]
   */
  function fumbleProbability(power, baseRate) {
    var base = (baseRate != null) ? baseRate : 0.045;
    var p = base * (6 / power);
    return Math.min(0.10, Math.max(0.015, p));
  }

  /**
   * ファンブル判定を行う（乱数使用）。
   * @param {object} opts
   *   opts.power              {number} ボールキャリアの power stat (1-10)
   *   opts.baseRate           {number} 基準確率（省略時 0.045）
   *   opts.opponentRecoverRate {number} 相手リカバー率（省略時 0.5）
   * @returns {{ fumble: boolean, lostToOpponent: boolean }}
   */
  function fumbleCheck(opts) {
    var power               = (opts && opts.power               != null) ? opts.power               : 6;
    var baseRate            = (opts && opts.baseRate            != null) ? opts.baseRate            : 0.045;
    var opponentRecoverRate = (opts && opts.opponentRecoverRate != null) ? opts.opponentRecoverRate : 0.5;

    var fumble = Math.random() < fumbleProbability(power, baseRate);
    var lostToOpponent = fumble && (Math.random() < opponentRecoverRate);
    return { fumble: fumble, lostToOpponent: lostToOpponent };
  }

  /**
   * CPU の攻撃スタイルをランダムに選択する。
   * @returns {"run"|"pass"|"balanced"}
   */
  function pickCpuStyle() {
    var r = Math.random();
    if (r < 0.38) return "run";
    if (r < 0.76) return "pass";
    return "balanced";
  }

  /**
   * プレーと守備カバレッジの相性を返す（読み合いの核・純粋関数）。
   * 三角関係: short>blitz / long>man / run>zone（相性◎）。逆は相性△。
   * @param {string} play "run"|"short"|"long"
   * @param {string|null} coverage "blitz"|"man"|"zone"|null
   * @returns {{ edge: -1|0|1, label: string }}
   */
  function coverageMatchup(play, coverage) {
    var beats   = { run: "zone",  short: "blitz", long: "man" };
    var losesTo = { run: "blitz", short: "man",   long: "zone" };
    if (!coverage || !play) return { edge: 0, label: "" };
    if (beats[play] === coverage)   return { edge: 1,  label: "相性◎" };
    if (losesTo[play] === coverage) return { edge: -1, label: "相性△" };
    return { edge: 0, label: "互角" };
  }

  /**
   * 守備のカバレッジを選ぶ（状況で重み付け＋乱数・読み合いの相手側）。
   * @param {object} opts opts.down(1-4) opts.toGo(残りヤード)
   * @returns {"blitz"|"man"|"zone"}
   */
  function pickDefenseCoverage(opts) {
    var toGo = (opts && opts.toGo != null) ? opts.toGo : 10;
    var down = (opts && opts.down != null) ? opts.down : 1;
    var wBlitz = 1, wMan = 1, wZone = 1;
    if (toGo <= 3) wBlitz += 1.2;   // あと少しは前に詰めて止める
    if (toGo >= 8) wZone  += 1.0;   // 長い残りは大きいのを警戒
    if (down >= 3) wMan   += 0.6;   // 勝負どころは張り付き
    var total = wBlitz + wMan + wZone;
    var r = Math.random() * total;
    if (r < wBlitz) return "blitz";
    if (r < wBlitz + wMan) return "man";
    return "zone";
  }

  /**
   * CPU攻撃の1プレー（ラン/ショート/ロング）を状況で選ぶ（純粋関数）。
   * @param {object} opts opts.down(1-4) opts.toGo(残りヤード) opts.cpuStyle("run"|"pass"|"balanced")
   * @returns {"run"|"short"|"long"}
   */
  function pickCpuPlay(opts) {
    var toGo  = (opts && opts.toGo  != null) ? opts.toGo  : 10;
    var down  = (opts && opts.down  != null) ? opts.down  : 1;
    var style = (opts && opts.cpuStyle) ? opts.cpuStyle : "balanced";
    var wRun = 1, wShort = 1, wLong = 1;
    if (style === "run") wRun += 2;
    else if (style === "pass") { wShort += 1; wLong += 1; }
    if (toGo <= 3) wRun += 1;                  // 短い残りはラン寄り
    if (toGo >= 8) { wLong += 0.8; wShort += 0.4; } // 長い残りはパス寄り
    if (down >= 3 && toGo >= 6) wLong += 0.6;  // 勝負どころの長い残りはロング
    var total = wRun + wShort + wLong;
    var r = Math.random() * total;
    if (r < wRun) return "run";
    if (r < wRun + wShort) return "short";
    return "long";
  }

  /**
   * 守備の采配をシミュレートして得点と結果を返す（純粋関数）。
   * @param {object} opts
   *   opts.front     {"runStop"|"balanced"|"passDef"|"goalLine"}
   *   opts.tactic    {"normal"|"blitz"|"zone"}
   *   opts.los       {number} フィールド座標値
   *   opts.pinBonus  {number} パントで押し込んだボーナス（省略時 0）
   *   opts.dPower    {number} 守備パワー (1-10)
   *   opts.dSpeed    {number} 守備スピード (1-10)
   *   opts.cpuStyle  {"run"|"pass"|"balanced"}
   * @returns {{ points: 0|3|7, turnoverWon: boolean, msg: string }}
   */
  function defenseDrive(opts) {
    var front    = opts.front;
    var tactic   = opts.tactic;
    var los      = opts.los;
    var pinBonus = (opts.pinBonus != null) ? opts.pinBonus : 0;
    var dPower   = opts.dPower;
    var dSpeed   = opts.dSpeed;
    var cpuStyle = opts.cpuStyle;

    function clamp(x) { return Math.max(0, Math.min(1, x)); }

    var base = clamp(1 - (los - 10) / 100 - pinBonus);

    var counter = 0;
    if (front === "runStop" && cpuStyle === "run") {
      counter = -0.25;
    } else if (front === "runStop" && cpuStyle === "pass") {
      counter = 0.15;
    } else if (front === "passDef" && cpuStyle === "pass") {
      counter = -0.25;
    } else if (front === "passDef" && cpuStyle === "run") {
      counter = 0.15;
    } else if (front === "goalLine" && cpuStyle === "run") {
      counter = -0.30;
    } else if (front === "goalLine" && cpuStyle === "pass") {
      counter = 0.22;
    } else if (front === "balanced") {
      counter = -0.05;
    } else {
      counter = 0;
    }

    var statRed = ((dPower / 6 + dSpeed / 6) / 2 - 1) * 0.15;
    var goodness = clamp(base + counter - statRed + (tactic === "zone" ? -0.05 : 0));

    if (tactic === "blitz") {
      var toChance = 0.14 + 0.10 * (dPower / 6);
      if (Math.random() < toChance) {
        return { points: 0, turnoverWon: true, msg: "ブリッツ的中！ ボールを奪った！" };
      }
      goodness = clamp(goodness + 0.10);
    }

    var tdC = (0.12 + 0.30 * goodness) * (tactic === "zone" ? 0.7 : 1);
    var fgC = tdC + 0.18 + 0.15 * goodness;
    var r = Math.random();
    if (r < tdC) return { points: 7, turnoverWon: false, msg: "相手にタッチダウンを許した…" };
    if (r < fgC) return { points: 3, turnoverWon: false, msg: "相手にフィールドゴールを許した。" };
    return { points: 0, turnoverWon: false, msg: "守備陣がストップ！ ナイスディフェンス！" };
  }

  /**
   * 最寄り守備のインデックスを返す（タックラー選定）。
   * @param {{ x: number, z: number }} carrier キャリアの位置
   * @param {Array<{ x: number, z: number }>} defenders 守備の位置配列
   * @returns {number} 距離最小の index。defenders が空なら -1。
   */
  function nearestDefenderIndex(carrier, defenders) {
    if (defenders === null || defenders === undefined || defenders.length === 0) {
      return -1;
    }
    var minIdx = 0;
    var minDist = Infinity;
    for (var i = 0; i < defenders.length; i++) {
      var dx = defenders[i].x - carrier.x;
      var dz = defenders[i].z - carrier.z;
      var dist2 = dx * dx + dz * dz;
      if (dist2 < minDist) {
        minDist = dist2;
        minIdx = i;
      }
    }
    return minIdx;
  }

  /**
   * ライン攻防のシフト量（符号つき）を返す。
   * 攻撃が押し勝てば正、負ければ負、等しいと 0。
   * @param {number} olPower 攻撃ラインのパワー
   * @param {number} dlPower 守備ラインのパワー
   * @param {number} maxShift シフト量の最大絶対値
   * @returns {number} clamp((olPower - dlPower) / 6, -1, 1) * maxShift
   */
  function lineClashShift(olPower, dlPower, maxShift) {
    var ratio = (olPower - dlPower) / 6;
    var clamped = ratio < -1 ? -1 : (ratio > 1 ? 1 : ratio);
    return clamped * maxShift;
  }

  /**
   * 追走の補間ターゲットを返す（defender から carrier へ t で lerp）。
   * @param {{ x: number, z: number }} defender 守備の位置
   * @param {{ x: number, z: number }} carrier キャリアの位置
   * @param {number} t 進行度（0..1 にクランプ）
   * @returns {{ x: number, z: number }}
   */
  function pursuitTarget(defender, carrier, t) {
    var tt = t < 0 ? 0 : (t > 1 ? 1 : t);
    return {
      x: defender.x + (carrier.x - defender.x) * tt,
      z: defender.z + (carrier.z - defender.z) * tt
    };
  }

  /**
   * キックオフ結果を返す（純粋関数）。
   * @param {object} opts opts.random {number} [0,1) - 省略時 Math.random()
   * @returns {{ yards: number, kind: "touchback"|"return"|"bigReturn"|"fairCatch" }}
   *   yards: 受球側が何ヤードラインからスタートするか（自陣基準、10〜50目安）
   */
  function kickoffResult(opts) {
    var r = (opts && opts.random != null) ? opts.random : Math.random();
    if (r < 0.55) return { yards: 25, kind: "touchback" };
    if (r < 0.80) return { yards: 25, kind: "fairCatch" };
    if (r < 0.93) return { yards: Math.round(20 + (r - 0.80) / 0.13 * 15), kind: "return" };
    return { yards: Math.round(35 + (r - 0.93) / 0.07 * 10), kind: "bigReturn" };
  }

  /**
   * オンサイドキックのリカバー成否（純粋関数）。
   * @param {object} opts opts.random {number} [0,1) - 省略時 Math.random()
   * @returns {boolean} true=自チームリカバー成功（約15%）
   */
  function onsideRecovered(opts) {
    var r = (opts && opts.random != null) ? opts.random : Math.random();
    return r < 0.15;
  }

  /**
   * パントリターンのヤードを返す（純粋関数）。
   * @param {object} opts opts.random {number} [0,1) - 省略時 Math.random()
   * @returns {{ yards: number, kind: "fairCatch"|"return" }}
   *   yards: リターンヤード（フェアキャッチなら0）
   */
  function puntReturn(opts) {
    var r = (opts && opts.random != null) ? opts.random : Math.random();
    if (r < 0.35) return { yards: 0, kind: "fairCatch" };
    return { yards: Math.round(2 + (r - 0.35) / 0.65 * 12), kind: "return" };
  }

  /**
   * スナップ前の反則を返す（純粋関数・高乱数側で発火）。約6%。
   * @param {object} opts opts.random/opts.random2 [0,1) 省略時 Math.random()
   * @returns {null | { team:"off"|"def", yards:number, label:string, type:string }}
   */
  function rollPrePenalty(opts) {
    var r = (opts && opts.random != null) ? opts.random : Math.random();
    if (r < 0.94) return null;
    var r2 = (opts && opts.random2 != null) ? opts.random2 : Math.random();
    if (r2 < 0.5) return { team: "off", yards: 5, label: "フォルススタート", type: "falseStart" };
    if (r2 < 0.8) return { team: "def", yards: 5, label: "オフサイド", type: "offside" };
    return { team: "off", yards: 5, label: "ディレイオブゲーム", type: "delay" };
  }

  /**
   * プレー中の反則を返す（純粋関数・高乱数側で発火）。約10%。
   * @returns {null | { team:"off"|"def", yards:number, autoFirst:boolean, label:string, type:string }}
   */
  function rollPlayPenalty(opts) {
    var r = (opts && opts.random != null) ? opts.random : Math.random();
    if (r < 0.90) return null;
    var r2 = (opts && opts.random2 != null) ? opts.random2 : Math.random();
    if (r2 < 0.30) return { team: "off", yards: 10, autoFirst: false, label: "ホールディング", type: "offHold" };
    if (r2 < 0.50) return { team: "def", yards: 5,  autoFirst: true,  label: "ホールディング", type: "defHold" };
    if (r2 < 0.70) return { team: "def", yards: 15, autoFirst: true,  label: "パスインターフェア", type: "defPI" };
    if (r2 < 0.85) return { team: "def", yards: 15, autoFirst: true,  label: "フェイスマスク", type: "facemask" };
    return { team: "def", yards: 15, autoFirst: true, label: "アンネセサリーラフネス", type: "roughness" };
  }

  window.BoxelGame = {
    outcome: outcome,
    rollPrePenalty: rollPrePenalty,
    rollPlayPenalty: rollPlayPenalty,
    opponentDrive: opponentDrive,
    fgProbability: fgProbability,
    fgAngleWindow: fgAngleWindow,
    fgReach: fgReach,
    fgAimSwing: fgAimSwing,
    fgResolve: fgResolve,
    fumbleProbability: fumbleProbability,
    fumbleCheck: fumbleCheck,
    pickCpuStyle: pickCpuStyle,
    pickCpuPlay: pickCpuPlay,
    coverageMatchup: coverageMatchup,
    pickDefenseCoverage: pickDefenseCoverage,
    defenseDrive: defenseDrive,
    nearestDefenderIndex: nearestDefenderIndex,
    lineClashShift: lineClashShift,
    pursuitTarget: pursuitTarget,
    kickoffResult: kickoffResult,
    onsideRecovered: onsideRecovered,
    puntReturn: puntReturn
  };
})();
