/**
 * Audit Logging for Compliance
 *
 * Creates immutable, hash-chained audit logs for all onboarding actions.
 * This ensures regulatory compliance and provides tamper-evident records.
 */

import crypto from "crypto";
import { isDatabaseConfigured } from "@/lib/prisma";
import { getDb } from "@/lib/onboarding/db";

// Define AuditAction type locally to avoid Prisma import dependency
type AuditAction =
  | "GEO_CHECK_INITIATED"
  | "GEO_CHECK_PASSED"
  | "GEO_CHECK_BLOCKED"
  | "KYC_INITIATED"
  | "KYC_SUBMITTED"
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "KYC_EXPIRED"
  | "WALLET_CONNECTED"
  | "WALLET_VERIFIED"
  | "WALLET_REJECTED"
  | "SOURCE_OF_FUNDS_SUBMITTED"
  | "SOURCE_OF_FUNDS_APPROVED"
  | "RISK_ACKNOWLEDGMENT_SIGNED"
  | "COMPLIANCE_PERIOD_STARTED"
  | "COMPLIANCE_PERIOD_COMPLETED"
  | "ONBOARDING_COMPLETED"
  | "USER_SUSPENDED"
  | "USER_REINSTATED"
  // Trading wallet actions
  | "TRADING_WALLET_CREATED"
  | "TRADING_WALLET_DEPOSIT_INITIATED"
  | "TRADING_WALLET_DEPOSIT_CONFIRMED"
  | "TRADING_WALLET_WITHDRAWAL_REQUESTED"
  | "TRADING_WALLET_WITHDRAWAL_APPROVED"
  | "TRADING_WALLET_WITHDRAWAL_EXECUTED"
  | "TRADING_WALLET_WITHDRAWAL_REJECTED";

export interface AuditLogInput {
  userId: string;
  action: AuditAction;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  entityType?: string;
  entityId?: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: AuditAction;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  entityType: string | null;
  entityId: string | null;
  previousLogHash: string | null;
  logHash: string;
  createdAt: Date;
}

/**
 * Generate a hash for the audit log entry
 */
function generateLogHash(
  userId: string,
  action: string,
  details: string | null,
  timestamp: Date,
  previousHash: string | null
): string {
  const data = JSON.stringify({
    userId,
    action,
    details,
    timestamp: timestamp.toISOString(),
    previousHash,
  });

  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Get the most recent audit log hash for a user (for chain continuity)
 */
async function getLastLogHash(userId: string): Promise<string | null> {
  const lastLog = await getDb().auditLog.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { logHash: true },
  });

  return lastLog?.logHash ?? null;
}

/**
 * Create an immutable audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<AuditLogEntry> {
  const { userId, action, details, ipAddress, userAgent, entityType, entityId } = input;

  const detailsJson = details ? JSON.stringify(details) : null;
  const timestamp = new Date();

  // Get the previous log hash for chain integrity
  const previousLogHash = await getLastLogHash(userId);

  // Generate the hash for this entry
  const logHash = generateLogHash(
    userId,
    action,
    detailsJson,
    timestamp,
    previousLogHash
  );

  const auditLog = await getDb().auditLog.create({
    data: {
      userId,
      action,
      details: detailsJson,
      ipAddress,
      userAgent,
      entityType,
      entityId,
      previousLogHash,
      logHash,
      createdAt: timestamp,
    },
  });

  return auditLog;
}

/**
 * Verify the integrity of audit log chain for a user
 */
export async function verifyAuditChain(userId: string): Promise<{
  valid: boolean;
  errors: string[];
  totalLogs: number;
}> {
  const logs = await getDb().auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const errors: string[] = [];
  let previousHash: string | null = null;

  for (const log of logs) {
    // Verify the previous hash reference
    if (log.previousLogHash !== previousHash) {
      errors.push(
        `Chain broken at log ${log.id}: expected previous hash ${previousHash}, got ${log.previousLogHash}`
      );
    }

    // Verify the log hash
    const expectedHash = generateLogHash(
      log.userId,
      log.action,
      log.details,
      log.createdAt,
      log.previousLogHash
    );

    if (log.logHash !== expectedHash) {
      errors.push(
        `Hash mismatch at log ${log.id}: expected ${expectedHash}, got ${log.logHash}`
      );
    }

    previousHash = log.logHash;
  }

  return {
    valid: errors.length === 0,
    errors,
    totalLogs: logs.length,
  };
}

/**
 * Get audit logs for a user with pagination
 */
export async function getAuditLogs(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    action?: AuditAction;
  }
): Promise<AuditLogEntry[]> {
  return getDb().auditLog.findMany({
    where: {
      userId,
      ...(options?.action && { action: options.action }),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditLogs(
  entityType: string,
  entityId: string
): Promise<AuditLogEntry[]> {
  return getDb().auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Helper to create audit logs for common onboarding actions
 */
export const auditHelpers = {
  async geoCheckInitiated(
    userId: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "GEO_CHECK_INITIATED",
      details: { ipAddress },
      ipAddress,
      userAgent,
    });
  },

  async geoCheckPassed(
    userId: string,
    geoVerificationId: string,
    countryCode: string,
    ipAddress: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "GEO_CHECK_PASSED",
      details: { countryCode },
      ipAddress,
      entityType: "GeoVerification",
      entityId: geoVerificationId,
    });
  },

  async geoCheckBlocked(
    userId: string,
    geoVerificationId: string,
    blockReason: string,
    ipAddress: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "GEO_CHECK_BLOCKED",
      details: { blockReason },
      ipAddress,
      entityType: "GeoVerification",
      entityId: geoVerificationId,
    });
  },

  async kycInitiated(
    userId: string,
    kycVerificationId: string,
    sumsubApplicantId: string,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "KYC_INITIATED",
      details: { sumsubApplicantId },
      ipAddress,
      entityType: "KycVerification",
      entityId: kycVerificationId,
    });
  },

  async kycSubmitted(
    userId: string,
    kycVerificationId: string,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "KYC_SUBMITTED",
      ipAddress,
      entityType: "KycVerification",
      entityId: kycVerificationId,
    });
  },

  async kycApproved(
    userId: string,
    kycVerificationId: string,
    reviewDetails?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "KYC_APPROVED",
      details: reviewDetails,
      entityType: "KycVerification",
      entityId: kycVerificationId,
    });
  },

  async kycRejected(
    userId: string,
    kycVerificationId: string,
    reason: string,
    reviewDetails?: Record<string, unknown>
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "KYC_REJECTED",
      details: { reason, ...reviewDetails },
      entityType: "KycVerification",
      entityId: kycVerificationId,
    });
  },

  async walletConnected(
    userId: string,
    walletVerificationId: string,
    walletAddress: string,
    chainId: number,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "WALLET_CONNECTED",
      details: { walletAddress, chainId },
      ipAddress,
      entityType: "WalletVerification",
      entityId: walletVerificationId,
    });
  },

  async walletVerified(
    userId: string,
    walletVerificationId: string,
    riskLevel: string,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "WALLET_VERIFIED",
      details: { riskLevel },
      ipAddress,
      entityType: "WalletVerification",
      entityId: walletVerificationId,
    });
  },

  async walletRejected(
    userId: string,
    walletVerificationId: string,
    reason: string,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "WALLET_REJECTED",
      details: { reason },
      ipAddress,
      entityType: "WalletVerification",
      entityId: walletVerificationId,
    });
  },

  async sourceOfFundsSubmitted(
    userId: string,
    declarationId: string,
    primarySource: string,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "SOURCE_OF_FUNDS_SUBMITTED",
      details: { primarySource },
      ipAddress,
      entityType: "SourceOfFundsDeclaration",
      entityId: declarationId,
    });
  },

  async riskAcknowledgmentSigned(
    userId: string,
    acknowledgmentId: string,
    documentVersion: string,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "RISK_ACKNOWLEDGMENT_SIGNED",
      details: { documentVersion },
      ipAddress,
      entityType: "RiskAcknowledgment",
      entityId: acknowledgmentId,
    });
  },

  async compliancePeriodStarted(
    userId: string,
    compliancePeriodId: string,
    startDate: Date,
    endDate: Date,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "COMPLIANCE_PERIOD_STARTED",
      details: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        periodDays: 40,
      },
      ipAddress,
      entityType: "CompliancePeriod",
      entityId: compliancePeriodId,
    });
  },

  async onboardingCompleted(
    userId: string,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "ONBOARDING_COMPLETED",
      details: { completedAt: new Date().toISOString() },
      ipAddress,
    });
  },

  async userSuspended(
    userId: string,
    reason: string,
    suspendedBy?: string
  ): Promise<AuditLogEntry> {
    return createAuditLog({
      userId,
      action: "USER_SUSPENDED",
      details: { reason, suspendedBy },
    });
  },
};
