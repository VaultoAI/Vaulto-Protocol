import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";

export interface LeaderboardUser {
  rank: number;
  displayName: string;
  points: number;
  bonusPoints: number;
  createdAt: string;
  isCurrentUser: boolean;
  hasSharedToX: boolean;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardUser[];
  currentUser: {
    rank: number;
    points: number;
    bonusPoints: number;
    createdAt: string;
    hasSharedToX: boolean;
    referralCode: string | null;
    referralCount: number;
  } | null;
  // Total number of people on the waitlist, including:
  // - Individual user records with onboardingStatus = NOT_STARTED
  // - Historical signups that are not stored as individual User rows
  totalUsers: number;
}

// Special synthetic User row that aggregates historical waitlist signups
// that were collected outside of the current Supabase-backed system.
// The numeric value is stored in the "name" field and represents the
// count of those external waitlist users. This row MUST:
// - Be included in total waitlist counts
// - Never be surfaced as a normal user in the leaderboard
const USER_MULTIPLE_ID = "USER_MULTIPLE";

function formatDisplayName(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      const firstName = parts[0];
      const lastInitial = parts[parts.length - 1][0]?.toUpperCase();
      return `${firstName} ${lastInitial}`;
    }
    return parts[0];
  }

  // Fallback to email prefix if no name
  const emailPrefix = email.split("@")[0];
  return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1, 8);
}

function calculatePoints(createdAt: Date, bonusPoints: number): number {
  const now = new Date();
  const timeBasedPoints = Math.floor((now.getTime() - createdAt.getTime()) / 333);
  return timeBasedPoints + bonusPoints;
}

// For users outside top 50, calculate their adjusted rank.
// Users who signed up AFTER the USER_MULTIPLE row was created should have
// their rank offset by the historical user count (they're behind all those users).
// Users who signed up BEFORE USER_MULTIPLE keep their original rank.
function getAdjustedRank(
  baseRank: number,
  userCreatedAt: Date,
  userMultipleCreatedAt: Date | null,
  additionalUsers: number
): number {
  // If user_multiple doesn't exist or user was created before it, no offset
  if (!userMultipleCreatedAt || userCreatedAt < userMultipleCreatedAt) {
    return baseRank;
  }
  // User signed up after historical import - add offset
  return baseRank + additionalUsers;
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    // Get the special aggregate waitlist row. This represents people who
    // previously signed up for the waitlist but do not exist as individual
    // User rows in the database. The "name" field stores their count.
    // We also fetch createdAt to determine which users should have their
    // rank offset by the historical user count.
    const userMultipleRow = await db.user.findUnique({
      where: { id: USER_MULTIPLE_ID },
      select: { name: true, createdAt: true },
    });

    const additionalWaitlistUsers =
      userMultipleRow?.name ? Number(userMultipleRow.name) || 0 : 0;
    const userMultipleCreatedAt = userMultipleRow?.createdAt || null;

    // Get all waitlist users (NOT_STARTED onboarding status), excluding the aggregate row
    const waitlistUsers = await db.user.findMany({
      where: {
        onboardingStatus: "NOT_STARTED",
        isVaultoEmployee: false,
        id: { not: USER_MULTIPLE_ID },
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        bonusPoints: true,
        hasSharedToX: true,
        referralCode: true,
        _count: {
          select: {
            referrals: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc", // Oldest first = most points
      },
    });

    // Calculate points and create leaderboard
    const now = new Date();
    const leaderboardWithPoints = waitlistUsers.map((user) => ({
      ...user,
      points: calculatePoints(user.createdAt, user.bonusPoints),
    }));

    // Sort by points descending
    leaderboardWithPoints.sort((a, b) => b.points - a.points);

    // Find current user's position
    const currentUserIndex = leaderboardWithPoints.findIndex(
      (u) => u.email === session.user?.email
    );
    const currentUserData = currentUserIndex >= 0 ? leaderboardWithPoints[currentUserIndex] : null;

    // Build leaderboard response (top 50 users)
    const leaderboard: LeaderboardUser[] = leaderboardWithPoints
      .slice(0, 50)
      .map((user, index) => ({
        rank: index + 1,
        displayName: formatDisplayName(user.name, user.email),
        points: user.points,
        bonusPoints: user.bonusPoints,
        createdAt: user.createdAt.toISOString(),
        isCurrentUser: user.email === session.user?.email,
        hasSharedToX: user.hasSharedToX,
      }));

    // If current user is not in top 50, add them at the end with adjusted rank
    if (currentUserIndex >= 50 && currentUserData) {
      const adjustedRank = getAdjustedRank(
        currentUserIndex + 1,
        currentUserData.createdAt,
        userMultipleCreatedAt,
        additionalWaitlistUsers
      );
      leaderboard.push({
        rank: adjustedRank,
        displayName: formatDisplayName(currentUserData.name, currentUserData.email),
        points: currentUserData.points,
        bonusPoints: currentUserData.bonusPoints,
        createdAt: currentUserData.createdAt.toISOString(),
        isCurrentUser: true,
        hasSharedToX: currentUserData.hasSharedToX,
      });
    }

    // Calculate current user's rank (adjusted for users outside top 50)
    const currentUserRank = currentUserData
      ? currentUserIndex < 50
        ? currentUserIndex + 1 // Top 50 keeps normal rank
        : getAdjustedRank(
            currentUserIndex + 1,
            currentUserData.createdAt,
            userMultipleCreatedAt,
            additionalWaitlistUsers
          )
      : 0;

    return NextResponse.json({
      leaderboard,
      currentUser: currentUserData
        ? {
            rank: currentUserRank,
            points: currentUserData.points,
            bonusPoints: currentUserData.bonusPoints,
            createdAt: currentUserData.createdAt.toISOString(),
            hasSharedToX: currentUserData.hasSharedToX,
            referralCode: currentUserData.referralCode,
            referralCount: currentUserData._count.referrals,
          }
        : null,
      totalUsers: waitlistUsers.length + additionalWaitlistUsers,
    } as LeaderboardResponse);
  } catch (error) {
    console.error("Get leaderboard error:", error);
    return NextResponse.json(
      { error: "Failed to get leaderboard" },
      { status: 500 }
    );
  }
}
