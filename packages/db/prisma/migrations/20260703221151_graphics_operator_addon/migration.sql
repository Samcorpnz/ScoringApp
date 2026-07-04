-- AlterEnum
ALTER TYPE "ScopedTokenType" ADD VALUE 'GRAPHICS';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "addOns" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "externalId" TEXT,
    "provider" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT,
    "photoUrl" TEXT,
    "bio" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_orgId_idx" ON "Player"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_orgId_provider_externalId_key" ON "Player"("orgId", "provider", "externalId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
