import { getPrivateCompanies } from "@/lib/vaulto/companies";
import { getIndexBySymbol, getIndexPrices, getIndexHistory } from "@/lib/vaulto/indexes";
import { IndexDetailPage } from "@/components/IndexDetailPage";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface IndexPageProps {
  params: Promise<{ symbol: string }>;
}

/**
 * Index detail page.
 * Auth is handled by the (authenticated) layout.
 */
export default async function IndexPage({ params }: IndexPageProps) {
  const { symbol } = await params;
  const index = getIndexBySymbol(symbol);

  if (!index) {
    notFound();
  }

  // Fetch all required data in parallel
  const [companies, indexPrices, history] = await Promise.all([
    getPrivateCompanies(),
    getIndexPrices(),
    getIndexHistory(symbol, 365), // Fetch up to 1 year of history
  ]);

  const priceData = indexPrices[index.symbol];

  return (
    <IndexDetailPage
      index={index}
      companies={companies}
      priceData={priceData}
      history={history}
      enableTrading={true}
    />
  );
}
