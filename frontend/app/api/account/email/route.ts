import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@scorehub/db";
import { isRateLimited } from "@/lib/rateLimit";
import { sendEmailChangeVerification } from "@/lib/email";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (isRateLimited(`account-email-status:${session.user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const pendingRequest = await prisma.emailChangeRequest.findFirst({
    where: { userId: session.user.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ pending: pendingRequest?.newEmail ?? null });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (isRateLimited(`account-email-request:${session.user.id}`, 3, 60 * 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const newEmail = typeof body?.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  if (!newEmail || !currentPassword) {
    return NextResponse.json({ error: "newEmail and currentPassword are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "current password is incorrect" }, { status: 401 });
  }
  if (newEmail === user.email) {
    return NextResponse.json({ error: "that is already your current email" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existing) {
    return NextResponse.json({ error: "an account with that email already exists" }, { status: 409 });
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60_000); // 1 hour

  await prisma.$transaction([
    // Latest request supersedes any earlier one — no separate cancel
    // endpoint needed, the old link simply stops working.
    prisma.emailChangeRequest.deleteMany({ where: { userId: user.id, consumedAt: null } }),
    prisma.emailChangeRequest.create({
      data: { userId: user.id, newEmail, tokenHash, expiresAt },
    }),
  ]);

  await sendEmailChangeVerification({ to: newEmail, token: rawToken });

  return NextResponse.json({ status: "pending", newEmail });
}
