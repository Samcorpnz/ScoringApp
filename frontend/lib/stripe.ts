import Stripe from "stripe";

// Reuse a single client across hot reloads (Next.js dev), same pattern as
// @scorehub/db's prisma singleton.
const globalForStripe = globalThis as unknown as { stripe?: Stripe };

function createClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secretKey);
}

export const stripe = globalForStripe.stripe ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForStripe.stripe = stripe;
}
