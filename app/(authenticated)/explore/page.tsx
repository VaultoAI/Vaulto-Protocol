import { getPrivateCompanies } from "@/lib/vaulto/companies";
import { getNewlyAddedCompanies } from "@/lib/vaulto/companies.server";
import { ExplorePageClient } from "@/components/ExplorePageClient";
import { VAULTO_INDEXES, getIndexPrices } from "@/lib/vaulto/indexes";

export const dynamic = "force-dynamic";

/**
 * Explore page - displays available private company stocks.
 * Auth is handled by the (authenticated) layout.
 */
export default async function ExplorePage() {
  const [companies, indexPrices, newlyAdded] = await Promise.all([
    getPrivateCompanies(),
    getIndexPrices(),
    getNewlyAddedCompanies(3),
  ]);

  return (
    <ExplorePageClient
      companies={companies}
      indexes={VAULTO_INDEXES}
      indexPrices={indexPrices}
      newlyAdded={newlyAdded}
    />
  );
}
