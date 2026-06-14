// 全テストを一括実行するランナー。
// 使い方: node tests/run.mjs
// 注意: `node tests/*.mjs` は最初の1ファイルしか実行しないので、必ずこのランナーを使う。
import { readdirSync } from "fs";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".test.mjs")).sort();
let failed = 0;

for (const f of files) {
  console.log("\n===== " + f + " =====");
  try {
    execFileSync("node", [join(dir, f)], { stdio: "inherit" });
  } catch (e) {
    failed += 1;
    console.log("[NG] " + f + " が失敗しました");
  }
}

console.log("\n========================================");
console.log((failed === 0 ? "[OK] " : "[NG] ") + (files.length - failed) + "/" + files.length + " ファイル成功");
process.exit(failed === 0 ? 0 : 1);
