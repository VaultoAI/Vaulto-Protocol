import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // Check current session
  try {
    const session = await auth();
    debug.session = session ? {
      hasUser: !!session.user,
      email: session.user?.email,
      isVaultoEmployee: session.user?.isVaultoEmployee,
      isVaultoEmployeeType: typeof session.user?.isVaultoEmployee,
      id: session.user?.id,
      onboardingStatus: session.user?.onboardingStatus,
    } : null;
  } catch (error) {
    debug.session = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Check all users in database
  if (prisma) {
    try {
      const users = await prisma.user.findMany({
        select: {
          email: true,
          isVaultoEmployee: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      debug.dbUsers = users.map(u => ({
        email: u.email,
        isVaultoEmployee: u.isVaultoEmployee,
        emailEndsWithVaulto: u.email?.endsWith("@vaulto.ai"),
      }));
    } catch (error) {
      debug.dbUsers = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return NextResponse.json(debug);
}
