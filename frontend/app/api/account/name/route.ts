import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@scorehub/db";
import { isRateLimited } from "@/lib/rateLimit";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (isRateLimited(`account-name:${session.user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "name is required and must be 100 characters or fewer" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data: { name } });
  return NextResponse.json({ status: "ok", name });
}
