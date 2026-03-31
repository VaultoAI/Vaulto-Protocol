export default function EarnLoading() {
  return (
    <div className="space-y-6">
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-border bg-card-bg"
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border bg-card-bg">
        <div className="h-12 animate-pulse border-b border-border bg-card-hover" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse border-b border-border last:border-0"
          />
        ))}
      </div>
    </div>
  );
}
