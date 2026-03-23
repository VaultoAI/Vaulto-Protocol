import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { WaitlistSuccess } from "@/components/WaitlistSuccess";
import { prisma } from "@/lib/prisma";

type Props = { searchParams: Promise<{ from?: string; name?: string; createdAt?: string }> };

export default async function WaitlistSuccessPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  const fromEmail = params.from === "email";
  const emailSignupFirstName = typeof params.name === "string" ? params.name.trim().slice(0, 100) : null;
  const emailSignupCreatedAt = typeof params.createdAt === "string" ? params.createdAt : null;

  if (fromEmail && !session?.user) {
    return (
      <WaitlistSuccess
        user={null}
        userData={emailSignupCreatedAt ? { createdAt: emailSignupCreatedAt, bonusPoints: 0, hasSharedToX: false } : null}
        pendingReferralCode={null}
        emailSignupFirstName={emailSignupFirstName || undefined}
      />
    );
  }

  if (!session?.user) {
    redirect("/");
  }

  // Vaulto employees get immediate access to the platform
  if (session.user.isVaultoEmployee) {
    redirect("/swap");
  }

  // Read referral code from cookie (set when user landed on /?ref= before signup)
  const cookieStore = await cookies();
  const pendingReferralCode = cookieStore.get("waitlist_ref")?.value ?? null;

  // Fetch additional user data for leaderboard
  let userData = null;
  if (prisma && session.user.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        createdAt: true,
        bonusPoints: true,
        hasSharedToX: true,
      },
    });
    if (dbUser) {
      userData = {
        createdAt: dbUser.createdAt.toISOString(),
        bonusPoints: dbUser.bonusPoints,
        hasSharedToX: dbUser.hasSharedToX,
      };
    }
  }

  return (
    <WaitlistSuccess
      user={session.user}
      userData={userData}
      pendingReferralCode={pendingReferralCode}
    />
  );
}
