import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@scorehub/db";
import { getAccountForOrg } from "@/lib/account";
import { getStripe } from "@/lib/stripe";
import { priceIdForPlan, priceIdForAddOn, PaidPlan, AddOn, BillingInterval } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.activeOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.activeRole !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const plan = body?.plan as PaidPlan | undefined;
  const addOn = body?.addOn as AddOn | undefined;
  const interval = (body?.interval as BillingInterval | undefined) ?? "month";

  if (plan && addOn) {
    return NextResponse.json({ error: "specify either 'plan' or 'addOn', not both" }, { status: 400 });
  }
  if (plan && plan !== "pro" && plan !== "venue") {
    return NextResponse.json({ error: "plan must be 'pro' or 'venue'" }, { status: 400 });
  }
  if (addOn && addOn !== "graphics-operator") {
    return NextResponse.json({ error: "unknown add-on" }, { status: 400 });
  }
  if (!plan && !addOn) {
    return NextResponse.json({ error: "plan or addOn is required" }, { status: 400 });
  }
  if (interval !== "month" && interval !== "year") {
    return NextResponse.json({ error: "interval must be 'month' or 'year'" }, { status: 400 });
  }

  const account = await getAccountForOrg(session.user.activeOrgId);
  if (!account) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }

  // Add-ons ride on top of a paid base plan — Free accounts can't buy Graphics
  // on its own, and there'd be no base subscription to attach billing-portal
  // management to.
  if (addOn && account.plan !== "pro" && account.plan !== "venue") {
    return NextResponse.json({ error: "add-ons require an active Pro or Venue plan" }, { status: 400 });
  }

  let stripe, priceId;
  try {
    stripe = getStripe();
    priceId = plan ? priceIdForPlan(plan, interval) : priceIdForAddOn(addOn!, interval);
  } catch {
    return NextResponse.json({ error: "billing is not configured" }, { status: 500 });
  }

  // Already has an active subscription for this line (base plan or add-on)
  // — switch it in place (with proration) rather than starting a second
  // Checkout Session, which would create a second subscription and
  // double-bill the customer.
  const existingSubscriptionId = plan ? account.stripeSubscriptionId : account.graphicsSubscriptionId;
  const hasExistingSubscription = plan
    ? Boolean(existingSubscriptionId) && (account.plan === "pro" || account.plan === "venue")
    : Boolean(existingSubscriptionId) && account.addOns.includes(addOn!);

  if (hasExistingSubscription && existingSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(existingSubscriptionId);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      return NextResponse.json({ error: "existing subscription has no items" }, { status: 500 });
    }

    const updateMetadata: Record<string, string> = plan
      ? { accountId: account.id, plan }
      : { accountId: account.id, addOn: addOn! };
    await stripe.subscriptions.update(existingSubscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: updateMetadata,
    });

    // Reflect the switch immediately; the customer.subscription.updated
    // webhook will also fire and confirm the same state (idempotent).
    if (plan) {
      await prisma.account.update({ where: { id: account.id }, data: { plan, billingInterval: interval } });
      return NextResponse.json({ switched: true, plan, interval });
    }
    return NextResponse.json({ switched: true, addOn, interval });
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
  const metadata: Record<string, string> = plan
    ? { accountId: account.id, plan }
    : { accountId: account.id, addOn: addOn! };
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
    metadata,
    subscription_data: { metadata },
  });

  if (!checkoutSession.client_secret) {
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 500 });
  }
  return NextResponse.json({ clientSecret: checkoutSession.client_secret });
}
