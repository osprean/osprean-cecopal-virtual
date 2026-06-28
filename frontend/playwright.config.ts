import { defineConfig, devices } from "@playwright/test";

// e2e contra la stack local: Vite :5174 (proxy /api → FastAPI :8000) + CECOVI DB.
// No arranca servidores; asume la stack corriendo.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: process.env.RECORD_VIDEO ? "on" : "off",
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        launchOptions: { slowMo: process.env.RECORD_VIDEO ? 600 : 0 },
      },
    },
  ],
});
