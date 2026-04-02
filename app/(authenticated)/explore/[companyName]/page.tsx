import { getPrivateCompanies, getCompanySlug } from "@/lib/vaulto/companies";
import { CompanyDetailPage } from "@/components/CompanyDetailPage";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface CompanyPageProps {
  params: Promise<{ companyName: string }>;
}

/**
 * Company detail page.
 * Auth is handled by the (authenticated) layout.
 */
export default async function CompanyPage({ params }: CompanyPageProps) {
  const { companyName } = await params;
  const companies = await getPrivateCompanies();
  const company = companies.find((c) => getCompanySlug(c.name) === companyName);

  if (!company) {
    notFound();
  }

  return <CompanyDetailPage company={company} />;
}
