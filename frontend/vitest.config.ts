import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    // jsdom only enables localStorage for a real http(s) origin — without
    // this it's left undefined, breaking useSoundCues' localStorage calls.
    environmentOptions: { jsdom: { url: "http://localhost:3000" } },
    setupFiles: ["./vitest.setup.ts"],
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not vitest tests.
    exclude: ["node_modules", ".next", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text-summary"],
      reportsDirectory: "./coverage",
    },
  },
});
