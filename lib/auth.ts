import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { PrismaClient } from "@prisma/client";

// Onboarding status type (defined locally to avoid import issues when DB not configured)
type OnboardingStatus =
  | "NOT_STARTED"
  | "GEO_CHECK_PENDING"
  | "GEO_CHECK_PASSED"
  | "GEO_BLOCKED"
  | "KYC_PENDING"
  | "KYC_IN_REVIEW"
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "WALLET_PENDING"
  | "WALLET_APPROVED"
  | "WALLET_REJECTED"
  | "SOURCE_OF_FUNDS_PENDING"
  | "SOURCE_OF_FUNDS_APPROVED"
  | "RISK_ACKNOWLEDGMENT_PENDING"
  | "COMPLIANCE_PERIOD_ACTIVE"
  | "FULLY_ONBOARDED"
  | "SUSPENDED";

// Helper to check if user is fully onboarded
function isFullyOnboarded(status: OnboardingStatus | undefined): boolean {
  return status === "FULLY_ONBOARDED" || status === "COMPLIANCE_PERIOD_ACTIVE";
}

// Check if database is configured (without importing prisma)
function isDatabaseConfigured(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  return !!(databaseUrl && databaseUrl.length > 0);
}

// Check if we're running in Edge runtime (middleware)
function isEdgeRuntime(): boolean {
  return typeof (globalThis as Record<string, unknown>).EdgeRuntime === "string";
}

// Lazy-loaded prisma client - only loaded when needed in Node.js runtime
let _prismaModule: typeof import("@/lib/prisma") | null = null;

// Get prisma client - loads the module on first call in Node.js runtime
async function getPrisma(): Promise<PrismaClient | null> {
  // Don't try to use prisma in Edge runtime
  if (isEdgeRuntime()) {
    return null;
  }

  if (!isDatabaseConfigured()) {
    console.warn("[Auth] Database not configured");
    return null;
  }

  try {
    // Dynamically import prisma module if not already loaded
    if (!_prismaModule) {
      console.log("[Auth] Loading prisma module...");
      _prismaModule = await import("@/lib/prisma");
      console.log("[Auth] Prisma module loaded, client available:", !!_prismaModule.prisma);
    }
    return _prismaModule.prisma;
  } catch (error) {
    console.error("[Auth] Failed to load prisma module:", error);
    return null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      // Explicitly configure all endpoints to bypass OIDC discovery issues
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: {
          scope: "openid email profile",
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
      token: "https://oauth2.googleapis.com/token",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async signIn({ user }) {
      // Skip database operations in Edge runtime (middleware context)
      if (isEdgeRuntime()) {
        return true;
      }

      console.log("[Auth] Sign-in callback triggered for:", user.email);
      console.log("[Auth] Database configured:", isDatabaseConfigured());
      console.log("[Auth] NODE_ENV:", process.env.NODE_ENV);

      // Only try database operations if database is configured
      if (user.email && isDatabaseConfigured()) {
        const prisma = await getPrisma();
        console.log("[Auth] Prisma client available:", !!prisma);

        if (prisma) {
          try {
            console.log("[Auth] Attempting to upsert user to database...");

            // Check if user already exists to preserve manually-set isVaultoEmployee flag
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email },
              select: { isVaultoEmployee: true },
            });

            // Auto-set employee flag for @vaulto.ai emails, otherwise preserve existing value
            const isEmployeeByDomain = user.email.endsWith("@vaulto.ai");
            const isVaultoEmployee = isEmployeeByDomain || (existingUser?.isVaultoEmployee ?? false);

            const savedUser = await prisma.user.upsert({
              where: { email: user.email },
              create: {
                email: user.email,
                name: user.name,
                isVaultoEmployee,
              },
              update: {
                // Don't update name - preserve user's custom username
                // Only update isVaultoEmployee if true (don't downgrade manually-set employees)
                ...(isVaultoEmployee ? { isVaultoEmployee: true } : {}),
              },
            });

            // Ensure user has a referral code (new users and backfill)
            if (!savedUser.referralCode) {
              const { generateReferralCode } = await import("@/lib/referral-code");
              for (let attempt = 0; attempt < 10; attempt++) {
                const code = generateReferralCode();
                const existing = await prisma.user.findUnique({
                  where: { referralCode: code },
                  select: { id: true },
                });
                if (!existing) {
                  await prisma.user.update({
                    where: { id: savedUser.id },
                    data: { referralCode: code },
                  });
                  break;
                }
              }
            }

            console.log(
              "[Auth] User saved successfully:",
              JSON.stringify({
                id: savedUser.id,
                email: savedUser.email,
                onboardingStatus: savedUser.onboardingStatus,
                createdAt: savedUser.createdAt,
              })
            );
          } catch (error) {
            // Log detailed error information for debugging
            console.error("[Auth] Failed to upsert user:", {
              email: user.email,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              errorType: error?.constructor?.name,
            });

            // In production, we still allow sign-in even if DB fails
            // But we log extensively to help debug
            if (process.env.NODE_ENV === "production") {
              console.error(
                "[Auth] CRITICAL: User not saved to database in production!"
              );
            }
          }
        } else {
          console.error("[Auth] Prisma client not available - user will not be saved to database");
        }
      } else {
        // Log why we're not saving to DB
        console.warn("[Auth] Skipping database save:", {
          hasEmail: !!user.email,
          isDatabaseConfigured: isDatabaseConfigured(),
          databaseUrlLength: process.env.DATABASE_URL?.length ?? 0,
        });
      }

      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user?.email) {
        token.isVaultoEmployee = user.email.endsWith("@vaulto.ai");
      }

      // Skip database operations in Edge runtime
      if (isEdgeRuntime()) {
        return token;
      }

      // Only fetch onboarding status if database is configured
      if (
        token.email &&
        isDatabaseConfigured() &&
        (trigger === "signIn" || trigger === "update")
      ) {
        const prisma = await getPrisma();

        if (prisma) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: token.email as string },
              select: { id: true, onboardingStatus: true, isVaultoEmployee: true },
            });

            if (dbUser) {
              token.userId = dbUser.id;
              token.onboardingStatus = dbUser.onboardingStatus;
              // Always use database value for isVaultoEmployee to ensure consistency
              token.isVaultoEmployee = dbUser.isVaultoEmployee;
              console.log("[Auth] JWT updated with user data:", {
                userId: dbUser.id,
                onboardingStatus: dbUser.onboardingStatus,
                isVaultoEmployee: dbUser.isVaultoEmployee,
              });
            } else {
              console.warn("[Auth] User not found in database:", token.email);
            }
          } catch (error) {
            console.error("[Auth] Failed to fetch user onboarding status:", {
              email: token.email,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue without onboarding status - will be treated as not onboarded
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.isVaultoEmployee = token.isVaultoEmployee as boolean;
        session.user.id = token.userId as string;
        session.user.onboardingStatus = token.onboardingStatus as OnboardingStatus;
        session.user.isFullyOnboarded = isFullyOnboarded(
          token.onboardingStatus as OnboardingStatus
        );
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // If the URL contains a callback, use it
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return `${baseUrl}/waitlist-success`;
    },
  },
});
