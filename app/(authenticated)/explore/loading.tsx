export default function ExploreLoading() {
  return (
    <div className="space-y-6">
      {/* Top section skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-border bg-card-bg"
          />
        ))}
      </div>

      {/* Divider */}
      <div className="border-b border-border" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl border border-border bg-card-bg"
          />
        ))}
      </div>
    </div>
  );
}
