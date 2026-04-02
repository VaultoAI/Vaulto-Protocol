export default function EarnLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      {/* Title + description */}
      <div className="h-8 w-20 animate-pulse rounded bg-badge-bg/50" />
      <div className="mt-2 h-5 w-80 animate-pulse rounded bg-badge-bg/30" />

      {/* Stats Dashboard - 5 cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`rounded-lg border border-border bg-background p-5 text-center ${i === 5 ? "col-span-2 sm:col-span-1" : ""}`}
          >
            <div className="mx-auto h-4 w-20 animate-pulse rounded bg-badge-bg/50" />
            <div className="mx-auto mt-2 h-6 w-24 animate-pulse rounded bg-badge-bg/50" />
          </div>
        ))}
      </div>

      {/* User Positions Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-32 animate-pulse rounded bg-badge-bg/50" />
          <div className="h-9 w-32 animate-pulse rounded-lg bg-badge-bg/50" />
        </div>
        <div className="rounded-lg border border-border bg-background p-6">
          <div className="mx-auto h-5 w-48 animate-pulse rounded bg-badge-bg/30" />
        </div>
      </div>

      {/* Discover Pools Section */}
      <div className="mt-8">
        <div className="h-6 w-32 animate-pulse rounded bg-badge-bg/50 mb-4" />

        {/* Featured Pools */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-background p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-badge-bg/50" />
                <div className="flex-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-badge-bg/50" />
                  <div className="mt-1 h-3 w-16 animate-pulse rounded bg-badge-bg/30" />
                </div>
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/30" />
                <div className="h-4 w-12 animate-pulse rounded bg-badge-bg/50" />
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="h-10 w-full sm:w-64 animate-pulse rounded-lg bg-badge-bg/50" />
          <div className="h-10 w-full sm:w-40 animate-pulse rounded-lg bg-badge-bg/30" />
          <div className="h-10 w-full sm:w-40 animate-pulse rounded-lg bg-badge-bg/30" />
          <div className="h-10 w-full sm:w-36 animate-pulse rounded-lg bg-badge-bg/30 ml-auto" />
        </div>

        {/* Pools Table */}
        <div className="rounded-lg border border-border bg-background overflow-hidden">
          {/* Table header */}
          <div className="bg-badge-bg/30 border-b border-border px-4 py-3 flex items-center">
            <div className="h-3 w-16 animate-pulse rounded bg-badge-bg/50 flex-1" />
            <div className="h-3 w-12 animate-pulse rounded bg-badge-bg/50 flex-1 text-right" />
            <div className="h-3 w-16 animate-pulse rounded bg-badge-bg/50 flex-1 text-right" />
            <div className="h-3 w-10 animate-pulse rounded bg-badge-bg/50 flex-1 text-right" />
            <div className="h-3 w-12 animate-pulse rounded bg-badge-bg/50 flex-1 text-right" />
          </div>
          {/* Table rows */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="border-b border-border last:border-0 px-4 py-4 flex items-center"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="h-8 w-8 animate-pulse rounded-full bg-badge-bg/50" />
                <div className="h-4 w-28 animate-pulse rounded bg-badge-bg/50" />
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/30 flex-1 text-right" />
              <div className="h-4 w-14 animate-pulse rounded bg-badge-bg/30 flex-1 text-right" />
              <div className="h-4 w-12 animate-pulse rounded bg-badge-bg/50 flex-1 text-right" />
              <div className="h-8 w-24 animate-pulse rounded-lg bg-badge-bg/30 flex-1 text-right ml-4" />
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 h-4 w-full animate-pulse rounded bg-badge-bg/20" />
    </div>
  );
}
