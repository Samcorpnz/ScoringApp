import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@scorehub/db";
import { isRateLimited, clientIp } from "@/lib/rateLimit";
import { sendSignupVerificationEmail } from "@/lib/email";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { isE2ETestMode } from "@/lib/e2eTestMode";

const SIGNUP_REQUEST_EXPIRY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(`signup:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const orgName = typeof body?.orgName === "string" ? body.orgName.trim() : "";
  const acceptedTerms = body?.acceptedTerms === true;
  const turnstileToken = typeof body?.turnstileToken === "string" ? body.turnstileToken : "";

  if (!email || !name || !orgName) {
    return NextResponse.json({ error: "email, name, and orgName are required" }, { status: 400 });
  }
  if (!acceptedTerms) {
    return NextResponse.json({ error: "you must agree to the terms and conditions" }, { status: 400 });
  }

  const turnstileOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstileOk) {
    return NextResponse.json({ error: "captcha verification failed" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "an account with that email already exists" }, { status: 409 });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const now = new Date();

  await prisma.$transaction([
    prisma.signupRequest.deleteMany({ where: { email, consumedAt: null } }),
    prisma.signupRequest.create({
      data: {
        email,
        name,
        orgName,
        tokenHash,
        termsAcceptedAt: now,
        termsVersion: CURRENT_TERMS_VERSION,
        expiresAt: new Date(now.getTime() + SIGNUP_REQUEST_EXPIRY_MS),
      },
    }),
  ]);

  if (isE2ETestMode()) {
    // No Mailgun in the docker-compose e2e environment, and there's no real
    // inbox for Playwright to read — hand the token back directly instead
    // of sending mail. See lib/e2eTestMode.ts.
    return NextResponse.json({ status: "check your email", token: rawToken }, { status: 201 });
  }

  await sendSignupVerificationEmail({ to: email, name, token: rawToken });

  return NextResponse.json({ status: "check your email" }, { status: 201 });
}
