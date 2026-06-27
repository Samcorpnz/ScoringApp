import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccountForOrg } from "@/lib/account";

export async function GET() {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const account = await getAccountForOrg(session.user.orgId);
  if (!account) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }

  return NextResponse.json({
    plan: account.plan,
    billingInterval: account.billingInterval,
    hasStripeCustomer: Boolean(account.stripeCustomerId),
  });
}
