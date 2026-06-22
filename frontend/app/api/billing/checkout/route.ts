import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@scorehub/db";
import { getAccountForOrg } from "@/lib/account";
import { stripe } from "@/lib/stripe";
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

  let customerId = account.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: account.name,
      metadata: { accountId: account.id },
    });
    customerId = customer.id;
    await prisma.account.update({ where: { id: account.id }, data: { stripeCustomerId: customerId } });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: account.id,
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    success_url: `${origin}/control?tab=billing&checkout=success`,
    cancel_url: `${origin}/control?tab=billing&checkout=cancelled`,
  });

  if (!checkoutSession.url) {
    return NextResponse.json({ error: "failed to create checkout session" }, { status: 500 });
  }
  return NextResponse.json({ url: checkoutSession.url });
}
