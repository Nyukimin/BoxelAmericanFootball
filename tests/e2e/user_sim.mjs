/**
 * tests/e2e/user_sim.mjs
 * ユーザー視点 E2E: 実UIをモック上で「人間のように」ランダム操作し、
 * 全シーン（編成→隊形→プレー→ターゲット→FG/PAT/オンサイド→守備構え→作戦→タップ送り…）を
 * 画面状態に従って進める。乱数をシード化して seed=1..10 を走らせ、各ステップで invariant を検証。
 * 実行: node tests/e2e/user_sim.mjs （ブラウザ不使用・in-sandbox 可）
 * 土台のモック/ローダは tests/headless/flow.mjs と同方式。
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");

// ============================================================
// 1. Vector3 実装（本物の計算）
// ============================================================
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  lerp(v, t) {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    this.z += (v.z - this.z) * t;
    return this;
  }
}

// ============================================================
// 2. THREE モック
// ============================================================
class Group {
  constructor() {
    this.position = new Vector3();
    this.rotation = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.userData = {};
    this.children = [];
    this.visible = true;
  }
  add(child) { this.children.push(child); return this; }
  remove(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    return this;
  }
}

class Mesh extends Group {
  constructor(geometry, material) {
    super();
    this.geometry = geometry || null;
    this.material = material || null;
  }
}

class Line extends Group {
  constructor(geometry, material) {
    super();
    this.geometry = geometry || null;
    this.material = material || null;
  }
}

class Scene extends Group {
  constructor() {
    super();
    this.background = null;
    this.fog = null;
  }
}

class PerspectiveCamera extends Group {
  constructor(fov, aspect, near, far) {
    super();
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
  }
  updateProjectionMatrix() {}
  lookAt(v) {}
}

class WebGLRenderer {
  constructor(opts) { this.domElement = {}; }
  setPixelRatio(r) {}
  setSize(w, h) {}
  render(scene, camera) {}
}

class AmbientLight extends Group {
  constructor(color, intensity) { super(); }
}

class DirectionalLight extends Group {
  constructor(color, intensity) {
    super();
    this.position = new Vector3();
    this.position.set = (x, y, z) => { this.position.x = x; this.position.y = y; this.position.z = z; return this.position; };
  }
}

class Fog {
  constructor(color, near, far) { this.color = color; this.near = near; this.far = far; }
}

class Color {
  constructor(hex) { this.hex = hex; }
}

class BoxGeometry {
  constructor(w, h, d) { this.type = "BoxGeometry"; }
}

class SphereGeometry {
  constructor(r, ws, hs) { this.type = "SphereGeometry"; }
}

class CylinderGeometry {
  constructor(rTop, rBot, h, seg) { this.type = "CylinderGeometry"; }
}

class ConeGeometry {
  constructor(r, h, seg) { this.type = "ConeGeometry"; }
}

class TorusGeometry {
  constructor(r, tube, rs, ts) { this.type = "TorusGeometry"; }
}

class MeshLambertMaterial {
  constructor(opts) { this.opts = opts || {}; }
}

class MeshBasicMaterial {
  constructor(opts) { this.opts = opts || {}; }
}

class LineBasicMaterial {
  constructor(opts) { this.opts = opts || {}; }
}

class BufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.needsUpdate = false;
  }
}

class BufferGeometry {
  constructor() {
    this.attributes = {};
    this._drawRangeCount = 0;
  }
  setAttribute(name, attr) {
    this.attributes[name] = attr;
    return this;
  }
  setDrawRange(start, count) {
    this._drawRangeStart = start;
    this._drawRangeCount = count;
  }
}

class Clock {
  constructor() { this._elapsed = 0; }
  getDelta() { this._elapsed += 0.05; return 0.05; }
  get elapsedTime() { return this._elapsed; }
}

// ============================================================
// 3. DOM モック
// ============================================================
function makeElement(tag, id) {
  const el = {
    _id: id || null,
    _tag: tag || "div",
    textContent: "",
    _innerHTML: "",
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) {
      this._innerHTML = v;
      if (v === "" || v === null) this.children = [];
    },
    style: {},
    classList: makeClassList(),
    onclick: null,
    children: [],
    _attrs: {},
    appendChild(child) { this.children.push(child); return child; },
    getAttribute(name) { return this._attrs[name] !== undefined ? this._attrs[name] : null; },
    setAttribute(name, val) { this._attrs[name] = val; },
    querySelector(sel) {
      // スタブ: "h1" / "p" を返す
      const sub = makeElement(sel.replace(/[^a-z0-9]/gi, ""), null);
      sub.textContent = "";
      return sub;
    }
  };
  return el;
}

function makeClassList() {
  const classes = new Set();
  return {
    toggle(cls, force) {
      if (force === undefined) {
        if (classes.has(cls)) classes.delete(cls); else classes.add(cls);
      } else {
        if (force) classes.add(cls); else classes.delete(cls);
      }
    },
    add(cls) { classes.add(cls); },
    remove(cls) { classes.delete(cls); },
    contains(cls) { return classes.has(cls); }
  };
}

// ID ごとにキャッシュされた要素を保持
const domElements = {};

function getElementById(id) {
  if (!domElements[id]) {
    const el = makeElement("div", id);
    // "start" 要素は特殊：querySelector("h1") / ("p") をキャッシュ
    if (id === "start") {
      const h1 = makeElement("h1", null);
      const p  = makeElement("p", null);
      el._h1 = h1;
      el._p  = p;
      el.querySelector = function(sel) {
        if (sel === "h1") return this._h1;
        if (sel === "p")  return this._p;
        return makeElement(sel, null);
      };
      el.style.display = "flex"; // 初期表示（スタート画面表示中）
    }
    domElements[id] = el;
  }
  return domElements[id];
}

function createElement(tag) {
  return makeElement(tag, null);
}

// #views button の 3 要素
const viewButtons = ["quarter", "top", "player"].map(function(v) {
  const btn = makeElement("button", null);
  btn._attrs["data-v"] = v;
  btn.classList.add(v === "quarter" ? "on" : "");
  return btn;
});

function querySelectorAll(sel) {
  if (sel === "#views button") {
    return viewButtons;
  }
  return [];
}

// ============================================================
// 4. global セットアップ
// ============================================================
global.window = global;
global.document = {
  getElementById,
  createElement,
  querySelectorAll,
  // インラインスクリプト内でも document.getElementById が使えるように
};

global.THREE = {
  Vector3,
  Group,
  Mesh,
  Line,
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  Fog,
  Color,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  ConeGeometry,
  TorusGeometry,
  MeshLambertMaterial,
  MeshBasicMaterial,
  LineBasicMaterial,
  BufferAttribute,
  BufferGeometry,
  Clock,
};

// requestAnimationFrame: 最新コールバックを __raf に保存
global.requestAnimationFrame = function(cb) {
  global.__raf = cb;
};

// setTimeout: 即時同期実行（無限ループを防ぐため深さ制限）
let _setTimeoutDepth = 0;
const MAX_TIMEOUT_DEPTH = 50;
global.setTimeout = function(cb, delay) {
  if (_setTimeoutDepth < MAX_TIMEOUT_DEPTH) {
    _setTimeoutDepth++;
    try { cb(); } catch(e) { /* ignore */ }
    _setTimeoutDepth--;
  }
  return 0;
};
global.clearTimeout = function() {};

global.window.devicePixelRatio = 1;
global.window.innerWidth  = 1024;
global.window.innerHeight = 720;
global.window.addEventListener = function() {};

// Math.random を固定する変数（後で差し替え可能）
const origRandom = Math.random;

// ============================================================
// 5. ソース読み込み
// ============================================================
function loadFile(relPath) {
  const absPath = path.join(ROOT, relPath);
  return fs.readFileSync(absPath, "utf-8");
}

function execCode(code, label) {
  try {
    // Function コンストラクタでグローバルスコープ上で実行
    // グローバルな global オブジェクトを this として渡す
    const fn = new Function(
      "window", "document", "THREE", "requestAnimationFrame",
      "setTimeout", "clearTimeout", "Math",
      code
    );
    fn(
      global.window, global.document, global.THREE,
      global.requestAnimationFrame, global.setTimeout, global.clearTimeout,
      Math
    );
  } catch(e) {
    throw new Error(`[${label}] 実行エラー: ${e.message}\n${e.stack}`);
  }
}

// インライン <script>（src 属性なし）を index.html から抽出
function extractInlineScript(html) {
  const lines = html.split("\n");
  const scripts = [];
  let inScript = false;
  let buf = [];
  for (const line of lines) {
    if (!inScript && /^<script>/.test(line.trim())) {
      inScript = true;
      buf = [];
      continue;
    }
    if (inScript && /^<\/script>/.test(line.trim())) {
      scripts.push(buf.join("\n"));
      inScript = false;
      buf = [];
      continue;
    }
    if (inScript) buf.push(line);
  }
  return scripts;
}

// ============================================================
// 6. assert ヘルパー
// ============================================================
let allPass = true;
const results = [];

function assert(label, cond) {
  const ok = cond === true;
  if (ok === false) allPass = false;
  const mark = ok ? "[OK]" : "[NG]";
  console.log(`${mark} ${label}`);
  results.push({ label, ok });
}

// ============================================================
// 7. ドライバヘルパー
// ============================================================
function clickStart() {
  const btn = getElementById("startBtn");
  if (btn && btn.onclick) btn.onclick();
}

function cards() {
  return getElementById("cards").children;
}

function pump(n) {
  for (let i = 0; i < n; i++) {
    if (global.__raf) {
      try { global.__raf(); } catch(e) { /* ignore anim errors */ }
    }
  }
}

// 現在のプレーカードを 1 枚クリックし、状態が落ち着くまで pump する
function playResolve(cardIndex = 0) {
  const cs = cards();
  if (cs && cs.length > cardIndex && cs[cardIndex].onclick) {
    cs[cardIndex].onclick();
  }
  // 最大 200 回 pump して落ち着くのを待つ（長距離ランは走速を現実的に保つぶんアニメが長い）
  for (let i = 0; i < 200; i++) {
    pump(1);
    const startEl = getElementById("start");
    const startVisible = startEl.style.display !== "none";
    const hasCards = cards().length > 0;
    if (startVisible || hasCards) break;
  }
}


// ============================================================
// ユーザー視点 E2E ドライバ（ランダム選択・invariant検証・10シード）
// 実行: node tests/e2e/user_sim.mjs
// ============================================================

// ゲーム読み込み（1回）
let loadError = null;
try {
  execCode(loadFile("characters.js"), "characters.js");
  execCode(loadFile("gamelogic.js"), "gamelogic.js");
  const inlineScripts = extractInlineScript(loadFile("index.html"));
  for (const s of inlineScripts) execCode(s, "index.html inline");
} catch (e) { loadError = e; }
if (loadError) { console.error("LOAD ERROR:", loadError.message); process.exit(1); }

const BT = global.window.__BoxelTest;
if (!BT || !BT.getState) { console.error("__BoxelTest.getState 未公開"); process.exit(1); }
// ゲーム内 logPlay 等の console.log を抑制（サマリは LOG で出力）
const LOG = console.log;
console.log = function () {};
const avgZ = function (arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i].position.z; return arr.length ? s / arr.length : 0; };

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VALID_DELTA = [0, 1, 2, 3, 6, 7, 8];

function runGame(seed) {
  // ドライバの選択用RNG（ゲーム内RNGとは別ストリーム）
  const drv = mulberry32(((seed * 2654435761) >>> 0) ^ 0x9e3779b9);
  // ゲーム内乱数をシード化（gameRng/_rng が global Math.random を参照する）
  Math.random = mulberry32(seed >>> 0);

  clickStart();   // start画面を隠して resetGame

  const st = () => BT.getState();
  function snap() { const s = st(); return { q: s.quarter, clock: Math.round(s.clock), mode: s.mode, down: s.down, toGo: s.toGo, los: s.los, oppDown: s.oppDown, home: s.home, away: s.away }; }

  let lastQuarter = st().quarter, lastClock = st().clock;
  let prevHome = st().home, prevAway = st().away;
  const fails = [];
  let steps = 0, ended = false, snaps = 0;

  function isStable() {
    const startEl = getElementById("start");
    const overTxt = startEl._h1 ? startEl._h1.textContent : "";
    if (startEl.style.display !== "none" && overTxt.indexOf("試合終了") >= 0) return "over";
    const tap = getElementById("tapNext");
    if (tap && tap.style && tap.style.display === "block") return "tap";
    if (cards().length > 0) return "cards";
    return "anim";
  }

  for (steps = 0; steps < 4000; steps++) {
    const stable = isStable();
    if (stable === "over") { ended = true; break; }

    if (stable !== "anim") {
      // 安定点でのみ invariant をチェック（アニメ中の過渡状態は除外）
      try {
        const s = st();
        if (s.home < 0 || s.away < 0) fails.push("score<0 " + JSON.stringify(snap()));
        if (s.quarter < 1 || s.quarter > 5) fails.push("quarter範囲 " + JSON.stringify(snap()));
        if (s.los < 0 || s.los > 120) fails.push("los範囲 los=" + s.los);
        if (s.mode === "offense" && (s.down < 1 || s.down > 4)) fails.push("down範囲 down=" + s.down);
        if (s.mode === "defense" && (s.oppDown < 1 || s.oppDown > 5)) fails.push("oppDown範囲 oppDown=" + s.oppDown);
        if (s.quarter === lastQuarter && s.clock > lastClock + 0.001) fails.push("clock増加 " + lastClock + "->" + s.clock + " @Q" + s.quarter);
        lastQuarter = s.quarter; lastClock = s.clock;
        const dh = s.home - prevHome, da = s.away - prevAway;
        if (VALID_DELTA.indexOf(dh) < 0) fails.push("home得点増分 " + dh + " " + JSON.stringify(snap()));
        if (VALID_DELTA.indexOf(da) < 0) fails.push("away得点増分 " + da + " " + JSON.stringify(snap()));
        prevHome = s.home; prevAway = s.away;
        // 味方は手前(低z)・相手は奥(高z): 攻撃の意思決定点で味方が奥に回っていないか
        if (stable === "cards" && s.mode === "offense") {
          const off = BT.getOffense(), def = BT.getDefense();
          if (off.length && def.length && avgZ(off) > avgZ(def) + 12) fails.push("味方が奥(手前/奥が反転) offZ=" + avgZ(off).toFixed(0) + " defZ=" + avgZ(def).toFixed(0));
        }
      } catch (e) { fails.push("invariant例外 " + e.message); break; }
      if (fails.length > 0) break;
    }

    if (stable === "tap") {
      const tap = getElementById("tapNext");
      try { if (tap.onclick) tap.onclick(); } catch (e) { fails.push("tap例外 " + e.message); break; }
      continue;
    }
    if (stable === "cards") {
      const cs = cards();
      const idx = Math.floor(drv() * cs.length) % cs.length;
      const card = cs[idx];
      snaps++;
      try { if (card.onclick) card.onclick(); } catch (e) { fails.push("card例外 " + e.message + " card=" + (card._innerHTML || "")); break; }
      pump(10);
      continue;
    }
    // anim
    pump(5);
  }

  if (ended === false && fails.length === 0) fails.push("試合終了に未到達(進行不能/上限) " + JSON.stringify(snap()));
  const s = st();
  return { seed, ok: fails.length === 0, steps, snaps, ended, score: { home: s.home, away: s.away }, fails: fails.slice(0, 4), sysTail: BT.getSysLog ? BT.getSysLog().slice(-8) : [] };
}

let allOk = true;
const summary = [];
// 試合数は環境変数 GAMES で指定可（既定10）。ヘッドレスなので大量試合も高速・throttlingなし。
const N = Math.max(1, parseInt(process.env.GAMES || "10", 10) || 10);
const VERBOSE = process.env.VERBOSE === "1" || N <= 20;   // 大量時はNGのみ出力
let ngCount = 0;
for (let seed = 1; seed <= N; seed++) {
  let res;
  try { res = runGame(seed); } catch (e) { res = { seed, ok: false, steps: -1, fails: ["runner例外 " + e.message + " " + (e.stack || "").split("\n")[1] ], score: {} }; }
  if (res.ok === false) { allOk = false; ngCount++; }
  summary.push(res);
  if (VERBOSE || res.ok === false) {
    LOG("seed=" + seed + " " + (res.ok ? "[OK]" : "[NG]") + " steps=" + res.steps + " snaps=" + res.snaps + " ended=" + res.ended + " score=" + (res.score ? (res.score.home + "-" + res.score.away) : "?") + (res.ok ? "" : "  FAILS: " + JSON.stringify(res.fails)));
  }
}
// 集計サマリ（スコア分布・完走率）
const ended = summary.filter(function (r) { return r.ended; }).length;
const scored = summary.filter(function (r) { return r.score && (r.score.home + r.score.away) > 0; }).length;
LOG("");
LOG("集計: 完走 " + ended + "/" + N + " / 得点あり " + scored + "/" + N + " / NG " + ngCount);
LOG("=== USER-SIM E2E " + (allOk ? ("ALL OK (" + N + "/" + N + ")") : ("FAIL (NG " + ngCount + "/" + N + ")")) + " ===");
if (allOk === false) {
  const ng = summary.find(function (r) { return r.ok === false; });
  LOG("最初のNG seed=" + ng.seed + " のsysLog末尾:");
  LOG(JSON.stringify(ng.sysTail));
}
process.exit(allOk ? 0 : 1);
