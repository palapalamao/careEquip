import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const version = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version;

let gitSha = "dev";
try {
  gitSha = execSync("git rev-parse --short HEAD", { cwd: fileURLToPath(new URL(".", import.meta.url)) })
    .toString()
    .trim();
} catch {
  /* 不在 git 环境中时忽略 */
}
const buildId = `${version}+${gitSha}`;

// 给 index.html 注入构建标记与禁缓存声明，供前端启动时自检版本
const buildMarker = {
  name: "dm-build-marker",
  transformIndexHtml(html) {
    return html.replace(
      "</head>",
      `  <meta http-equiv="Cache-Control" content="no-store" />\n  <!-- dm-build:${buildId} -->\n</head>`,
    );
  },
};

export default defineConfig({
  base: "./",
  plugins: [react(), buildMarker],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: {
    __UI_VERSION__: JSON.stringify(version),
    __UI_BUILD_ID__: JSON.stringify(buildId),
  },
  css: { postcss: { plugins: [] } },
  build: {
    outDir: "../res/web/dm",
    emptyOutDir: true,
    assetsDir: ".",
    sourcemap: false,
  },
});
