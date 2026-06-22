"use client";

import { loadStripe, Stripe } from "@stripe/stripe-js";

// loadStripe() is itself a singleton-safe promise cache per publishable key,
// but we still only want to call it once.
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripeClient(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured");
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}
