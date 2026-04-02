export default function ExploreLoading() {
  return (
    <div>
      {/* Top section: 3 columns like ExploreTopSection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {[1, 2, 3].map((colIndex) => (
          <div
            key={colIndex}
            className={`py-6 ${colIndex > 1 ? "md:pl-8 md:pr-6 md:border-l md:border-border" : "md:pr-8"}`}
          >
            {/* Column title */}
            <div className="flex items-center gap-2 mb-5">
              <div className="h-5 w-24 animate-pulse rounded bg-badge-bg/50" />
              {colIndex === 2 && (
                <div className="h-5 w-8 animate-pulse rounded-md bg-badge-bg/50" />
              )}
            </div>

            {/* 3 company items per column */}
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((itemIndex) => (
                <div key={itemIndex} className="flex items-center gap-3">
                  {/* Logo skeleton */}
                  <div className="h-9 w-9 animate-pulse rounded-full bg-badge-bg/50 shrink-0" />

                  {/* Name + symbol */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="h-4 w-12 animate-pulse rounded bg-badge-bg/50" />
                    <div className="h-3 w-24 animate-pulse rounded bg-badge-bg/30" />
                  </div>

                  {/* Price + metric */}
                  <div className="flex flex-col items-end shrink-0 w-[90px] space-y-1">
                    <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/50" />
                    <div className="h-3 w-12 animate-pulse rounded bg-badge-bg/30" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-b border-border" />

      {/* Explore Assets section */}
      <div className="mt-12">
        {/* Section header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-32 animate-pulse rounded bg-badge-bg/50" />
            <div className="h-5 w-8 animate-pulse rounded bg-badge-bg/30" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-badge-bg/50" />
            <div className="h-4 w-24 animate-pulse rounded bg-badge-bg/30" />
          </div>
        </div>

        {/* Search + Filters row */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 mb-6">
          {/* Search bar */}
          <div className="h-10 w-full lg:w-[320px] animate-pulse rounded-lg bg-badge-bg/50 shrink-0" />

          {/* Category filter chips */}
          <div className="flex items-center gap-1 flex-wrap flex-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-8 w-20 animate-pulse rounded-full bg-badge-bg/30"
              />
            ))}
          </div>

          {/* View toggle + Sort */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 animate-pulse rounded-md bg-badge-bg/30" />
            <div className="h-8 w-8 animate-pulse rounded-md bg-badge-bg/30" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-badge-bg/50" />
          </div>
        </div>

        {/* Asset cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card-bg p-4 space-y-3"
            >
              {/* Logo + name row */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-badge-bg/50" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-12 animate-pulse rounded bg-badge-bg/50" />
                  <div className="h-3 w-24 animate-pulse rounded bg-badge-bg/30" />
                </div>
              </div>
              {/* Chart area */}
              <div className="h-20 w-full animate-pulse rounded bg-badge-bg/30" />
              {/* Price row */}
              <div className="flex items-center justify-between pt-1">
                <div className="h-5 w-20 animate-pulse rounded bg-badge-bg/50" />
                <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
