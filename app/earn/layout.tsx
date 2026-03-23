import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function EarnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV !== "development") {
    const session = await auth();

    if (!session?.user) {
      redirect("/");
    }

    if (!session.user.isVaultoEmployee) {
      redirect("/waitlist-success");
    }
  }

  return <>{children}</>;
}
