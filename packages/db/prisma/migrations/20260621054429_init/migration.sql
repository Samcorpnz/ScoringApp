-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('FEDERATION', 'REGION', 'CLUB', 'TEAM');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('LIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "parentOrgId" TEXT,
    "orgType" "OrgType" NOT NULL DEFAULT 'CLUB',
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Org_accountId_idx" ON "Org"("accountId");

-- CreateIndex
CREATE INDEX "Org_parentOrgId_idx" ON "Org"("parentOrgId");

-- CreateIndex
CREATE INDEX "Match_orgId_idx" ON "Match"("orgId");

-- AddForeignKey
ALTER TABLE "Org" ADD CONSTRAINT "Org_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Org" ADD CONSTRAINT "Org_parentOrgId_fkey" FOREIGN KEY ("parentOrgId") REFERENCES "Org"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
