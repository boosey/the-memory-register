import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const TEST_PORT = 5999;
const FIXTURE_CLAUDE_HOME = path.resolve(__dirname, "tests/fixtures/sample-claude-home");
const FIXTURE_EXTRA_PROJECT = path.resolve(FIXTURE_CLAUDE_HOME, ".fixture-project");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 2,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: `http://127.0.0.1:${TEST_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: {
    command: "pnpm build && pnpm start",
    url: `http://127.0.0.1:${TEST_PORT}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PORT: String(TEST_PORT),
      HOSTNAME: "127.0.0.1",
      THE_MEMORY_REGISTER_CLAUDE_HOME: FIXTURE_CLAUDE_HOME,
      THE_MEMORY_REGISTER_EXTRA_PROJECTS: FIXTURE_EXTRA_PROJECT,
    },
  },
});
