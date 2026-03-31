"use client";

import { useEffect, useState } from "react";
import type { NewsArticle } from "@/lib/news/types";
import { NewsCard } from "./NewsCard";

interface NewsSectionProps {
  companyName: string;
  ceo?: string;
  products?: string[];
}

/**
 * News & Press section for company detail page.
 * Fetches and displays recent news articles about the company.
 * Uses company name, CEO, and products for more relevant results.
 */
export function NewsSection({ companyName, ceo, products }: NewsSectionProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const params = new URLSearchParams();
        params.set("company", companyName);
        params.set("limit", "6");
        if (ceo) params.set("ceo", ceo);
        if (products && products.length > 0) {
          params.set("products", products.join(","));
        }

        const res = await fetch(`/api/company-news?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles || []);
        }
      } catch (error) {
        console.error("Failed to fetch news:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNews();
  }, [companyName, ceo, products]);

  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground mb-1">News & Press</h2>
      <div className="border-t border-border mb-4" />

      {loading ? (
        <LoadingSkeleton />
      ) : articles.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-badge-bg/30 p-4 animate-pulse"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="h-3 w-20 bg-border rounded" />
            <div className="h-3 w-12 bg-border rounded" />
          </div>
          <div className="h-4 w-full bg-border rounded mb-2" />
          <div className="h-4 w-3/4 bg-border rounded mb-2" />
          <div className="h-3 w-full bg-border rounded" />
          <div className="h-3 w-2/3 bg-border rounded mt-1" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-badge-bg/30 p-6 text-center">
      <p className="text-sm text-muted">No recent news available</p>
    </div>
  );
}
