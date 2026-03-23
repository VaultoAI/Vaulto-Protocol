import { getPrivateCompanies } from "@/lib/vaulto/companies";
import { CompanyDetailPage } from "@/components/CompanyDetailPage";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";

interface CompanyPageProps {
  params: Promise<{ companyId: string }>;
}

export default async function CompanyPage({ params }: CompanyPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  if (!session.user.isVaultoEmployee) {
    redirect("/waitlist-success");
  }

  const { companyId } = await params;
  const companies = await getPrivateCompanies();
  const company = companies.find((c) => String(c.id) === companyId);

  if (!company) {
    notFound();
  }

  return <CompanyDetailPage company={company} />;
}
