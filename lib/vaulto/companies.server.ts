/**
 * Server-only company data functions that require database access.
 * These functions use Prisma and cannot be imported in client components.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPrivateCompanies, type PrivateCompany } from "./companies";

/** Cache tag for newly added companies */
export const NEWLY_ADDED_COMPANIES_CACHE_TAG = "newly-added-companies";

/**
 * Get the most recently added companies from the private_companies table.
 * Orders by id DESC (highest ID = most recently added).
 * Falls back to the last entries from the API if database query fails.
 * Cached for 5 minutes.
 */
export async function getNewlyAddedCompanies(count: number = 3): Promise<PrivateCompany[]> {
  return unstable_cache(
    async () => {
      // Get full company data from the API first
      const allCompanies = await getPrivateCompanies();

      if (!prisma) {
        console.warn("[getNewlyAddedCompanies] Prisma not available, using last API entries");
        return allCompanies.slice(-count).reverse();
      }

      try {
        // Query private_companies table directly, ordered by id DESC (newest first)
        // Exclude hidden companies from the results
        const recentCompanies = await prisma.$queryRaw<{ id: number; name: string }[]>`
          SELECT id, name FROM private_companies
          WHERE name NOT IN ('Freddie Mac', 'Fannie Mae', 'Beast Industries')
          ORDER BY id DESC LIMIT ${count}
        `;

        if (recentCompanies.length === 0) {
          // Fall back to last entries from API
          return allCompanies.slice(-count).reverse();
        }

        // Match by name and preserve the id DESC order from database
        const recentCompanyNames = new Set(recentCompanies.map((c) => c.name.toLowerCase()));
        const matched = allCompanies.filter((c) => recentCompanyNames.has(c.name.toLowerCase()));

        // Sort by the database id order (preserve the order from DB query)
        const nameOrderMap = new Map(
          recentCompanies.map((c, idx) => [c.name.toLowerCase(), idx])
        );
        matched.sort((a, b) => {
          const orderA = nameOrderMap.get(a.name.toLowerCase()) ?? 999;
          const orderB = nameOrderMap.get(b.name.toLowerCase()) ?? 999;
          return orderA - orderB;
        });

        return matched;
      } catch (error) {
        console.error("[getNewlyAddedCompanies] Failed to fetch from DB, using last API entries:", error);
        // Fall back to last entries from API
        return allCompanies.slice(-count).reverse();
      }
    },
    [`newly-added-companies-${count}`],
    { revalidate: 300, tags: [NEWLY_ADDED_COMPANIES_CACHE_TAG] }
  )();
}
