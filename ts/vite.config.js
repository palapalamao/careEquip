import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const version = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version;
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  define: { __UI_VERSION__: JSON.stringify(version) },
  css: { postcss: { plugins: [] } },
  build: {
    outDir: "../res/web/dm",
    emptyOutDir: true,
    assetsDir: ".",
    sourcemap: false,
  },
});
