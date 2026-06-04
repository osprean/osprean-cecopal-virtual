import { defineConfig, devices } from "@playwright/test";

// e2e contra la stack local: Vite :5273 (proxy /api → FastAPI :8000) + CECOVI DB.
// No arranca servidores; asume la stack corriendo.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5273",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
