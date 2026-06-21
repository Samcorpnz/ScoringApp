import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot reloads (Next.js dev) and across
// the relay's long-lived process, instead of exhausting Postgres connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
