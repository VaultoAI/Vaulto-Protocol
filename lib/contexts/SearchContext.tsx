"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { PrivateCompany } from "@/lib/vaulto/companies";
import type { Category } from "@/lib/vaulto/companyUtils";

interface SearchContextValue {
  companies: PrivateCompany[];
  activeCategory: Category;
  setActiveCategory: (category: Category) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

interface SearchProviderProps {
  children: ReactNode;
  companies: PrivateCompany[];
  activeCategory: Category;
  setActiveCategory: (category: Category) => void;
}

export function SearchProvider({
  children,
  companies,
  activeCategory,
  setActiveCategory,
}: SearchProviderProps) {
  return (
    <SearchContext.Provider value={{ companies, activeCategory, setActiveCategory }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  return useContext(SearchContext);
}
