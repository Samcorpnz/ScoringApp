import { test, expect } from "@playwright/test";

// These tests exercise the auth flows themselves — deliberately not using
// the shared worker-storageState fixture (fixtures/auth.ts), since that
// fixture assumes signup succeeds and this file is what actually verifies it.
test.describe("signup and login", () => {
  test("signup with a short password keeps Create Account disabled", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("textbox").nth(0).fill("Short Password User");
    await page.getByRole("textbox").nth(1).fill("Short PW Org");
    await page.locator('input[type="email"]').fill(`e2e-shortpw-${Date.now()}@example.test`);
    await page.locator('input[type="password"]').fill("short1");
    // Client-side validation disables the button rather than allowing
    // submission of an under-8-char password — confirmed live, not a guess.
    await expect(page.getByRole("button", { name: "Create Account" })).toBeDisabled();
  });

  test("signup then login succeeds and reaches /setup", async ({ page }) => {
    const email = `e2e-auth-${Date.now()}@example.test`;
    const password = "TestPass1234!";

    await page.goto("/signup");
    await page.getByRole("textbox").nth(0).fill("Auth Flow Tester");
    await page.getByRole("textbox").nth(1).fill("Auth Flow Org");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForURL("**/setup");

    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("login with wrong password fails", async ({ page }) => {
    const email = `e2e-wrongpw-${Date.now()}@example.test`;
    await page.goto("/signup");
    await page.getByRole("textbox").nth(0).fill("Wrong PW Tester");
    await page.getByRole("textbox").nth(1).fill("Wrong PW Org");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("CorrectPass123!");
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForURL("**/setup");

    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("WrongPassword999!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /setup redirects to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/login/);
  });
});
