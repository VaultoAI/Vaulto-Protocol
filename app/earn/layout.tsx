import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function EarnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  if (!session.user.isVaultoEmployee) {
    redirect("/waitlist-success");
  }

  return <>{children}</>;
}
