import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WaitlistScreen } from "@/components/WaitlistScreen";

export default async function Home() {
  const session = await auth();

  // Redirect authenticated users to waitlist success page
  if (session?.user) {
    if (session.user.isVaultoEmployee) {
      redirect("/swap");
    }
    redirect("/waitlist-success");
  }

  return <WaitlistScreen />;
}
