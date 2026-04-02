import {
  getPrivateCompanies,
} from "@/lib/vaulto/companies";
import { ExploreTopSection } from "@/components/ExploreTopSection";
import { ExploreAssets } from "@/components/ExploreAssets";

export const dynamic = "force-dynamic";

/**
 * Explore page - displays available private company stocks.
 * Auth is handled by the (authenticated) layout.
 */
export default async function ExplorePage() {
  const companies = await getPrivateCompanies();

  return (
    <div>
      {/* Top section: Gainers, Trending, Newly Added */}
      <ExploreTopSection companies={companies} />

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
