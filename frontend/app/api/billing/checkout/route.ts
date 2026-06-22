import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@scorehub/db";
import { getAccountForOrg } from "@/lib/account";
import { getStripe } from "@/lib/stripe";
import { priceIdForPlan, PaidPlan } from "@/lib/plans";

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
  if (plan !== "pro" && plan !== "venue") {
    return NextResponse.json({ error: "plan must be 'pro' or 'venue'" }, { status: 400 });
  }

  const account = await getAccountForOrg(session.user.orgId);
  if (!account) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }

  const stripe = getStripe();
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
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    redirect_on_completion: "never",
  });

  if (!checkoutSession.client_secret) {
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 500 });
  }
  return NextResponse.json({ clientSecret: checkoutSession.client_secret });
}
