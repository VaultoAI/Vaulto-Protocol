import type { PrivateCompany } from "./companies";

/** Asset category filter options */
export const CATEGORIES = [
  "All assets",
  "Technology",
  "AI & ML",
  "Fintech",
  "Space & Defense",
  "Consumer",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Industry to category mapping */
const INDUSTRY_CATEGORY_MAP: Record<string, Category[]> = {
  "Artificial Intelligence": ["Technology", "AI & ML"],
  "Machine Learning": ["Technology", "AI & ML"],
  "AI": ["Technology", "AI & ML"],
  "Technology": ["Technology"],
  "Software": ["Technology"],
  "Cloud Computing": ["Technology"],
  "Cybersecurity": ["Technology"],
  "Fintech": ["Technology", "Fintech"],
  "Financial Services": ["Fintech"],
  "Payments": ["Fintech"],
  "Banking": ["Fintech"],
  "Aerospace": ["Space & Defense"],
  "Space": ["Space & Defense"],
  "Defense": ["Space & Defense"],
  "Space Technology": ["Space & Defense"],
  "Consumer": ["Consumer"],
  "E-commerce": ["Consumer"],
  "Retail": ["Consumer"],
  "Entertainment": ["Consumer"],
  "Media": ["Consumer"],
  "Social Media": ["Consumer", "Technology"],
};

/** Get categories for a company based on its industry */
export function getCompanyCategory(company: PrivateCompany): Category[] {
  const industry = company.industry;

  // Check for exact match first
  if (INDUSTRY_CATEGORY_MAP[industry]) {
    return INDUSTRY_CATEGORY_MAP[industry];
  }

  // Check for partial matches
  const lowerIndustry = industry.toLowerCase();
  for (const [key, categories] of Object.entries(INDUSTRY_CATEGORY_MAP)) {
    if (lowerIndustry.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerIndustry)) {
      return categories;
    }
  }

  // Check specific keywords
  if (lowerIndustry.includes("ai") || lowerIndustry.includes("artificial") || lowerIndustry.includes("machine learning")) {
    return ["Technology", "AI & ML"];
  }
  if (lowerIndustry.includes("space") || lowerIndustry.includes("aerospace") || lowerIndustry.includes("defense")) {
    return ["Space & Defense"];
  }
  if (lowerIndustry.includes("fintech") || lowerIndustry.includes("financial") || lowerIndustry.includes("payment")) {
    return ["Fintech"];
  }
  if (lowerIndustry.includes("consumer") || lowerIndustry.includes("retail") || lowerIndustry.includes("commerce")) {
    return ["Consumer"];
  }

  // Default to Technology for tech-related companies
  return ["Technology"];
}

/**
 * Generate a deterministic daily change percentage for a company.
 * This is simulated data for demo purposes.
 */
export function getDailyChange(company: PrivateCompany): number {
  // Use company id and current date to generate deterministic but varying change
  const today = new Date();
  const seed = company.id + today.getDate() + today.getMonth();

  // Generate a pseudo-random number between -5 and +8
  const pseudoRandom = Math.sin(seed * 12.9898) * 43758.5453;
  const normalized = pseudoRandom - Math.floor(pseudoRandom);

  // Bias slightly positive (typical market behavior)
  const change = (normalized * 13) - 5;

  return Math.round(change * 100) / 100;
}
