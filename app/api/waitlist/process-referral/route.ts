import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";

const REFERRAL_BONUS_POINTS = 250000;

export interface ProcessReferralRequest {
  referralCode: string;
}

export interface ProcessReferralResponse {
  success: boolean;
  message: string;
  pointsAwarded?: number;
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    const body: ProcessReferralRequest = await request.json();
    const { referralCode } = body;

    if (!referralCode) {
      return NextResponse.json(
        { success: false, message: "Referral code is required" },
        { status: 400 }
      );
    }

    // Find the current user
    const currentUser = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, referredById: true, referralCode: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // Check if user was already referred
    if (currentUser.referredById) {
      return NextResponse.json({
        success: false,
        message: "You have already used a referral code",
      } as ProcessReferralResponse);
    }

    // Find the referrer by their referral code
    const referrer = await db.user.findUnique({
      where: { referralCode: referralCode.toUpperCase() },
      select: { id: true, email: true },
    });

    if (!referrer) {
      return NextResponse.json({
        success: false,
        message: "Invalid referral code",
      } as ProcessReferralResponse);
    }

    // Check for self-referral
    if (referrer.id === currentUser.id) {
      return NextResponse.json({
        success: false,
        message: "You cannot use your own referral code",
      } as ProcessReferralResponse);
    }

    // Process the referral in a transaction
    await db.$transaction([
      // Award bonus points to the referrer
      db.user.update({
        where: { id: referrer.id },
        data: {
          bonusPoints: { increment: REFERRAL_BONUS_POINTS },
        },
      }),
      // Mark the current user as referred
      db.user.update({
        where: { id: currentUser.id },
        data: { referredById: referrer.id },
      }),
    ]);

    console.log(
      `[Referral] User ${session.user.email} referred by ${referrer.email}. Awarded ${REFERRAL_BONUS_POINTS} points.`
    );

    return NextResponse.json({
      success: true,
      message: "Referral processed successfully!",
      pointsAwarded: REFERRAL_BONUS_POINTS,
    } as ProcessReferralResponse);
  } catch (error) {
    console.error("Process referral error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to process referral" },
      { status: 500 }
    );
  }
}
