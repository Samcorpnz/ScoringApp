import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccountForOrg } from "@/lib/account";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const account = await getAccountForOrg(session.user.orgId);
  if (!account?.stripeCustomerId) {
    return NextResponse.json({ error: "no billing account on file yet — upgrade first" }, { status: 404 });
  }

  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${origin}/account/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
