import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@scorehub/db";
import { getAccountForOrg } from "@/lib/account";
import { getStripe } from "@/lib/stripe";
import { priceIdForPlan, PaidPlan, BillingInterval } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const plan = body?.plan as PaidPlan | undefined;
  const interval = (body?.interval as BillingInterval | undefined) ?? "month";
  if (plan !== "pro" && plan !== "venue") {
    return NextResponse.json({ error: "plan must be 'pro' or 'venue'" }, { status: 400 });
  }
  if (interval !== "month" && interval !== "year") {
    return NextResponse.json({ error: "interval must be 'month' or 'year'" }, { status: 400 });
  }

  const account = await getAccountForOrg(session.user.orgId);
  if (!account) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }

  const stripe = getStripe();
  const priceId = priceIdForPlan(plan, interval);

  // Already has an active paid subscription — switch it in place (with
  // proration) rather than starting a second Checkout Session, which would
  // create a second subscription and double-bill the customer.
  if (account.stripeSubscriptionId && (account.plan === "pro" || account.plan === "venue")) {
    const subscription = await stripe.subscriptions.retrieve(account.stripeSubscriptionId);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      return NextResponse.json({ error: "existing subscription has no items" }, { status: 500 });
    }

    await stripe.subscriptions.update(account.stripeSubscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: { accountId: account.id, plan },
    });

    // Reflect the switch immediately; the customer.subscription.updated
    // webhook will also fire and confirm the same plan (idempotent).
    await prisma.account.update({ where: { id: account.id }, data: { plan, billingInterval: interval } });
    return NextResponse.json({ switched: true, plan, interval });
  }

  let customerId = account.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: account.name,
      metadata: { accountId: account.id },
    });
    customerId = customer.id;
    await prisma.account.update({ where: { id: account.id }, data: { stripeCustomerId: customerId } });
  }

  // Embedded mode keeps the customer on /control instead of redirecting to a
  // Stripe-hosted page. redirect_on_completion "never" + the client-side
  // onComplete callback handles completion in place, so no return_url is
  // needed — the control panel is already a single-page tab-switching UI.
  const checkoutSession = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "subscription",
    customer: customerId,
    client_reference_id: account.id,
    line_items: [{ price: priceId, quantity: 1 }],
    redirect_on_completion: "never",
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    metadata: { accountId: account.id, plan },
    subscription_data: { metadata: { accountId: account.id, plan } },
  });

  if (!checkoutSession.client_secret) {
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 500 });
  }
  return NextResponse.json({ clientSecret: checkoutSession.client_secret });
}
