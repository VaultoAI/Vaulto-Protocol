import { getPrivateCompanyBySlug } from "@/lib/vaulto/companies";
import { CompanyDetailPage } from "@/components/CompanyDetailPage";
import { notFound } from "next/navigation";
import {
  hasImpliedValuationData,
  getImpliedValuationSlug,
  getImpliedValuationHistory,
  getImpliedValuation,
  type ImpliedValuationHistoryResponse,
} from "@/lib/polymarket/implied-valuations";

export const revalidate = 60; // ISR: revalidate every 60 seconds

interface CompanyPageProps {
  params: Promise<{ companyName: string }>;
}

/**
 * Company detail page.
 * Auth is handled by the (authenticated) layout.
 */
export default async function CompanyPage({ params }: CompanyPageProps) {
  const { companyName } = await params;
  const company = await getPrivateCompanyBySlug(companyName);

  if (!company) {
    notFound();
  }

  // Prefetch implied valuation data if available
  let prefetchedImpliedData: ImpliedValuationHistoryResponse | null = null;
  let prefetchedTotalVolume: number | null = null;

  if (hasImpliedValuationData(company.name)) {
    const slug = getImpliedValuationSlug(company.name);
    if (slug) {
      try {
        // Fetch history and current valuation in parallel
        const [historyData, currentData] = await Promise.all([
          getImpliedValuationHistory(slug, "ALL"),
          getImpliedValuation(slug),
        ]);

        prefetchedImpliedData = historyData;
        prefetchedTotalVolume = currentData?.totalVolume ?? null;
      } catch (error) {
        // Silently fail - the client will fetch this data if needed
        console.error("Failed to prefetch implied valuation data:", error);
      }
    }
  }

  return (
    <CompanyDetailPage
      company={company}
      prefetchedImpliedData={prefetchedImpliedData}
      prefetchedTotalVolume={prefetchedTotalVolume}
    />
  );
}
