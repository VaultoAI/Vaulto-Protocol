import type { NewsArticle } from "@/lib/news/types";
import { formatRelativeTime } from "@/lib/news/fetcher";

interface NewsCardProps {
  article: NewsArticle;
}

/**
 * Individual news article card for the News & Press section.
 * Displays source, relative time, title, and description snippet.
 */
export function NewsCard({ article }: NewsCardProps) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border bg-badge-bg/30 p-4 hover:bg-card-hover active:bg-card-hover transition-colors"
    >
      {/* Header: Source name and time */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted">
          {article.source.name}
        </span>
        <span className="text-xs text-muted">
          {formatRelativeTime(article.publishedAt)}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-foreground mb-2 line-clamp-2">
        {article.title}
      </h3>

      {/* Description */}
      {article.description && (
        <p className="text-xs text-muted leading-relaxed line-clamp-2">
          {article.description}
        </p>
      )}
    </a>
  );
}
