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
