import { test, expect } from "@playwright/test";

// These tests exercise the auth flows themselves — deliberately not using
// the shared worker-storageState fixture (fixtures/auth.ts), since that
// fixture assumes signup succeeds and this file is what actually verifies it.
test.describe("signup and login", () => {
  test("signup with terms unchecked keeps Create Account disabled", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("textbox").nth(0).fill("Unchecked Terms User");
    await page.getByRole("textbox").nth(1).fill("Unchecked Terms Org");
    await page.locator('input[type="email"]').fill(`e2e-noterms-${Date.now()}@example.test`);
    // Terms checkbox deliberately left unchecked — server also rejects this
    // (frontend/app/api/signup/route.ts), but the client disables submit first.
    await expect(page.getByRole("button", { name: "Create Account" })).toBeDisabled();
  });

  test("signup request shows the check-your-email state", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("textbox").nth(0).fill("Check Email User");
    await page.getByRole("textbox").nth(1).fill("Check Email Org");
    await page.locator('input[type="email"]').fill(`e2e-checkemail-${Date.now()}@example.test`);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  });

  test("signup, confirm, then login succeeds and reaches /setup", async ({ page }) => {
    const email = `e2e-auth-${Date.now()}@example.test`;
    const password = "TestPass1234!";

    const signupRes = await page.request.post("/api/signup", {
      data: {
        name: "Auth Flow Tester",
        orgName: "Auth Flow Org",
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

    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("login with wrong password fails", async ({ page }) => {
    const email = `e2e-wrongpw-${Date.now()}@example.test`;

    const signupRes = await page.request.post("/api/signup", {
      data: {
        name: "Wrong PW Tester",
        orgName: "Wrong PW Org",
        email,
        acceptedTerms: true,
        turnstileToken: "",
      },
    });
    const { token } = await signupRes.json();

    await page.goto(`/signup/confirm?token=${token}`);
    await page.locator('input[type="password"]').fill("CorrectPass123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/setup");

    await page.context().clearCookies();
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("WrongPassword999!");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /setup redirects to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/setup");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("forgot / reset password", () => {
  test("forgot-password shows the check-your-email state for any email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator('input[type="email"]').fill(`e2e-nobody-${Date.now()}@example.test`);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  });

  test("reset link lets an existing user set a new password and log in with it", async ({ page }) => {
    const email = `e2e-reset-${Date.now()}@example.test`;
    const password = "OriginalPass123!";
    const newPassword = "BrandNewPass456!";

    const signupRes = await page.request.post("/api/signup", {
      data: { name: "Reset Flow Tester", orgName: "Reset Flow Org", email, acceptedTerms: true, turnstileToken: "" },
    });
    const { token: signupToken } = await signupRes.json();
    await page.goto(`/signup/confirm?token=${signupToken}`);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/setup");
    await page.context().clearCookies();

    const forgotRes = await page.request.post("/api/auth/forgot-password", {
      data: { email, turnstileToken: "" },
    });
    const { token: resetToken } = await forgotRes.json();

    await page.goto(`/reset-password?token=${resetToken}`);
    await page.locator('input[type="password"]').fill(newPassword);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByText("Password updated. Redirecting to sign in…")).toBeVisible();

    await page.goto("/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(newPassword);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
