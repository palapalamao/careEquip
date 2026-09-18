// 版本号自动递增：node scripts/bump-version.mjs [patch|minor|major]
// 规则：每次构建 patch+1；新增功能 minor+1（由开发流程显式调用）；破坏性变更 major+1
import { readFileSync, writeFileSync } from "node:fs";
const kind = process.argv[2] || "patch";
if (!["patch", "minor", "major"].includes(kind)) {
  console.error(`unknown bump kind: ${kind}`);
  process.exit(1);
}
const pkgPath = new URL("../ts/package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const [maj, min, pat] = pkg.version.split(".").map(Number);
pkg.version =
  kind === "major" ? `${maj + 1}.0.0` : kind === "minor" ? `${maj}.${min + 1}.0` : `${maj}.${min}.${(pat || 0) + 1}`;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`version -> ${pkg.version} (${kind})`);
