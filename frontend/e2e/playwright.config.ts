import { defineConfig, devices } from "@playwright/test";

// This suite drives the app over HTTP against a running docker-compose stack
// (postgres + redis + relay + frontend) — see CLAUDE.md's "no hosted staging"
// note. There's no `webServer` block: Playwright can only spawn one process
// with no health-check dependency graph, and this stack needs several
// services healthy in order (Postgres -> relay -> frontend). Start it
// yourself with `docker compose up --build` from the repo root before
// running this suite; globalSetup below fails fast with a clear message if
// it isn't up rather than a bare connection-refused.
export default defineConfig({
  testDir: "./specs",
  timeout: 60_000,
  // Default to a single worker even locally: the target relay is one
  // docker-compose container (single-threaded Node event loop). Running
  // multiple workers concurrently contends that one process hard enough to
  // reliably surface a controller-handshake race (see waitForLive in
  // helpers/match.ts) that's otherwise rare — confirmed empirically, not a
  // guess. Override with --workers=N if you want to trade reliability for
  // speed against a beefier relay instance.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
