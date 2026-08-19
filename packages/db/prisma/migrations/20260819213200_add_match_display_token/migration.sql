-- AlterTable
-- Nullable for now: existing rows have no token yet. Run
-- packages/db/scripts/backfill-display-tokens.ts once against production
-- after this deploys, before ever enforcing DISPLAY_TOKEN_REQUIRED — a
-- follow-up migration will make this column NOT NULL once every row is
-- populated. New matches get a token at creation time regardless (see
-- persistence.ts / the match-creation route), so this only matters for
-- matches created before this migration.
ALTER TABLE "Match" ADD COLUMN     "displayToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Match_displayToken_key" ON "Match"("displayToken");
