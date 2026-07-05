import type { Page } from "@playwright/test";
import { prisma } from "@scorehub/db";

// These two helpers bypass Stripe entirely by writing straight to Postgres —
// they exist only so the Logos/Sounds and Graphics specs can get a plan-gated
// org into the right state as a *precondition*, without re-testing checkout
// as a side effect of an unrelated spec. Never use them inside billing.spec.ts
// itself; that spec's whole point is exercising the real Stripe checkout/
// webhook path.
//
// Requires DATABASE_URL to point at the docker-compose Postgres from the
// host running Playwright (postgresql://scorehub:scorehub@localhost:5432/scorehub)
// — not the in-container postgresql://...@postgres:5432/... value the
// frontend/relay containers use, since "postgres" only resolves inside the
// compose network.
// Accepts "free" too (not just the paid tiers) so plan-gating negative tests
// can force the shared worker-scoped org (see fixtures/auth.ts) back to a
// known state regardless of what earlier tests in the same worker did to it
// — the whole suite runs as one signed-up org for its entire lifetime, so a
// gating test can't assume it's the first thing to touch billing state.
export async function grantPlan(orgId: string, plan: "free" | "pro" | "venue"): Promise<void> {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId }, select: { accountId: true } });
  await prisma.account.update({ where: { id: org.accountId }, data: { plan } });
}

export async function grantAddOn(orgId: string, addOn: "graphics-operator"): Promise<void> {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId }, select: { accountId: true } });
  const account = await prisma.account.findUniqueOrThrow({ where: { id: org.accountId }, select: { addOns: true } });
  if (account.addOns.includes(addOn)) return;
  await prisma.account.update({
    where: { id: org.accountId },
    data: { addOns: [...account.addOns, addOn] },
  });
}

// Symmetric with grantAddOn, for the same reason grantPlan accepts "free":
// negative tests need to force the add-on *off* regardless of run order.
export async function revokeAddOn(orgId: string, addOn: "graphics-operator"): Promise<void> {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId }, select: { accountId: true } });
  const account = await prisma.account.findUniqueOrThrow({ where: { id: org.accountId }, select: { addOns: true } });
  if (!account.addOns.includes(addOn)) return;
  await prisma.account.update({
    where: { id: org.accountId },
    data: { addOns: account.addOns.filter(a => a !== addOn) },
  });
}

// Fills Stripe's embedded Checkout iframe(s) with a test-mode card and
// submits. Only meaningful against the Stripe *test* account (CLAUDE.md:
// acct_1Tl1sw...) — 4242424242424242 is Stripe's standard test card, always
// succeeds, never touches real money.
export async function fillEmbeddedCheckout(
  page: Page,
  opts: { cardNumber?: string; expiry?: string; cvc?: string } = {}
): Promise<void> {
  const cardNumber = opts.cardNumber ?? "4242424242424242";
  const expiry = opts.expiry ?? "12/34";
  const cvc = opts.cvc ?? "123";

  // Stripe Elements mounts each field in its own iframe; frame names/titles
  // have shifted across Elements versions, so locate by the iframe whose src
  // is the Stripe Checkout/Elements host rather than a hardcoded name.
  const stripeFrame = (label: string) =>
    page.frameLocator('iframe[src*="stripe.com"][title*="Secure payment input frame"]').first().getByLabel(label, { exact: false });

  await stripeFrame("Card number").fill(cardNumber);
  await stripeFrame("Expiration").fill(expiry);
  await stripeFrame("CVC").fill(cvc);

  await page.getByRole("button", { name: /subscribe|pay|submit/i }).click();
}
