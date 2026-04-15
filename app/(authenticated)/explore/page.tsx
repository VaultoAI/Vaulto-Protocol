import { getPrivateCompanies } from "@/lib/vaulto/companies";
import { getNewlyAddedCompanies } from "@/lib/vaulto/companies.server";
import { ExplorePageClient } from "@/components/ExplorePageClient";
import { VAULTO_INDEXES, getIndexPrices } from "@/lib/vaulto/indexes";
import { getAllImpliedValuations } from "@/lib/polymarket/implied-valuations";

export const revalidate = 60; // ISR: revalidate every 60 seconds

/**
 * Explore page - displays available private company stocks.
 * Auth is handled by the (authenticated) layout.
 */
export default async function ExplorePage() {
  const [companies, indexPrices, newlyAdded, impliedValuations] = await Promise.all([
    getPrivateCompanies(),
    getIndexPrices(),
    getNewlyAddedCompanies(3),
    getAllImpliedValuations(),
  ]);

  return (
    <ExplorePageClient
      companies={companies}
      indexes={VAULTO_INDEXES}
      indexPrices={indexPrices}
      newlyAdded={newlyAdded}
      impliedValuations={impliedValuations}
    />
  );
}
