import { getCompanyIPOs, formatValuationPrecise } from "@/lib/polymarket/ipo-valuations";
import { IPOValuationList } from "@/components/IPOValuationList";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PredictionsPage() {
  if (process.env.NODE_ENV !== "development") {
    const session = await auth();

    if (!session?.user) {
      redirect("/");
    }

    if (!session.user.isVaultoEmployee) {
      redirect("/waitlist-success");
    }
  }

  const ipos = await getCompanyIPOs();

  // Calculate aggregate metrics
  const totalExpectedIPOValue = ipos.reduce((sum, ipo) => sum + ipo.expectedIPOValue, 0);
  const totalBands = ipos.reduce((sum, ipo) => sum + ipo.bands.length, 0);

  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight">IPO Valuation Predictions</h1>
      <p className="mt-2 text-muted">
        Trade Long/Short positions on private company IPO valuations from Polymarket.
        Click thresholds to view the underlying market.
      </p>

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted">Companies</p>
          <p className="mt-1 text-xl font-medium">{ipos.length}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted">Polymarket Bands</p>
          <p className="mt-1 text-xl font-medium">{totalBands}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted">Total Expected IPO Value</p>
          <p className="mt-1 text-xl font-medium text-blue-600 dark:text-blue-400">
            {formatValuationPrecise(totalExpectedIPOValue)}
          </p>
        </div>
      </div>

      {/* IPO Valuation Cards */}
      <IPOValuationList ipos={ipos} />

      {ipos.length === 0 && (
        <div className="mt-8 rounded-md border border-border bg-muted/30 px-6 py-12 text-center">
          <p className="text-muted">No private company IPO valuation markets found on Polymarket.</p>
          <p className="mt-2 text-sm text-muted">
            Check back later or visit{" "}
            <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
              Polymarket
            </a>{" "}
            directly.
          </p>
        </div>
      )}

      {ipos.length > 0 && (
        <p className="mt-6 text-xs text-center text-muted">
          Data sourced from{" "}
          <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
            Polymarket
          </a>{" "}
          prediction markets. Prices and probabilities update in real-time.
        </p>
      )}
    </div>
  );
}
