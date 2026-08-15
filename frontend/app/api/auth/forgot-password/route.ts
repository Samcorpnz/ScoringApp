import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@scorehub/db";
import { isRateLimited, clientIp } from "@/lib/rateLimit";
import { sendPasswordResetEmail } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { isE2ETestMode } from "@/lib/e2eTestMode";

const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;

// Always responds 200 with the same generic message regardless of whether
// the email is registered, so this endpoint can't be used to enumerate
// accounts — the DB write + email send only happen for a real match.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(`forgot-password:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const turnstileToken = typeof body?.turnstileToken === "string" ? body.turnstileToken : "";

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const turnstileOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstileOk) {
    return NextResponse.json({ error: "captcha verification failed" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ status: "if that account exists, we've sent an email" });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const now = new Date();

  await prisma.$transaction([
    prisma.passwordResetRequest.deleteMany({ where: { userId: user.id, consumedAt: null } }),
    prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_EXPIRY_MS),
      },
    }),
  ]);

  if (isE2ETestMode()) {
    // See lib/e2eTestMode.ts — no Mailgun/inbox available in the e2e env.
    return NextResponse.json({ status: "if that account exists, we've sent an email", token: rawToken });
  }

  await sendPasswordResetEmail({ to: user.email, token: rawToken });

  return NextResponse.json({ status: "if that account exists, we've sent an email" });
}
