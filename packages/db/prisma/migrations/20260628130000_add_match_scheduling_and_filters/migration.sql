-- AlterEnum
ALTER TYPE "MatchStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "sport" TEXT,
ADD COLUMN     "competition" TEXT,
ADD COLUMN     "homeName" TEXT,
ADD COLUMN     "visitorName" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ScopedToken" ADD COLUMN     "matchId" TEXT;

-- DropIndex
DROP INDEX "Match_orgId_idx";

-- CreateIndex
CREATE INDEX "Match_orgId_status_idx" ON "Match"("orgId", "status");

-- CreateIndex
CREATE INDEX "Match_orgId_sport_idx" ON "Match"("orgId", "sport");

-- CreateIndex
CREATE INDEX "Match_orgId_competition_idx" ON "Match"("orgId", "competition");

-- CreateIndex
CREATE INDEX "ScopedToken_matchId_idx" ON "ScopedToken"("matchId");

-- AddForeignKey
ALTER TABLE "ScopedToken" ADD CONSTRAINT "ScopedToken_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
