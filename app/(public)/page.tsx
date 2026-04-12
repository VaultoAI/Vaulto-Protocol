import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/LandingPage";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const params = await searchParams;

  // Allow preview mode to bypass auth redirects (for testing landing page)
  if (params.preview === "landing") {
    return <LandingPage />;
  }

  const session = await auth();

  // Redirect authenticated users to waitlist success page
  if (session?.user) {
    if (session.user.isVaultoEmployee) {
      redirect("/explore");
    }
    redirect("/waitlist-success");
  }

  return <LandingPage />;
}
