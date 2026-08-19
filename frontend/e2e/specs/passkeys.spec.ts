import { test, expect } from "@playwright/test";

// SA-108. Drives a real WebAuthn ceremony end-to-end (registration + login)
// using Chromium's CDP WebAuthn domain to simulate a resident-key
// authenticator — Playwright has no typed wrapper for this domain, so
// commands are sent directly via page.context().newCDPSession(page).
// automaticPresenceSimulation auto-approves the (virtual) user-presence
// prompt so no manual interaction step is needed in CI.
//
// This covers the protocol-level round-trip (registration ceremony -> DB
// row -> authentication ceremony -> session). Real hardware/biometric UX
// (Touch ID, Windows Hello, a physical security key) is a manual QA
// checklist item, not something CI can exercise.
//
// Deliberately does its own signup (mirroring auth.spec.ts) rather than the
// shared workerStorageState fixture, since the passkey list needs to start
// empty for each test.
test.describe("passkeys", () => {
  async function signUpAndLogIn(page: import("@playwright/test").Page, label: string) {
    const email = `e2e-${label}-${Date.now()}@example.test`;
    const password = "TestPass1234!";

    const signupRes = await page.request.post("/api/signup", {
      data: {
        name: `${label} Tester`,
        orgName: `${label} Org`,
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

    return { email, password };
  }

  async function addVirtualAuthenticator(page: import("@playwright/test").Page) {
    const client = await page.context().newCDPSession(page);
    await client.send("WebAuthn.enable");
    const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    return { client, authenticatorId };
  }

  test("register a passkey in account settings, then sign in with it", async ({ page }) => {
    await signUpAndLogIn(page, "passkey-reg");

    const { client, authenticatorId } = await addVirtualAuthenticator(page);

    await page.goto("/account");
    await page.getByRole("button", { name: "Add a passkey" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Passkey added.")).toBeVisible({ timeout: 10_000 });

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in with a passkey/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

    await client.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  });

  test("remove a passkey", async ({ page }) => {
    await signUpAndLogIn(page, "passkey-remove");

    const { client, authenticatorId } = await addVirtualAuthenticator(page);

    await page.goto("/account");
    await page.getByRole("button", { name: "Add a passkey" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Passkey added.")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("No passkeys yet.")).toBeVisible({ timeout: 10_000 });

    await client.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  });
});
