/**
 * Server-only company data functions that require database access.
 * These functions use Prisma and cannot be imported in client components.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { getPrivateCompanies, type PrivateCompany } from "./companies";

/**
 * Get the most recently added companies based on createdAt from the database.
 * Returns full PrivateCompany data by matching against API companies.
 */
export async function getNewlyAddedCompanies(count: number = 3): Promise<PrivateCompany[]> {
  if (!prisma) {
    console.warn("[getNewlyAddedCompanies] Prisma not available, falling back to empty");
    return [];
  }

  try {
    // Get the most recently created company names from the database
    const recentCompanies = await prisma.privateCompany.findMany({
      orderBy: { createdAt: "desc" },
      take: count,
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    if (recentCompanies.length === 0) {
      return [];
    }

    // Get full company data from the API
    const allCompanies = await getPrivateCompanies();

    // Match by name and preserve the createdAt order
    const recentCompanyNames = new Set(recentCompanies.map((c) => c.name.toLowerCase()));
    const matched = allCompanies.filter((c) => recentCompanyNames.has(c.name.toLowerCase()));

    // Sort by the database createdAt order (preserve the order from DB query)
    const nameOrderMap = new Map(
      recentCompanies.map((c, idx) => [c.name.toLowerCase(), idx])
    );
    matched.sort((a, b) => {
      const orderA = nameOrderMap.get(a.name.toLowerCase()) ?? 999;
      const orderB = nameOrderMap.get(b.name.toLowerCase()) ?? 999;
      return orderA - orderB;
    });

    // Add createdAt to matched companies
    const createdAtMap = new Map(
      recentCompanies.map((c) => [c.name.toLowerCase(), c.createdAt.toISOString()])
    );
    return matched.map((company) => ({
      ...company,
      createdAt: createdAtMap.get(company.name.toLowerCase()),
    }));
  } catch (error) {
    console.error("[getNewlyAddedCompanies] Failed to fetch:", error);
    return [];
  }
}
