import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccountForOrg } from "@/lib/account";
import { getStripe } from "@/lib/stripe";

// Downgrading to Free means letting the current paid period run out rather
// than revoking access immediately — cancel_at_period_end, not an immediate
// cancel(). The customer.subscription.deleted webhook flips Account.plan to
// "free" once the period actually ends.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const resume = body?.resume === true;

  const account = await getAccountForOrg(session.user.orgId);
  if (!account?.stripeSubscriptionId) {
    return NextResponse.json({ error: "no active subscription" }, { status: 404 });
  }

  const subscription = await getStripe().subscriptions.update(account.stripeSubscriptionId, {
    cancel_at_period_end: !resume,
  });

  return NextResponse.json({ cancelAtPeriodEnd: subscription.cancel_at_period_end });
}
