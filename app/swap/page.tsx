import { getTokensWithDisplayNames } from "@/lib/pools";
import { SwapWidget } from "@/components/SwapWidget";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SwapPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  if (!session.user.isVaultoEmployee) {
    redirect("/waitlist-success");
  }

  const tokens = getTokensWithDisplayNames();
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-medium tracking-tight">Swap</h1>
      <p className="mt-2 text-muted">Exchange private company tokens and USDC.</p>
      <div className="mt-8">
        <SwapWidget tokens={tokens} />
      </div>
    </div>
  );
}
