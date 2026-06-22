// Single source of truth mapping plan name <-> Stripe Price ID, used by both
// the checkout route (plan name -> price ID) and the webhook handler (price
// ID on a subscription -> plan name to write to Account.plan).
export type PaidPlan = "pro" | "venue";

export function priceIdForPlan(plan: PaidPlan): string {
  const envVar = plan === "pro" ? "STRIPE_PRICE_ID_PRO" : "STRIPE_PRICE_ID_VENUE";
  const priceId = process.env[envVar];
  if (!priceId) throw new Error(`${envVar} is not configured`);
  return priceId;
}

export function planForPriceId(priceId: string): PaidPlan | null {
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ID_VENUE) return "venue";
  return null;
}
