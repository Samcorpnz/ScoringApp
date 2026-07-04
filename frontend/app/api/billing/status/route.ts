import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccountForOrg } from "@/lib/account";
import { getStripe } from "@/lib/stripe";

export async function GET() {
  const session = await auth();
  if (!session?.user?.activeOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const account = await getAccountForOrg(session.user.activeOrgId);
  if (!account) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }

  type SubscriptionSummary = {
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number | null;
    amount: number | null;
    currency: string | null;
    interval: "month" | "year" | null;
  };

  async function summarize(subscriptionId: string): Promise<SubscriptionSummary> {
    const sub = await getStripe().subscriptions.retrieve(subscriptionId);
    const item = sub.items.data[0];
    return {
      status: sub.status,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      currentPeriodEnd: item?.current_period_end ?? null,
      amount: item?.price.unit_amount ?? null,
      currency: sub.currency,
      interval: (item?.price.recurring?.interval as "month" | "year" | undefined) ?? null,
    };
  }

  const [subscription, graphicsSubscription] = await Promise.all([
    account.stripeSubscriptionId ? summarize(account.stripeSubscriptionId) : Promise.resolve(null),
    account.graphicsSubscriptionId ? summarize(account.graphicsSubscriptionId) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    plan: account.plan,
    billingInterval: account.billingInterval,
    hasStripeCustomer: Boolean(account.stripeCustomerId),
    subscription,
    addOns: account.addOns,
    graphicsSubscription,
  });
}
