// 開発者へのご意見掲示板 API（Netlify Functions 2.0 形式）
// GET  /.netlify/functions/board  : 投稿一覧を新しい順で最大 MAX_RETURN 件返す
// POST /.netlify/functions/board  : { text } を受理して投稿を追加する
//
// 保存先は Netlify Blobs（getStore はハンドラ内でのみ呼び出す。
// モジュール読み込み時点では Blobs へアクセスしないため、Netlify 実行環境外
// （ローカルの import 確認など）でもモジュール自体の読み込みは失敗しない）。
// モダン形式（default export + Request/Response）では Netlify 実行環境が
// Blobs の接続情報を自動構成するため、手動接続（connectLambda 等）は不要。
import { getStore } from "@netlify/blobs";

const STORE_NAME = "board";
const RATE_LIMIT_STORE_NAME = "board-ratelimit";
const POSTS_KEY = "posts";

const MAX_POSTS = 200; // Blobs に保存しておく投稿数の上限（超過分は古いものから破棄）
const MAX_RETURN = 100; // GET で返す投稿数の上限
const MIN_TEXT_LENGTH = 1;
const MAX_TEXT_LENGTH = 300;
const RATE_LIMIT_MS = 30 * 1000; // 同一IPからの連続投稿を制限する間隔

// NGワード（代表的な不適切語の簡易フィルタ。完全な検出を保証するものではない）
const NG_WORDS = [
  "死ね",
  "殺す",
  "ぶっ殺",
  "氏ね",
  "きえろ",
  "消えろ",
  "クズ",
  "カス",
  "てめえ",
  "ばか野郎",
  "馬鹿野郎",
];
const URL_PATTERN = /https?:\/\//i;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function containsNgWord(text) {
  return NG_WORDS.some(function (word) {
    return text.indexOf(word) !== -1;
  });
}

function getClientIp(req, context) {
  // context.ip が最も確実。取得できない場合はヘッダを参照する
  if (context && context.ip) return context.ip;
  if (req && req.headers && typeof req.headers.get === "function") {
    return req.headers.get("x-nf-client-connection-ip") || "";
  }
  return "";
}

async function handleGet(store) {
  const posts = (await store.get(POSTS_KEY, { type: "json" })) || [];
  const sorted = posts.slice().sort(function (a, b) {
    return b.createdAt - a.createdAt;
  });
  return jsonResponse(200, { posts: sorted.slice(0, MAX_RETURN) });
}

async function handlePost(req, context, store) {
  let payload;
  try {
    payload = await req.json();
  } catch (err) {
    return jsonResponse(400, { error: "リクエストの形式が正しくありません" });
  }

  const text = payload ? payload.text : undefined;
  if (typeof text !== "string") {
    return jsonResponse(400, { error: "投稿内容は文字列で指定してください" });
  }

  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH || trimmed.length > MAX_TEXT_LENGTH) {
    return jsonResponse(400, { error: "投稿は1文字以上300文字以内で入力してください" });
  }

  if (containsNgWord(trimmed) || URL_PATTERN.test(trimmed)) {
    return jsonResponse(400, { error: "その内容は投稿できません" });
  }

  // 簡易スパム対策: 同一IPからの連続投稿を一定間隔で制限する
  const ip = getClientIp(req, context);
  if (ip) {
    const rateStore = getStore(RATE_LIMIT_STORE_NAME);
    const rateKey = "ip-" + ip;
    const lastPostedAt = await rateStore.get(rateKey, { type: "json" });
    const now = Date.now();
    if (typeof lastPostedAt === "number" && now - lastPostedAt < RATE_LIMIT_MS) {
      return jsonResponse(429, { error: "すこし間をあけてから投稿してね" });
    }
    await rateStore.setJSON(rateKey, now);
  }

  const posts = (await store.get(POSTS_KEY, { type: "json" })) || [];
  const newPost = {
    id: "post-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    text: trimmed,
    createdAt: Date.now(),
  };
  posts.push(newPost);
  posts.sort(function (a, b) {
    return b.createdAt - a.createdAt;
  });
  const trimmedPosts = posts.slice(0, MAX_POSTS);
  await store.setJSON(POSTS_KEY, trimmedPosts);

  return jsonResponse(201, { post: newPost });
}

export default async (req, context) => {
  // 対応外メソッドは Blobs へアクセスする前に弾く
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse(405, { error: "このメソッドには対応していません" });
  }

  try {
    const store = getStore(STORE_NAME);
    if (req.method === "GET") {
      return await handleGet(store);
    }
    return await handlePost(req, context, store);
  } catch (err) {
    // 例外は握りつぶさずログに残したうえで、利用者にはエラーのみ返す
    console.error("board function error:", err);
    return jsonResponse(500, { error: "サーバーエラーが発生しました" });
  }
};
