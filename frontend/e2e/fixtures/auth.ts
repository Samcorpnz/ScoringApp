import { test as base, expect, type Page } from "@playwright/test";
import path from "path";

// Signup is rate-limited to 5/60s per IP (frontend/app/api/signup/route.ts),
// so we sign up once per worker and reuse the session via storageState rather
// than signing up fresh per test — otherwise parallel tests would trip the
// limiter. Signup is now request-then-confirm (email verification + password
// as a second step, mirroring the invite-accept flow): we call /api/signup
// directly to create the SignupRequest, then drive the real /signup/confirm
// UI to set the password and land on /setup. docker-compose.yml sets
// E2E_EXPOSE_AUTH_TOKENS=true so that API call returns the raw token
// directly (no Mailgun/inbox in the e2e environment) — see
// frontend/lib/e2eTestMode.ts.
export const test = base.extend<{}, { workerStorageState: string }>({
  storageState: async ({ workerStorageState }, use) => { await use(workerStorageState); },

  workerStorageState: [async ({ browser }, use, workerInfo) => {
    const fileName = path.resolve(
      __dirname,
      `../.auth/worker-${workerInfo.workerIndex}.json`
    );

    const page = await browser.newPage({ storageState: undefined, baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" });
    const email = `e2e-w${workerInfo.workerIndex}-${Date.now()}@example.test`;
    const password = "TestPass1234!";

    const signupRes = await page.request.post("/api/signup", {
      data: {
        name: `E2E Worker ${workerInfo.workerIndex}`,
        orgName: `E2E Test Org ${workerInfo.workerIndex}`,
        email,
        acceptedTerms: true,
        turnstileToken: "",
      },
    });
    const { token } = await signupRes.json();

    await page.goto(`/signup/confirm?token=${token}`);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
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
