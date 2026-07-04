// Single source of truth mapping plan name + interval <-> Stripe Price ID, used
// by both the checkout route (plan name -> price ID) and the webhook handler
// (price ID on a subscription -> plan name to write to Account.plan).
export type PaidPlan = "pro" | "venue";
export type BillingInterval = "month" | "year";

const ENV_VAR: Record<PaidPlan, Record<BillingInterval, string>> = {
  pro: { month: "STRIPE_PRICE_ID_PRO", year: "STRIPE_PRICE_ID_PRO_ANNUAL" },
  venue: { month: "STRIPE_PRICE_ID_VENUE", year: "STRIPE_PRICE_ID_VENUE_ANNUAL" },
};

export function priceIdForPlan(plan: PaidPlan, interval: BillingInterval = "month"): string {
  const envVar = ENV_VAR[plan][interval];
  const priceId = process.env[envVar];
  if (!priceId) throw new Error(`${envVar} is not configured`);
  return priceId;
}

export function planForPriceId(priceId: string): PaidPlan | null {
  if (priceId === process.env.STRIPE_PRICE_ID_PRO || priceId === process.env.STRIPE_PRICE_ID_PRO_ANNUAL) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ID_VENUE || priceId === process.env.STRIPE_PRICE_ID_VENUE_ANNUAL) return "venue";
  return null;
}

// Add-ons are orthogonal to `plan` — see Account.addOns — and bill on their
// own Stripe subscription (Account.graphicsSubscriptionId today; see the
// schema comment for why it isn't yet a generic map).
export type AddOn = "graphics-operator";

const ADDON_ENV_VAR: Record<AddOn, Record<BillingInterval, string>> = {
  "graphics-operator": { month: "STRIPE_PRICE_ID_GRAPHICS", year: "STRIPE_PRICE_ID_GRAPHICS_ANNUAL" },
};

export function priceIdForAddOn(addOn: AddOn, interval: BillingInterval = "month"): string {
  const envVar = ADDON_ENV_VAR[addOn][interval];
  const priceId = process.env[envVar];
  if (!priceId) throw new Error(`${envVar} is not configured`);
  return priceId;
}

export function addOnForPriceId(priceId: string): AddOn | null {
  if (priceId === process.env.STRIPE_PRICE_ID_GRAPHICS || priceId === process.env.STRIPE_PRICE_ID_GRAPHICS_ANNUAL) {
    return "graphics-operator";
  }
  return null;
}
