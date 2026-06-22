import { prisma, Account } from "@scorehub/db";

// Billing operates on the Account (the paying customer), but the session
// only carries orgId — resolve the join once here rather than repeating it
// in every billing route.
export async function getAccountForOrg(orgId: string): Promise<Account | null> {
  const org = await prisma.org.findUnique({ where: { id: orgId }, select: { account: true } });
  return org?.account ?? null;
}
