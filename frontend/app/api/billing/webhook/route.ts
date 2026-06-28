import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@scorehub/db";
import { getStripe } from "@/lib/stripe";
import { planForPriceId } from "@/lib/plans";
import { sendPaymentFailedEmail } from "@/lib/email";

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
  // already applied this event's effect, so just acknowledge and stop. The
  // row is only kept once handleEvent actually succeeds; if it throws, we
  // remove the row so a Stripe retry can genuinely reprocess instead of
  // being silently swallowed as a "duplicate" of a failed attempt.
  try {
    await prisma.stripeEvent.create({ data: { id: event.id } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error("[billing] failed to process webhook event:", event.id, event.type, err);
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const accountId = session.client_reference_id ?? session.metadata?.accountId;
      if (!accountId || typeof session.customer !== "string" || typeof session.subscription !== "string") break;

      const subscription = await getStripe().subscriptions.retrieve(session.subscription);
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? planForPriceId(priceId) : null;
      const interval = subscription.items.data[0]?.price.recurring?.interval ?? null;

      await prisma.account.update({
        where: { id: accountId },
        data: {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: subscription.id,
          plan: plan ?? "pro",
          billingInterval: interval,
        },
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const accountId = subscription.metadata?.accountId;
      const account = accountId
        ? await prisma.account.findUnique({ where: { id: accountId } })
        : await prisma.account.findFirst({ where: { stripeSubscriptionId: subscription.id } });
      if (!account) break;

      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? planForPriceId(priceId) : null;
      const interval = subscription.items.data[0]?.price.recurring?.interval ?? null;
      await prisma.account.update({
        where: { id: account.id },
        data: {
          stripeSubscriptionId: subscription.id,
          plan: subscription.status === "active" ? (plan ?? account.plan) : "free",
          billingInterval: subscription.status === "active" ? interval : null,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const accountId = subscription.metadata?.accountId;
      await prisma.account.updateMany({
        where: accountId ? { id: accountId } : { stripeSubscriptionId: subscription.id },
        data: { plan: "free", stripeSubscriptionId: null, billingInterval: null },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      if (typeof invoice.customer !== "string") break;

      const account = await prisma.account.findFirst({ where: { stripeCustomerId: invoice.customer } });
      if (!account) break;

      const admins = await prisma.membership.findMany({
        where: { role: "ADMIN", org: { accountId: account.id } },
        select: { user: { select: { email: true } } },
        distinct: ["userId"],
      });
      const emails = [...new Set(admins.map(m => m.user.email))];
      await sendPaymentFailedEmail({ to: emails });
      break;
    }
  }
}
