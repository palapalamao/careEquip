import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  outputDir: "../test-results",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8094",
    headless: true,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "node ../scripts/preview.mjs",
    url: "http://127.0.0.1:8094",
    reuseExistingServer: !process.env.CI,
  },
});
