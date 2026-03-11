import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { generateReferralCode } from "@/lib/referral-code";

const REFERRAL_BONUS_POINTS = 250000;
const MAX_FIRST_NAME_LENGTH = 100;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const dbError = requireDatabase();
    if (dbError) return dbError;

    const body = await request.json();
    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    const rawFirstName = typeof body.firstName === "string" ? body.firstName.trim() : "";

    if (!rawEmail) {
      return NextResponse.json(
        { success: false, message: "Email is required." },
        { status: 400 }
      );
    }
    if (!EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (!rawFirstName) {
      return NextResponse.json(
        { success: false, message: "First name is required." },
        { status: 400 }
      );
    }

    const firstName = rawFirstName.slice(0, MAX_FIRST_NAME_LENGTH);
    const db = getDb();

    const cookieStore = await cookies();
    const referralCodeFromCookie = cookieStore.get("waitlist_ref")?.value?.trim().toUpperCase() ?? null;

    const existingUser = await db.user.findUnique({
      where: { email: rawEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: true, message: "Already on the list." },
        { status: 200 }
      );
    }

    let referrerId: string | null = null;
    if (referralCodeFromCookie && /^[A-Za-z0-9]{1,20}$/.test(referralCodeFromCookie)) {
      const referrer = await db.user.findUnique({
        where: { referralCode: referralCodeFromCookie },
        select: { id: true },
      });
      if (referrer) referrerId = referrer.id;
    }

    let newReferralCode: string | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateReferralCode();
      const taken = await db.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!taken) {
        newReferralCode = code;
        break;
      }
    }

    if (!newReferralCode) {
      return NextResponse.json(
        { success: false, message: "Unable to complete signup. Please try again." },
        { status: 500 }
      );
    }

    let newUser;
    if (referrerId) {
      newUser = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: rawEmail,
            name: firstName,
            referralCode: newReferralCode!,
            referredById: referrerId!,
            isVaultoEmployee: rawEmail.endsWith("@vaulto.ai"),
          },
        });
        await tx.user.update({
          where: { id: referrerId! },
          data: { bonusPoints: { increment: REFERRAL_BONUS_POINTS } },
        });
        return user;
      });
    } else {
      newUser = await db.user.create({
        data: {
          email: rawEmail,
          name: firstName,
          referralCode: newReferralCode,
          isVaultoEmployee: rawEmail.endsWith("@vaulto.ai"),
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "You're on the list!",
        createdAt: newUser.createdAt.toISOString(),
        bonusPoints: newUser.bonusPoints,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[email-signup]", error);
    return NextResponse.json(
      { success: false, message: "Failed to join waitlist. Please try again." },
      { status: 500 }
    );
  }
}
