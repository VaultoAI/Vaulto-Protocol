import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/LandingPage";

export default async function Home() {
  // In development, skip auth and go straight to the app
  if (process.env.NODE_ENV === "development") {
    redirect("/mint");
  }

  const session = await auth();

  // Redirect authenticated users to waitlist success page
  if (session?.user) {
    if (session.user.isVaultoEmployee) {
      redirect("/mint");
    }
    redirect("/waitlist-success");
  }

  return <LandingPage />;
}
