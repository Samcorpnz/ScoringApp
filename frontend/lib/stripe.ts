import Stripe from "stripe";

// Lazily constructed (not a top-level constant) so that merely importing
// this module — e.g. during Next.js's build-time page-data collection —
// doesn't throw in environments where Stripe isn't configured yet. The
// error only surfaces when a billing route actually runs.
const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export function getStripe(): Stripe {
  if (globalForStripe.stripe) return globalForStripe.stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  const client = new Stripe(secretKey);
  if (process.env.NODE_ENV !== "production") {
    globalForStripe.stripe = client;
  }
  return client;
}
