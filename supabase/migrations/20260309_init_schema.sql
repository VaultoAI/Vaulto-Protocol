-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'GEO_CHECK_PENDING', 'GEO_CHECK_PASSED', 'GEO_BLOCKED', 'KYC_PENDING', 'KYC_IN_REVIEW', 'KYC_APPROVED', 'KYC_REJECTED', 'WALLET_PENDING', 'WALLET_APPROVED', 'WALLET_REJECTED', 'SOURCE_OF_FUNDS_PENDING', 'SOURCE_OF_FUNDS_APPROVED', 'RISK_ACKNOWLEDGMENT_PENDING', 'COMPLIANCE_PERIOD_ACTIVE', 'FULLY_ONBOARDED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WalletVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'HIGH_RISK');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'SEVERE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('GEO_CHECK_INITIATED', 'GEO_CHECK_PASSED', 'GEO_CHECK_BLOCKED', 'KYC_INITIATED', 'KYC_SUBMITTED', 'KYC_APPROVED', 'KYC_REJECTED', 'KYC_EXPIRED', 'WALLET_CONNECTED', 'WALLET_VERIFIED', 'WALLET_REJECTED', 'SOURCE_OF_FUNDS_SUBMITTED', 'SOURCE_OF_FUNDS_APPROVED', 'RISK_ACKNOWLEDGMENT_SIGNED', 'COMPLIANCE_PERIOD_STARTED', 'COMPLIANCE_PERIOD_COMPLETED', 'ONBOARDING_COMPLETED', 'USER_SUSPENDED', 'USER_REINSTATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isVaultoEmployee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "isVpnDetected" BOOLEAN NOT NULL DEFAULT false,
    "isProxyDetected" BOOLEAN NOT NULL DEFAULT false,
    "isTorDetected" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "declaredNonUs" BOOLEAN NOT NULL DEFAULT false,
    "declaredCountry" TEXT,
    "declarationSignedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawResponseHash" TEXT,

    CONSTRAINT "GeoVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sumsubApplicantId" TEXT,
    "sumsubAccessToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "reviewResult" TEXT,
    "documentType" TEXT,
    "documentCountry" TEXT,
    "documentVerified" BOOLEAN NOT NULL DEFAULT false,
    "livenessVerified" BOOLEAN NOT NULL DEFAULT false,
    "amlScreeningPassed" BOOLEAN NOT NULL DEFAULT false,
    "amlRiskLevel" "RiskLevel",
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "signatureMessage" TEXT,
    "signatureHash" TEXT,
    "ownershipVerified" BOOLEAN NOT NULL DEFAULT false,
    "ownershipVerifiedAt" TIMESTAMP(3),
    "status" "WalletVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "riskLevel" "RiskLevel",
    "screeningScore" DOUBLE PRECISION,
    "isSanctioned" BOOLEAN NOT NULL DEFAULT false,
    "isHighRisk" BOOLEAN NOT NULL DEFAULT false,
    "riskCategories" TEXT[],
    "screenedAt" TIMESTAMP(3),
    "screeningExpires" TIMESTAMP(3),
    "rawResponseHash" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceOfFundsDeclaration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "primarySource" TEXT NOT NULL,
    "secondarySources" TEXT[],
    "employerName" TEXT,
    "occupation" TEXT,
    "estimatedNetWorth" TEXT,
    "expectedTradingVolume" TEXT,
    "hasDocumentation" BOOLEAN NOT NULL DEFAULT false,
    "documentationNotes" TEXT,
    "declarationText" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceOfFundsDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAcknowledgment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgesVolatility" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgesLiquidityRisk" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgesRegulatoryRisk" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgesNoInsurance" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgesLossRisk" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgesExperimental" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgesRegSCompliance" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgesTransferRestrictions" BOOLEAN NOT NULL DEFAULT false,
    "documentVersion" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAcknowledgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompliancePeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStartDate" TIMESTAMP(3) NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "periodDays" INTEGER NOT NULL DEFAULT 40,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompliancePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "previousLogHash" TEXT,
    "logHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedRegion" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockedRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SumsubWebhook" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "reviewStatus" TEXT,
    "reviewResult" TEXT,
    "rawPayload" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SumsubWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateCompany" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "valuationUsd" BIGINT NOT NULL,
    "valuationAsOf" TIMESTAMP(3) NOT NULL,
    "totalFundingUsd" BIGINT NOT NULL,
    "lastFundingRoundType" TEXT NOT NULL,
    "lastFundingDate" TIMESTAMP(3) NOT NULL,
    "lastFundingEstPricePerShareUsd" DECIMAL(20,4),
    "employees" INTEGER NOT NULL,
    "ceo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProduct" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingRound" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "roundNumber" INTEGER,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amountRaisedUsd" BIGINT,
    "amountRaisedNote" TEXT,
    "preMoneyValuationUsd" BIGINT,
    "postMoneyValuationUsd" BIGINT,
    "pricePerShareUsd" DECIMAL(20,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_onboardingStatus_idx" ON "User"("onboardingStatus");

-- CreateIndex
CREATE INDEX "GeoVerification_userId_idx" ON "GeoVerification"("userId");

-- CreateIndex
CREATE INDEX "GeoVerification_countryCode_idx" ON "GeoVerification"("countryCode");

-- CreateIndex
CREATE INDEX "GeoVerification_isBlocked_idx" ON "GeoVerification"("isBlocked");

-- CreateIndex
CREATE UNIQUE INDEX "KycVerification_userId_key" ON "KycVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KycVerification_sumsubApplicantId_key" ON "KycVerification"("sumsubApplicantId");

-- CreateIndex
CREATE INDEX "KycVerification_sumsubApplicantId_idx" ON "KycVerification"("sumsubApplicantId");

-- CreateIndex
CREATE INDEX "KycVerification_status_idx" ON "KycVerification"("status");

-- CreateIndex
CREATE INDEX "WalletVerification_walletAddress_idx" ON "WalletVerification"("walletAddress");

-- CreateIndex
CREATE INDEX "WalletVerification_status_idx" ON "WalletVerification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WalletVerification_userId_walletAddress_key" ON "WalletVerification"("userId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "SourceOfFundsDeclaration_userId_key" ON "SourceOfFundsDeclaration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAcknowledgment_userId_key" ON "RiskAcknowledgment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompliancePeriod_userId_key" ON "CompliancePeriod"("userId");

-- CreateIndex
CREATE INDEX "CompliancePeriod_periodEndDate_idx" ON "CompliancePeriod"("periodEndDate");

-- CreateIndex
CREATE INDEX "CompliancePeriod_isActive_idx" ON "CompliancePeriod"("isActive");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedRegion_countryCode_key" ON "BlockedRegion"("countryCode");

-- CreateIndex
CREATE INDEX "BlockedRegion_countryCode_idx" ON "BlockedRegion"("countryCode");

-- CreateIndex
CREATE INDEX "BlockedRegion_isActive_idx" ON "BlockedRegion"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SumsubWebhook_webhookId_key" ON "SumsubWebhook"("webhookId");

-- CreateIndex
CREATE INDEX "SumsubWebhook_applicantId_idx" ON "SumsubWebhook"("applicantId");

-- CreateIndex
CREATE INDEX "SumsubWebhook_eventType_idx" ON "SumsubWebhook"("eventType");

-- CreateIndex
CREATE INDEX "SumsubWebhook_receivedAt_idx" ON "SumsubWebhook"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateCompany_name_key" ON "PrivateCompany"("name");

-- CreateIndex
CREATE INDEX "PrivateCompany_industry_idx" ON "PrivateCompany"("industry");

-- CreateIndex
CREATE INDEX "PrivateCompany_valuationUsd_idx" ON "PrivateCompany"("valuationUsd");

-- CreateIndex
CREATE INDEX "CompanyProduct_companyId_idx" ON "CompanyProduct"("companyId");

-- CreateIndex
CREATE INDEX "FundingRound_companyId_idx" ON "FundingRound"("companyId");

-- CreateIndex
CREATE INDEX "FundingRound_date_idx" ON "FundingRound"("date");

-- AddForeignKey
ALTER TABLE "GeoVerification" ADD CONSTRAINT "GeoVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletVerification" ADD CONSTRAINT "WalletVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceOfFundsDeclaration" ADD CONSTRAINT "SourceOfFundsDeclaration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAcknowledgment" ADD CONSTRAINT "RiskAcknowledgment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompliancePeriod" ADD CONSTRAINT "CompliancePeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProduct" ADD CONSTRAINT "CompanyProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "PrivateCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingRound" ADD CONSTRAINT "FundingRound_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "PrivateCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

