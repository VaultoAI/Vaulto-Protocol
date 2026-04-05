import { getPrivateCompanies } from "@/lib/vaulto/companies";
import { getNewlyAddedCompanies } from "@/lib/vaulto/companies.server";
import { ExploreTopSection } from "@/components/ExploreTopSection";
import { ExploreAssets } from "@/components/ExploreAssets";
import { IndexesSection } from "@/components/IndexesSection";
import { VAULTO_INDEXES, getIndexPrices } from "@/lib/vaulto/indexes";
import { get24hPriceChanges } from "@/lib/polymarket/implied-valuations";

export const dynamic = "force-dynamic";

/**
 * Explore page - displays available private company stocks.
 * Auth is handled by the (authenticated) layout.
 */
export default async function ExplorePage() {
  const [companies, indexPrices, priceChanges24h, newlyAdded] = await Promise.all([
    getPrivateCompanies(),
    getIndexPrices(),
    get24hPriceChanges(),
    getNewlyAddedCompanies(3),
  ]);

  return (
    <div>
      {/* Index Products section */}
      <IndexesSection indexes={VAULTO_INDEXES} companies={companies} indexPrices={indexPrices} />

      {/* Divider */}
      <div className="border-b border-border" />

      {/* Top section: Gainers, Trending, Newly Added */}
      <ExploreTopSection companies={companies} newlyAdded={newlyAdded} />

      {/* Divider */}
      <div className="border-b border-border" />

      {/* Explore Assets grid */}
      <ExploreAssets companies={companies} />

      {/* Empty state */}
      {companies.length === 0 && (
        <div className="mt-8 rounded-xl border border-border bg-card-bg px-6 py-16 text-center">
          <p className="text-muted text-sm">No companies available for minting.</p>
        </div>
      )}
    </div>
  );
}
