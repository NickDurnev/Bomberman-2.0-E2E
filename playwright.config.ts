import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

// One server and one database are shared by both players of a test,
// so tests run one at a time.
export default defineConfig({
  testDir: "tests",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // The full Chromium build: the headless shell crashes its GPU process on
  // macOS when Phaser starts.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
});
