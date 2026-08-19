// One-off backfill for the displayToken column added in migration
// 20260819213200_add_match_display_token. New matches always get a token at
// creation time (see relay/src/persistence.ts and the frontend match-creation
// route) — this only needs to run once, against any Match rows that predate
// that migration, before a follow-up migration can safely make the column
// NOT NULL. Safe to re-run: only touches rows where displayToken is still
// null.
//
// Usage: DATABASE_URL=... npm run backfill:display-tokens --workspace=packages/db
import crypto from "node:crypto";
import { prisma } from "../src/client";

async function main(): Promise<void> {
  let updated = 0;
  for (;;) {
    const batch = await prisma.match.findMany({
      where: { displayToken: null },
      select: { id: true },
      take: 500,
    });
    if (batch.length === 0) break;
    await Promise.all(
      batch.map(({ id }) =>
        prisma.match.update({
          where: { id },
          data: { displayToken: crypto.randomBytes(24).toString("hex") },
        })
      )
    );
    updated += batch.length;
    console.log(`[backfill-display-tokens] updated ${updated} rows so far...`);
  }
  console.log(`[backfill-display-tokens] done — ${updated} rows updated.`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("[backfill-display-tokens] failed:", err);
    process.exit(1);
  });
