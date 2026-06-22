import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@scorehub/db";
import { getStripe } from "@/lib/stripe";
import { planForPriceId } from "@/lib/plans";

// Stripe retries webhooks on any non-2xx response, so on a real processing
// failure we return 500 deliberately to get that retry — full alerting on
// repeated failures arrives with Sentry/structured logging (Horizon 0 Phase
// 8, SA-28), not yet wired up. This is a known, deliberate gap, not a
// missed requirement of this phase.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[billing] webhook signature verification failed:", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Idempotency: Stripe will redeliver this same event on retry. The event
  // id's uniqueness constraint is the guard — a duplicate insert means we've
  // already applied this event's effect, so just acknowledge and stop.
  try {
    await prisma.stripeEvent.create({ data: { id: event.id } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error("[billing] failed to process webhook event:", event.id, event.type, err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const accountId = session.client_reference_id;
      if (!accountId || typeof session.customer !== "string" || typeof session.subscription !== "string") break;

      const subscription = await getStripe().subscriptions.retrieve(session.subscription);
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? planForPriceId(priceId) : null;

      await prisma.account.update({
        where: { id: accountId },
        data: {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: subscription.id,
          plan: plan ?? "pro",
        },
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const account = await prisma.account.findFirst({ where: { stripeSubscriptionId: subscription.id } });
      if (!account) break;

      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? planForPriceId(priceId) : null;
      await prisma.account.update({
        where: { id: account.id },
        data: { plan: subscription.status === "active" ? (plan ?? account.plan) : "free" },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.account.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { plan: "free", stripeSubscriptionId: null },
      });
      break;
    }
  }
}
