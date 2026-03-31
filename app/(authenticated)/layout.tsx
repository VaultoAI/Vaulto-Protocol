import { Providers } from "@/components/Providers";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Authenticated layout with full Web3 providers.
 * Only loaded for platform routes (/explore, /earn, etc.)
 */
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // In development, allow direct access without auth
  if (process.env.NODE_ENV !== "development") {
    const session = await auth();

    if (!session?.user) {
      redirect("/");
    }

    if (!session.user.isVaultoEmployee) {
      redirect("/waitlist-success");
    }
  }

  return (
    <Providers>
      <div className="flex min-h-screen flex-col">
        <TopNav />
        <main className="flex-1">
          <div className="mx-auto max-w-[1400px] px-6 py-6">{children}</div>
        </main>
        <Footer />
      </div>
    </Providers>
  );
}
