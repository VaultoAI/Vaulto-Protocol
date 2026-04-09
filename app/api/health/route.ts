import { NextResponse } from "next/server";
import {
  isDatabaseConfigured,
  testDatabaseConnection,
  getDatabaseUrlDebugInfo,
  prisma,
} from "@/lib/prisma";
import {
  isVaultoApiConfigured,
  getVaultoApiDebugInfo,
} from "@/lib/vaulto-api/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  // Check environment variables (without exposing values)
  checks.envVars = {
    DATABASE_URL: isDatabaseConfigured()
      ? `configured (${process.env.DATABASE_URL?.length} chars)`
      : "NOT CONFIGURED",
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID ? "configured" : "NOT CONFIGURED",
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET
      ? "configured"
      : "NOT CONFIGURED",
    AUTH_SECRET: process.env.AUTH_SECRET ? "configured" : "NOT CONFIGURED",
    AUTH_URL: process.env.AUTH_URL || "NOT CONFIGURED",
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "NOT CONFIGURED",
  };

  // Check Prisma client
  checks.prisma = {
    clientInitialized: !!prisma,
    databaseConfigured: isDatabaseConfigured(),
  };

  // Add DATABASE_URL debug info (safe - doesn't expose credentials)
  checks.databaseUrlDebug = getDatabaseUrlDebugInfo();

  // Test database connection
  if (isDatabaseConfigured() && prisma) {
    const dbTest = await testDatabaseConnection();
    checks.database = dbTest;

    // Also try to count users as a more thorough test
    if (dbTest.connected) {
      try {
        const userCount = await prisma.user.count();
        checks.database = {
          ...dbTest,
          userCount,
          canQueryUsers: true,
        };
      } catch (error) {
        checks.database = {
          ...dbTest,
          canQueryUsers: false,
          queryError: error instanceof Error ? error.message : String(error),
        };
      }
    }
  } else {
    checks.database = {
      connected: false,
      error: !isDatabaseConfigured()
        ? "DATABASE_URL not configured"
        : "Prisma client not initialized",
    };
  }

  // Check Vaulto API configuration
  const vaultoDebug = getVaultoApiDebugInfo();
  checks.vaultoApi = {
    configured: isVaultoApiConfigured(),
    tokenConfigured: vaultoDebug.tokenConfigured
      ? `configured (${vaultoDebug.tokenLength} chars)`
      : "NOT CONFIGURED",
    urlConfigured: vaultoDebug.urlConfigured
      ? `configured via ${vaultoDebug.urlSource} (${vaultoDebug.urlLength} chars)`
      : "NOT CONFIGURED",
  };

  // Determine overall status
  const isHealthy =
    checks.database &&
    typeof checks.database === "object" &&
    "connected" in checks.database &&
    checks.database.connected === true;

  checks.status = isHealthy ? "healthy" : "unhealthy";

  return NextResponse.json(checks, {
    status: isHealthy ? 200 : 503,
  });
}
