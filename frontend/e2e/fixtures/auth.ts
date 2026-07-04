import { test as base, expect, type Page } from "@playwright/test";
import path from "path";

// Signup is rate-limited to 5/60s per IP (frontend/app/api/signup/route.ts),
// so we sign up once per worker and reuse the session via storageState rather
// than signing up fresh per test — otherwise parallel tests would trip the
// limiter. Signup grants ADMIN with no email-verification step, so this is a
// direct path to a usable /control session.
export const test = base.extend<{}, { workerStorageState: string }>({
  storageState: async ({ workerStorageState }, use) => { await use(workerStorageState); },

  workerStorageState: [async ({ browser }, use, workerInfo) => {
    const fileName = path.resolve(
      __dirname,
      `../.auth/worker-${workerInfo.workerIndex}.json`
    );

    const page = await browser.newPage({ storageState: undefined, baseURL: "http://localhost:3000" });
    const email = `e2e-w${workerInfo.workerIndex}-${Date.now()}@example.test`;
    const password = "TestPass1234!";

    await page.goto("/signup");
    await page.getByRole("textbox").nth(0).fill(`E2E Worker ${workerInfo.workerIndex}`);
    await page.getByRole("textbox").nth(1).fill(`E2E Test Org ${workerInfo.workerIndex}`);
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForURL("**/setup");

    await page.context().storageState({ path: fileName });
    await page.close();

    await use(fileName);
  }, { scope: "worker" }],
});

export { expect };

export async function expectNoDialog(page: Page): Promise<() => void> {
  let fired = false;
  page.on("dialog", async dialog => {
    fired = true;
    await dialog.dismiss();
  });
  return () => expect(fired, "expected no browser dialog (e.g. alert()) to fire").toBe(false);
}
