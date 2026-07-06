import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@scorehub/db";
import { getStripe } from "@/lib/stripe";
import { planForPriceId, addOnForPriceId, AddOn } from "@/lib/plans";
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
      const addOn = session.metadata?.addOn as AddOn | undefined;

      if (addOn) {
        await addAddOn(accountId, addOn, subscription.id);
        break;
      }

      const plan = priceId ? planForPriceId(priceId) : null;
      const interval = subscription.items.data[0]?.price.recurring?.interval ?? null;
      // Never fail open to a paid tier: if the price id can't be mapped to a
      // known plan (unrecognized/mis-mapped price), record the customer and
      // subscription but leave `plan` unchanged and log the misconfiguration
      // rather than silently granting Pro.
      if (!plan) {
        console.error(`[billing] unmapped priceId on checkout.session.completed: ${priceId} (account ${accountId})`);
      }
      await prisma.account.update({
        where: { id: accountId },
        data: {
          stripeCustomerId: session.customer,
          stripeSubscriptionId: subscription.id,
          ...(plan ? { plan } : {}),
          billingInterval: interval,
        },
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const accountId = subscription.metadata?.accountId;
      const metadataAddOn = subscription.metadata?.addOn as AddOn | undefined;
      const priceId = subscription.items.data[0]?.price.id;

      if (metadataAddOn || (priceId && addOnForPriceId(priceId))) {
        const account = accountId
          ? await prisma.account.findUnique({ where: { id: accountId } })
          : await prisma.account.findFirst({ where: { graphicsSubscriptionId: subscription.id } });
        if (!account) break;
        const addOn = metadataAddOn ?? addOnForPriceId(priceId!)!;
        if (subscription.status === "active") {
          await addAddOn(account.id, addOn, subscription.id);
        } else {
          await removeAddOn(account.id, addOn);
        }
        break;
      }

      const account = accountId
        ? await prisma.account.findUnique({ where: { id: accountId } })
        : await prisma.account.findFirst({ where: { stripeSubscriptionId: subscription.id } });
      if (!account) break;

      const plan = priceId ? planForPriceId(priceId) : null;
      const interval = subscription.items.data[0]?.price.recurring?.interval ?? null;
      const nextPlan = subscription.status === "active" ? (plan ?? account.plan) : "free";
      await prisma.account.update({
        where: { id: account.id },
        data: {
          stripeSubscriptionId: subscription.id,
          plan: nextPlan,
          billingInterval: subscription.status === "active" ? interval : null,
        },
      });
      // Add-ons require an active paid plan — if the base plan just lapsed,
      // cancel any running add-on subscription rather than leaving it billing
      // for a feature the account can no longer use.
      if (nextPlan === "free" && account.graphicsSubscriptionId) {
        await cancelAddOnSubscription(account.id, account.graphicsSubscriptionId, "graphics-operator");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const accountId = subscription.metadata?.accountId;
      const metadataAddOn = subscription.metadata?.addOn as AddOn | undefined;

      if (metadataAddOn) {
        const account = accountId
          ? await prisma.account.findUnique({ where: { id: accountId } })
          : await prisma.account.findFirst({ where: { graphicsSubscriptionId: subscription.id } });
        if (account) await removeAddOn(account.id, metadataAddOn);
        break;
      }

      const account = accountId
        ? await prisma.account.findUnique({ where: { id: accountId } })
        : await prisma.account.findFirst({ where: { stripeSubscriptionId: subscription.id } });
      await prisma.account.updateMany({
        where: accountId ? { id: accountId } : { stripeSubscriptionId: subscription.id },
        data: { plan: "free", stripeSubscriptionId: null, billingInterval: null },
      });
      // Same cascade as the "updated" case above, for when the base plan
      // subscription is cancelled outright rather than just lapsing.
      if (account?.graphicsSubscriptionId) {
        await cancelAddOnSubscription(account.id, account.graphicsSubscriptionId, "graphics-operator");
      }
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

async function addAddOn(accountId: string, addOn: AddOn, subscriptionId: string): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return;
  await prisma.account.update({
    where: { id: accountId },
    data: {
      graphicsSubscriptionId: subscriptionId,
      addOns: account.addOns.includes(addOn) ? account.addOns : [...account.addOns, addOn],
    },
  });
}

async function removeAddOn(accountId: string, addOn: AddOn): Promise<void> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return;
  await prisma.account.update({
    where: { id: accountId },
    data: {
      graphicsSubscriptionId: null,
      addOns: account.addOns.filter(a => a !== addOn),
    },
  });
}

// Used when the base plan lapses/cancels — an add-on can't legitimately keep
// billing without a paid base plan under it, so cancel it immediately
// (unlike the base plan's own cancel flow, which lets the period run out).
async function cancelAddOnSubscription(accountId: string, subscriptionId: string, addOn: AddOn): Promise<void> {
  await getStripe().subscriptions.cancel(subscriptionId).catch(() => {});
  await removeAddOn(accountId, addOn);
}
