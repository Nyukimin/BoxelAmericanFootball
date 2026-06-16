/*
 * characters.js — キャラクター定義（データ駆動・差し替え可能）
 *
 * ゲーム本体 index.html はこのファイルが公開する window.BoxelChars を読み込んで使う。
 * キャラを差し替える/増やすときは、原則このファイルだけを編集すればよい。
 *
 * ■ 1選手は「3つの独立要素」の組み合わせで定義する
 *     role   : 役割（ポジション） … "QB" "RB" "WR" "OL" "P"(パンター) "DF"
 *     animal : 見た目の動物       … "owl" "rabbit" "squirrel" "bear" "rhino" "wolf" "cat"
 *     stats  : パラメータ         … プリセット名("speedy"等) か {speed,power,catch,kick}
 *   さらに name(表示名) と fur(毛色 0xRRGGBB) を持つ。
 *   例「足が速い・くま・パンター」:
 *     { name:"ダッシュ", role:"P", animal:"bear", fur:FUR.bear, stats:"speedy" }
 *   3要素は自由に組み合わせ可能（どの動物でも・どの役割でも・どのパラメータでも）。
 *
 * ■ いちばん簡単な差し替え方法
 *   下の OFFENSE / DEFENSE / MANAGER の「設定リスト」を書き換える。
 *
 * ■ 注意
 *   役割はカードの並び順ではなく role フィールドで決まる。
 *   OFFENSE / DEFENSE はそれぞれ必ず11体にする。
 *
 * ■ 新しい動物の見た目を足したいとき
 *   makeAnimal() の if (role === "...") 分岐を1つ追加する。
 */
(function (global) {
  "use strict";

  var THREE = global.THREE;

  // 立方体パーツの基本ヘルパー
  function box(w, h, d, color, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: color }));
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  // ===== パレット（毛色） =====
  var FUR = {
    owl: 0xe7d4a8, rabbit: 0xf6f0e6, squirrel: 0xd38c50,
    bear: 0xb58359, rhino: 0xaeb7c1, wolf: 0x8f9bac, cat: 0xe9c9a3
  };

  // ===== チームのユニフォーム色 =====
  var TEAM = { home: 0xee8e3c, away: 0x3f7fd0 };

  // ===== 役割（ポジション） =====  選手の role に指定する
  var ROLES = {
    QB: { label: "クォーターバック（司令塔・パスを投げる）" },
    RB: { label: "ランニングバック（走る役）" },
    WR: { label: "レシーバー（受け手）" },
    OL: { label: "ラインマン（守る役・押し込む）" },
    TE: { label: "タイトエンド（ブロックも受けもできる万能型）" },
    P:  { label: "パンター（蹴る役）" },
    DF: { label: "ディフェンス（守備）" },
    DL: { label: "ディフェンスライン（前で押し合う守備）" },
    LB: { label: "ラインバッカー（中盤で走者を追う）" },
    CB: { label: "コーナーバック（俊足でボールを追う）" },
    S:  { label: "セーフティ（後方で守る最後の砦）" }
  };

  // ===== パラメータのプリセット =====  選手の stats に名前で指定して使い回せる
  // 値は 1〜10 の目安（speed=足の速さ, power=パワー, catch=捕球, kick=キック）
  var STAT_PRESETS = {
    speedy:   { speed: 9, power: 4, catch: 6, kick: 3 }, // 足が速い
    power:    { speed: 4, power: 9, catch: 5, kick: 3 }, // パワー型
    hands:    { speed: 6, power: 4, catch: 9, kick: 3 }, // 捕球がうまい
    kicker:   { speed: 5, power: 5, catch: 4, kick: 9 }, // キックが得意
    allround: { speed: 6, power: 6, catch: 6, kick: 6 }  // バランス型
  };

  // ===== 攻撃チーム（味方）の編成 =====  各選手 = name / role / animal+fur / stats
  // role・animal・stats は独立。例: 足が速い・くま・パンター も作れる。
  // QB×1, OL×5（固定）, フレックス5体（WR/TE/RB。applyPersonnel で再割り当て可能）。
  var OFFENSE = [
    { name: "ミミィ",   role: "QB", animal: "owl",      fur: FUR.owl,      stats: "allround" },
    { name: "ゴロ",     role: "OL", animal: "bear",     fur: FUR.bear,     stats: "power" },
    { name: "ガード",   role: "OL", animal: "rhino",    fur: FUR.rhino,    stats: "power" },
    { name: "ブロック", role: "OL", animal: "bear",     fur: FUR.bear,     stats: "power" },
    { name: "ウォール", role: "OL", animal: "rhino",    fur: FUR.rhino,    stats: "power" },
    { name: "ライン",   role: "OL", animal: "bear",     fur: FUR.bear,     stats: "power" },
    { name: "ナッツ",   role: "WR", animal: "squirrel", fur: FUR.squirrel, stats: "hands" },
    { name: "フライ",   role: "WR", animal: "rabbit",   fur: FUR.rabbit,   stats: "speedy" },
    { name: "スラント", role: "WR", animal: "cat",      fur: FUR.cat,      stats: "hands" },
    { name: "フック",   role: "TE", animal: "bear",     fur: FUR.bear,     stats: "allround" },
    { name: "ピョン太", role: "RB", animal: "rabbit",   fur: FUR.rabbit,   stats: "speedy" }
  ];

  // ===== 守備チーム（相手）の編成 =====
  // 役割分担: DL(ライン担当・押し合う) / LB(中盤で追走) / CB(俊足で追走) / S(後方守備)
  var DEFENSE = [
    { name: "あいてDL1", role: "DL", animal: "wolf", fur: FUR.wolf, stats: "power" },
    { name: "あいてDL2", role: "DL", animal: "wolf", fur: FUR.wolf, stats: "power" },
    { name: "あいてDL3", role: "DL", animal: "wolf", fur: FUR.wolf, stats: "power" },
    { name: "あいてDL4", role: "DL", animal: "wolf", fur: FUR.wolf, stats: "power" },
    { name: "あいてLB1", role: "LB", animal: "wolf", fur: FUR.wolf, stats: "allround" },
    { name: "あいてLB2", role: "LB", animal: "wolf", fur: FUR.wolf, stats: "allround" },
    { name: "あいてLB3", role: "LB", animal: "wolf", fur: FUR.wolf, stats: "allround" },
    { name: "あいてCB1", role: "CB", animal: "wolf", fur: FUR.wolf, stats: "speedy" },
    { name: "あいてCB2", role: "CB", animal: "wolf", fur: FUR.wolf, stats: "speedy" },
    { name: "あいてS1",  role: "S",  animal: "wolf", fur: FUR.wolf, stats: "allround" },
    { name: "あいてS2",  role: "S",  animal: "wolf", fur: FUR.wolf, stats: "allround" }
  ];

  // ===== 味方（home）の守備ユニット11体 =====
  // DL(押し合い担当)×4 / LB(中盤追走)×3 / CB(俊足追走)×2 / S(後方)×2
  // animal は home らしく非wolf（owl/bear/rhino/rabbit/cat/squirrel）
  var HOME_DEFENSE = [
    { name: "守ゴロ1",  role: "DL", animal: "bear",     fur: FUR.bear,     stats: "power" },
    { name: "守ゴロ2",  role: "DL", animal: "rhino",    fur: FUR.rhino,    stats: "power" },
    { name: "守ゴロ3",  role: "DL", animal: "bear",     fur: FUR.bear,     stats: "power" },
    { name: "守ゴロ4",  role: "DL", animal: "rhino",    fur: FUR.rhino,    stats: "power" },
    { name: "守タック1", role: "LB", animal: "bear",     fur: FUR.bear,     stats: "allround" },
    { name: "守タック2", role: "LB", animal: "owl",      fur: FUR.owl,      stats: "allround" },
    { name: "守タック3", role: "LB", animal: "squirrel", fur: FUR.squirrel, stats: "allround" },
    { name: "守ミミィ2", role: "CB", animal: "rabbit",   fur: FUR.rabbit,   stats: "speedy" },
    { name: "守フライ2", role: "CB", animal: "cat",      fur: FUR.cat,      stats: "speedy" },
    { name: "守セーフ1", role: "S",  animal: "owl",      fur: FUR.owl,      stats: "allround" },
    { name: "守セーフ2", role: "S",  animal: "squirrel", fur: FUR.squirrel, stats: "allround" }
  ];

  // ===== 相手（away）の攻撃ユニット11体 =====
  // QB×1, OL×5, WR×3, TE×1, RB×1。all wolf（相手チームカラー）
  var AWAY_OFFENSE = [
    { name: "敵QB",   role: "QB", animal: "wolf", fur: FUR.wolf, stats: "allround" },
    { name: "敵OL1",  role: "OL", animal: "wolf", fur: FUR.wolf, stats: "power" },
    { name: "敵OL2",  role: "OL", animal: "wolf", fur: FUR.wolf, stats: "power" },
    { name: "敵OL3",  role: "OL", animal: "wolf", fur: FUR.wolf, stats: "power" },
    { name: "敵OL4",  role: "OL", animal: "wolf", fur: FUR.wolf, stats: "power" },
    { name: "敵OL5",  role: "OL", animal: "wolf", fur: FUR.wolf, stats: "power" },
    { name: "敵WR1",  role: "WR", animal: "wolf", fur: FUR.wolf, stats: "speedy" },
    { name: "敵WR2",  role: "WR", animal: "wolf", fur: FUR.wolf, stats: "hands" },
    { name: "敵WR3",  role: "WR", animal: "wolf", fur: FUR.wolf, stats: "speedy" },
    { name: "敵TE",   role: "TE", animal: "wolf", fur: FUR.wolf, stats: "allround" },
    { name: "敵RB",   role: "RB", animal: "wolf", fur: FUR.wolf, stats: "speedy" }
  ];

  // ===== マネージャー（撮影担当）の設定 =====
  var MANAGER = { name: "ミケ", fur: 0xf0e2c8, jacket: 0x2f9e8f };

  // 動物選手を1体つくる（role=見た目の種類, jersey=ユニフォーム色, fur=毛色）
  function makeAnimal(role, jersey, fur) {
    var g = new THREE.Group();
    var DARK = 0x2b2b2b, WHITE = 0xffffff;

    // 脚と靴
    g.add(box(0.42, 0.7, 0.5, fur, -0.3, 0.45, 0));
    g.add(box(0.42, 0.7, 0.5, fur, 0.3, 0.45, 0));
    g.add(box(0.5, 0.26, 0.74, 0x4a3322, -0.3, 0.13, 0.1));
    g.add(box(0.5, 0.26, 0.74, 0x4a3322, 0.3, 0.13, 0.1));

    // 胴体（ユニフォーム）
    g.add(box(1.32, 1.15, 1.0, jersey, 0, 1.35, 0));
    // 肩パッド（アメフトらしいシルエット）
    g.add(box(0.52, 0.42, 1.06, jersey, -0.66, 1.82, 0));
    g.add(box(0.52, 0.42, 1.06, jersey, 0.66, 1.82, 0));
    // えり＋胸の番号プレート＋縦ライン
    g.add(box(0.5, 0.2, 0.5, fur, 0, 1.96, 0.06));
    g.add(box(0.66, 0.72, 0.06, WHITE, 0, 1.42, 0.52));
    g.add(box(0.08, 0.92, 0.05, jersey, 0, 1.42, 0.56));
    // 腕（ユニフォーム）＋そで口ライン＋手（毛色）＋リストバンド
    g.add(box(0.32, 1.0, 0.42, jersey, -0.86, 1.42, 0));
    g.add(box(0.32, 1.0, 0.42, jersey, 0.86, 1.42, 0));
    g.add(box(0.34, 0.12, 0.44, WHITE, -0.86, 1.74, 0.02));
    g.add(box(0.34, 0.12, 0.44, WHITE, 0.86, 1.74, 0.02));
    g.add(box(0.36, 0.34, 0.46, fur, -0.86, 0.92, 0.04));
    g.add(box(0.36, 0.34, 0.46, fur, 0.86, 0.92, 0.04));
    g.add(box(0.38, 0.14, 0.48, 0xffd166, -0.86, 1.12, 0.04));
    g.add(box(0.38, 0.14, 0.48, 0xffd166, 0.86, 1.12, 0.04));

    // 頭（サブグループ）＋共通の顔（白目＋黒目＋ほっぺ）
    var head = new THREE.Group();
    head.position.set(0, 2.42, 0.02);
    head.add(box(1.1, 1.02, 1.0, fur, 0, 0, 0));
    head.add(box(0.28, 0.32, 0.1, WHITE, -0.25, 0.1, 0.47));
    head.add(box(0.28, 0.32, 0.1, WHITE, 0.25, 0.1, 0.47));
    head.add(box(0.14, 0.18, 0.1, DARK, -0.25, 0.08, 0.55));
    head.add(box(0.14, 0.18, 0.1, DARK, 0.25, 0.08, 0.55));
    head.add(box(0.16, 0.1, 0.06, 0xf6a6a0, -0.43, -0.02, 0.46));
    head.add(box(0.16, 0.1, 0.06, 0xf6a6a0, 0.43, -0.02, 0.46));

    if (role === "owl") {
      head.add(box(0.44, 0.44, 0.05, 0xf4e4b0, -0.25, 0.08, 0.45));
      head.add(box(0.44, 0.44, 0.05, 0xf4e4b0, 0.25, 0.08, 0.45));
      head.add(box(0.22, 0.28, 0.24, 0xf4a93c, 0, -0.2, 0.52));
      head.add(box(0.22, 0.4, 0.22, fur, -0.34, 0.64, 0));
      head.add(box(0.22, 0.4, 0.22, fur, 0.34, 0.64, 0));
    } else if (role === "rabbit") {
      head.add(box(0.24, 0.9, 0.2, fur, -0.26, 0.88, 0));
      head.add(box(0.24, 0.9, 0.2, fur, 0.26, 0.88, 0));
      head.add(box(0.12, 0.62, 0.06, 0xf3b6c2, -0.26, 0.86, 0.11));
      head.add(box(0.12, 0.62, 0.06, 0xf3b6c2, 0.26, 0.86, 0.11));
      head.add(box(0.16, 0.12, 0.12, 0xf3b6c2, 0, -0.1, 0.52));
      head.add(box(0.2, 0.16, 0.08, WHITE, 0, -0.26, 0.5));
    } else if (role === "squirrel") {
      head.add(box(0.24, 0.36, 0.22, fur, -0.32, 0.62, 0));
      head.add(box(0.24, 0.36, 0.22, fur, 0.32, 0.62, 0));
      head.add(box(0.24, 0.22, 0.2, 0xe8b07a, -0.42, -0.12, 0.34));
      head.add(box(0.24, 0.22, 0.2, 0xe8b07a, 0.42, -0.12, 0.34));
      head.add(box(0.16, 0.18, 0.08, WHITE, 0, -0.24, 0.5));
      g.add(box(0.5, 1.5, 0.5, fur, 0, 1.55, -0.78));
      g.add(box(0.52, 0.34, 0.52, 0xecc39a, 0, 1.95, -0.78));
      g.add(box(0.44, 0.6, 0.44, fur, 0, 2.5, -0.5));
      g.add(box(0.46, 0.3, 0.46, 0xecc39a, 0, 2.66, -0.5));
    } else if (role === "bear") {
      head.add(box(0.36, 0.36, 0.22, fur, -0.42, 0.5, 0));
      head.add(box(0.36, 0.36, 0.22, fur, 0.42, 0.5, 0));
      head.add(box(0.2, 0.2, 0.1, 0xc79b6a, -0.42, 0.5, 0.09));
      head.add(box(0.2, 0.2, 0.1, 0xc79b6a, 0.42, 0.5, 0.09));
      head.add(box(0.52, 0.42, 0.24, 0xd8b88c, 0, -0.2, 0.48));
      head.add(box(0.2, 0.16, 0.12, DARK, 0, -0.12, 0.62));
    } else if (role === "rhino") {
      head.add(box(0.2, 0.28, 0.16, fur, -0.38, 0.56, 0));
      head.add(box(0.2, 0.28, 0.16, fur, 0.38, 0.56, 0));
      head.add(box(0.62, 0.44, 0.32, fur, 0, -0.24, 0.44));
      head.add(box(0.18, 0.42, 0.2, 0xe6e0ce, 0, 0.02, 0.66));
      head.add(box(0.1, 0.22, 0.14, 0xe6e0ce, 0, 0.34, 0.62));
    } else if (role === "wolf") {
      head.add(box(0.28, 0.42, 0.2, fur, -0.32, 0.62, 0));
      head.add(box(0.28, 0.42, 0.2, fur, 0.32, 0.62, 0));
      head.add(box(0.18, 0.18, 0.12, 0x33373d, -0.32, 0.8, 0.02));
      head.add(box(0.18, 0.18, 0.12, 0x33373d, 0.32, 0.8, 0.02));
      head.add(box(0.26, 0.07, 0.08, 0x5a6675, -0.25, 0.32, 0.5));
      head.add(box(0.26, 0.07, 0.08, 0x5a6675, 0.25, 0.32, 0.5));
      head.add(box(0.36, 0.32, 0.3, 0xe7ecf2, 0, -0.2, 0.46));
      head.add(box(0.16, 0.14, 0.12, DARK, 0, -0.16, 0.62));
      g.add(box(0.44, 0.5, 1.1, fur, 0, 1.2, -0.72));
      g.add(box(0.42, 0.48, 0.36, 0xe7ecf2, 0, 1.2, -1.28));
    } else if (role === "cat") {
      head.add(box(0.28, 0.32, 0.16, fur, -0.3, 0.62, 0));
      head.add(box(0.28, 0.32, 0.16, fur, 0.3, 0.62, 0));
      head.add(box(0.14, 0.18, 0.06, 0xf3b6c2, -0.3, 0.6, 0.09));
      head.add(box(0.14, 0.18, 0.06, 0xf3b6c2, 0.3, 0.6, 0.09));
      head.add(box(0.14, 0.1, 0.1, 0xf3b6c2, 0, -0.12, 0.54));
      head.add(box(0.42, 0.03, 0.03, 0x3a3a3a, -0.46, -0.16, 0.5));
      head.add(box(0.42, 0.03, 0.03, 0x3a3a3a, 0.46, -0.16, 0.5));
      g.add(box(0.26, 1.0, 0.26, fur, 0, 1.45, -0.62));
      g.add(box(0.28, 0.24, 0.28, 0x6b5a48, 0, 1.55, -0.62));
      g.add(box(0.28, 0.26, 0.28, fur, 0, 2.0, -0.62));
    } else {
      head.add(box(0.3, 0.3, 0.18, fur, -0.38, 0.52, 0));
      head.add(box(0.3, 0.3, 0.18, fur, 0.38, 0.52, 0));
      head.add(box(0.18, 0.14, 0.12, DARK, 0, -0.16, 0.56));
    }

    g.add(head);
    g.scale.set(0.7, 0.7, 0.7);   // 身長≈2ヤード(6フィート)。1 unit=1ヤードのフィールドに実寸を合わせる
    g.userData.base = g.position.clone();
    g.userData.head = head;
    return g;
  }

  // サイドラインで試合を撮影するマネージャー（記録・分析の可視化）
  function makeManager(cfg) {
    cfg = cfg || MANAGER;
    var g = new THREE.Group();
    var fur = cfg.fur, jacket = cfg.jacket;
    g.add(box(0.5, 0.5, 0.5, 0x6b4a2f, -0.3, 0.25, 0));
    g.add(box(0.5, 0.5, 0.5, 0x6b4a2f, 0.3, 0.25, 0));
    g.add(box(1.2, 1.0, 0.9, jacket, 0, 1.0, 0));
    g.add(box(0.05, 0.42, 0.04, 0x333a42, -0.18, 1.25, 0.46));
    g.add(box(0.05, 0.42, 0.04, 0x333a42, 0.18, 1.25, 0.46));
    g.add(box(0.34, 0.26, 0.05, 0xffffff, 0, 0.98, 0.47));
    g.add(box(0.95, 0.9, 0.9, fur, 0, 1.85, 0.04));
    g.add(box(0.24, 0.26, 0.08, 0xffffff, -0.22, 1.92, 0.46));
    g.add(box(0.24, 0.26, 0.08, 0xffffff, 0.22, 1.92, 0.46));
    g.add(box(0.12, 0.15, 0.08, 0x222222, -0.22, 1.9, 0.51));
    g.add(box(0.12, 0.15, 0.08, 0x222222, 0.22, 1.9, 0.51));
    g.add(box(0.14, 0.1, 0.1, 0xf3b6c2, 0, 1.74, 0.48));
    g.add(box(0.26, 0.26, 0.12, fur, -0.3, 2.4, 0));
    g.add(box(0.26, 0.26, 0.12, fur, 0.3, 2.4, 0));
    g.add(box(0.22, 0.7, 0.22, fur, 0, 1.0, -0.6));
    g.add(box(0.18, 0.18, 0.5, jacket, -0.4, 1.55, 0.32));
    g.add(box(0.18, 0.18, 0.5, jacket, 0.4, 1.55, 0.32));
    var cam = new THREE.Group();
    cam.add(box(0.85, 0.62, 0.78, 0x3a4048, 0, 0, 0));            // 本体
    cam.add(box(0.52, 0.16, 0.5, 0x515a66, 0, 0.39, -0.05));      // 上ハンドル
    var lens = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.26, 0.55, 16), new THREE.MeshLambertMaterial({ color: 0x0d0f12 }));
    lens.rotation.x = Math.PI / 2; lens.position.set(0, 0, 0.55); cam.add(lens);
    cam.add(box(0.52, 0.52, 0.08, 0x9fb6c9, 0, 0, 0.4));          // レンズの明るい縁
    var rec = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    rec.position.set(0.34, 0.28, 0.22); cam.add(rec);
    cam.add(box(0.2, 0.22, 0.22, 0x2b2f35, -0.32, 0.06, -0.34));  // 後ろのアイカップ
    cam.position.set(0, 1.86, 0.62); g.add(cam);
    g.scale.set(0.8, 0.8, 0.8);   // 選手(0.7)に合わせてサイドラインのマネージャーも縮小
    g.userData.rec = rec;
    return g;
  }

  // stats はプリセット名(文字列)でも直接オブジェクトでも受け付ける
  function resolveStats(s) {
    if (typeof s === "string") return STAT_PRESETS[s] || STAT_PRESETS.allround;
    return s || STAT_PRESETS.allround;
  }

  // 3要素（役割・見た目・パラメータ）を合成して1選手をつくる。
  // 見た目は animal/fur から、役割と能力は userData に持たせる。
  function makePlayer(cfg, jersey) {
    var g = makeAnimal(cfg.animal, jersey, cfg.fur);
    g.userData.name = cfg.name;
    g.userData.role = cfg.role;
    g.userData.animal = cfg.animal;
    g.userData.stats = resolveStats(cfg.stats);
    return g;
  }

  global.BoxelChars = {
    FUR: FUR, TEAM: TEAM, ROLES: ROLES, STAT_PRESETS: STAT_PRESETS,
    OFFENSE: OFFENSE, DEFENSE: DEFENSE,
    HOME_DEFENSE: HOME_DEFENSE, AWAY_OFFENSE: AWAY_OFFENSE,
    MANAGER: MANAGER,
    box: box, makeAnimal: makeAnimal, makeManager: makeManager,
    makePlayer: makePlayer, resolveStats: resolveStats
  };
})(window);
