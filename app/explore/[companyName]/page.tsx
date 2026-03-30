import { getPrivateCompanies, getCompanySlug } from "@/lib/vaulto/companies";
import { CompanyDetailPage } from "@/components/CompanyDetailPage";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";

interface CompanyPageProps {
  params: Promise<{ companyName: string }>;
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  if (process.env.NODE_ENV !== "development") {
    const session = await auth();

    if (!session?.user) {
      redirect("/");
    }

    if (!session.user.isVaultoEmployee) {
      redirect("/waitlist-success");
    }
  }

  const { companyName } = await params;
  const companies = await getPrivateCompanies();
  const company = companies.find((c) => getCompanySlug(c.name) === companyName);

  if (!company) {
    notFound();
  }

  return <CompanyDetailPage company={company} />;
}
