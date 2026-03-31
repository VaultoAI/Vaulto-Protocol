export default function PredictionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="h-10 w-48 animate-pulse rounded-lg bg-card-bg" />

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-xl border border-border bg-card-bg"
          />
        ))}
      </div>
    </div>
  );
}
