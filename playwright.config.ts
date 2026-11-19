import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8190",
    timezoneId: "America/Sao_Paulo",
    trace: "on-first-retry",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    launchOptions: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
      ? { executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"] }
      : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node --env-file-if-exists=.env .output/server/index.mjs",
    port: 8190,
    timeout: 60000,
    reuseExistingServer: false,
    env: {
      PORT: "8190",
      HOST: "127.0.0.1",
      VITE_BACKEND: "local",
      LOCAL_DATA_DIR: "./test-results/server-data",
      APP_ORIGIN: "http://127.0.0.1:8190",
      AI_API_KEY: "",
      AI_BASE_URL: "",
      AI_MODEL: "",
      MONITORING_TOKEN: "e2e-monitoring",
      MONITORING_LOG_DIR: "",
    },
  },
});
