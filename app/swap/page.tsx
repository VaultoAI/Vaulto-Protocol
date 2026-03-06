import { getTokensWithDisplayNames } from "@/lib/pools";
import { SwapWidget } from "@/components/SwapWidget";

export default function SwapPage() {
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
