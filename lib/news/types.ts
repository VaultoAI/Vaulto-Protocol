export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  source: { name: string; id: string | null };
  author: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
}

export interface CompanyNewsResponse {
  articles: NewsArticle[];
  meta: { company: string; totalResults: number; fetchedAt: string };
}

export interface CompanyNewsParams {
  company: string;
  ceo?: string;
  products?: string[];
  limit?: number;
}
