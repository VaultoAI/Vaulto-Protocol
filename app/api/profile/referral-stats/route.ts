import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        referralCode: true,
        bonusPoints: true,
        _count: {
          select: {
            referrals: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      referralCode: user.referralCode,
      referralCount: user._count.referrals,
      bonusPoints: user.bonusPoints,
    });
  } catch (error) {
    console.error("[Referral Stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch referral stats" },
      { status: 500 }
    );
  }
}
