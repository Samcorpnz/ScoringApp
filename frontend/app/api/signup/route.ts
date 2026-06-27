import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, Prisma } from "@scorehub/db";
import { isRateLimited, clientIp } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  if (isRateLimited(`signup:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const orgName = typeof body?.orgName === "string" ? body.orgName.trim() : "";

  if (!email || !password || !name || !orgName) {
    return NextResponse.json({ error: "email, password, name, and orgName are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "an account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const account = await tx.account.create({ data: { name: orgName } });
    const org = await tx.org.create({ data: { accountId: account.id, name: orgName } });
    const user = await tx.user.create({ data: { email, passwordHash, name } });
    await tx.membership.create({ data: { userId: user.id, orgId: org.id, role: "ADMIN" } });
  });

  return NextResponse.json({ status: "ok" }, { status: 201 });
}
