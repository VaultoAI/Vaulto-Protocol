"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Layers, TrendingUp, Wallet, Cpu, Brain, Rocket } from "lucide-react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import { getSyntheticSymbol, getCompanySlug } from "@/lib/vaulto/companies";
import { getCompanyLogoUrl } from "@/lib/utils/companyLogo";
import type { Category } from "@/lib/vaulto/companyUtils";

const SEARCH_CATEGORIES: { label: Category; icon: typeof Layers }[] = [
  { label: "All assets", icon: Layers },
  { label: "Tradable", icon: TrendingUp },
  { label: "Fintech", icon: Wallet },
  { label: "Technology", icon: Cpu },
  { label: "AI ML", icon: Brain },
  { label: "Aerospace", icon: Rocket },
];

interface SearchDropdownProps {
  companies?: PrivateCompany[];
  /**
   * Mode controls what the dropdown shows:
   * - "categories": Show category filters (for explore page)
   * - "companies": Show company suggestions (for other pages)
   */
  mode?: "categories" | "companies";
}

export function SearchDropdown({ companies: initialCompanies, mode = "categories" }: SearchDropdownProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams?.get("q") || "");
  const [isFocused, setIsFocused] = useState(false);
  const [companies, setCompanies] = useState<PrivateCompany[]>(initialCompanies || []);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  // Fetch companies from API if in companies mode and not provided via props.
  useEffect(() => {
    if (mode !== "companies") return;

    if (initialCompanies && initialCompanies.length > 0) {
      setCompanies(initialCompanies);
      return;
    }

    if (hasFetched.current) return;
    hasFetched.current = true;

    async function fetchCompanies() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/companies");
        if (res.ok) {
          const data = await res.json();
          setCompanies(data.companies || []);
        }
      } catch (error) {
        console.error("Failed to fetch companies:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCompanies();
  }, [initialCompanies, mode]);

  // Sync with URL (only for categories mode on explore page)
  useEffect(() => {
    if (mode === "categories") {
      setSearchValue(searchParams?.get("q") || "");
    }
  }, [searchParams, mode]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on scroll
  useEffect(() => {
    if (!isFocused) return;

    function handleScroll() {
      setIsFocused(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isFocused]);

  // Filter companies for autocomplete (limit to 5). Runs in both modes so
  // typing on explore page surfaces matching companies as suggestions.
  const matchingCompanies = useMemo(() => {
    if (!searchValue.trim() || companies.length === 0) return [];
    const q = searchValue.toLowerCase().trim();
    return companies
      .filter((c) => {
        const symbol = getSyntheticSymbol(c.name).toLowerCase();
        return c.name.toLowerCase().includes(q) || symbol.includes(q);
      })
      .slice(0, 5);
  }, [companies, searchValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    if (mode === "categories") {
      // Update URL for grid filtering on explore page.
      // scroll:false so the page doesn't jump to top on every keystroke,
      // which would also trip the scroll-listener and close this dropdown.
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (value.trim()) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      router.push(`/explore${params.toString() ? `?${params}` : ""}`, { scroll: false });
    }
  };

  const handleCategoryClick = (category: Category) => {
    setSearchValue("");
    setIsFocused(false);
    // Update URL with category param
    const params = new URLSearchParams();
    if (category !== "All assets") {
      params.set("category", category);
    }
    router.push(`/explore${params.toString() ? `?${params}` : ""}`);
  };

  const handleCompanyClick = (company: PrivateCompany) => {
    setSearchValue("");
    setIsFocused(false);
    router.push(`/explore/${getCompanySlug(company.name)}`);
  };

  const isTyping = searchValue.trim() !== "";
  const showCategories = mode === "categories" && !isTyping;
  // Company-suggestion dropdown is only for non-explore pages. On explore the
  // header search filters the grid directly, so suppress the dropdown when
  // typing to avoid duplicating the grid result.
  const showCompanies = mode === "companies" && isTyping && matchingCompanies.length > 0;
  const showLoading = mode === "companies" && isTyping && isLoading && companies.length === 0;
  const showNoResults = mode === "companies" && isTyping && !isLoading && matchingCompanies.length === 0 && companies.length > 0;
  const showDropdown = isFocused && (showCategories || showCompanies || showLoading || showNoResults);

  return (
    <div ref={containerRef} className="relative w-[320px]">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="text"
          placeholder="Search assets"
          value={searchValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(e) => e.key === "Escape" && setIsFocused(false)}
          className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-all"
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
          {/* Categories section (empty input on explore page) */}
          {showCategories && (
            <>
              <div className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wide">
                Categories
              </div>
              {SEARCH_CATEGORIES.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => handleCategoryClick(label)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-badge-bg transition-colors"
                >
                  <Icon className="h-4 w-4 text-muted" />
                  {label}
                </button>
              ))}
            </>
          )}

          {/* Loading state */}
          {showLoading && (
            <div className="px-3 py-4 text-sm text-muted text-center">
              Loading...
            </div>
          )}

          {/* Company suggestions */}
          {showCompanies && (
            <>
              <div className="px-3 py-2 text-xs text-muted font-medium uppercase tracking-wide">
                Companies
              </div>
              {matchingCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleCompanyClick(company)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-badge-bg transition-colors text-left"
                >
                  <img
                    src={getCompanyLogoUrl(company.name, company.website) || "/placeholder-logo.png"}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover flex-shrink-0"
                  />
                  <span className="truncate">{company.name}</span>
                </button>
              ))}
            </>
          )}

          {/* No results */}
          {showNoResults && (
            <div className="px-3 py-4 text-sm text-muted text-center">
              No companies found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
