import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccountForOrg } from "@/lib/account";
import { getStripe } from "@/lib/stripe";
import { ADDON_SUBSCRIPTION_FIELD, AddOn } from "@/lib/plans";

const KNOWN_ADDONS: AddOn[] = ["graphics-operator", "data-feed"];

// Downgrading to Free (or dropping an add-on) means letting the current paid
// period run out rather than revoking access immediately —
// cancel_at_period_end, not an immediate cancel(). The
// customer.subscription.deleted/updated webhooks flip Account.plan (or
// remove the add-on) once the period actually ends.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.activeOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.activeRole !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const resume = body?.resume === true;
  const addOn = body?.addOn as AddOn | undefined;
  if (addOn && !KNOWN_ADDONS.includes(addOn)) {
    return NextResponse.json({ error: "unknown add-on" }, { status: 400 });
  }

  const account = await getAccountForOrg(session.user.activeOrgId);
  const subscriptionId = addOn ? account?.[ADDON_SUBSCRIPTION_FIELD[addOn]] : account?.stripeSubscriptionId;
  if (!subscriptionId) {
    return NextResponse.json({ error: "no active subscription" }, { status: 404 });
  }

  const subscription = await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: !resume,
  });

  return NextResponse.json({ cancelAtPeriodEnd: subscription.cancel_at_period_end });
}
