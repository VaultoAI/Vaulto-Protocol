export default function CompanyDetailLoading() {
  return (
    <div>
      {/* Main content: Chart + Trade Widget */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left side: Company info + Chart */}
        <div className="flex-1 min-w-0">
          {/* Company header skeleton */}
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-badge-bg/50" />
            <div className="h-7 w-48 animate-pulse rounded bg-badge-bg/50" />
          </div>

          {/* Price skeleton */}
          <div className="h-12 w-36 animate-pulse rounded bg-badge-bg/50 mb-1" />

          {/* Valuation skeleton */}
          <div className="h-6 w-44 animate-pulse rounded bg-badge-bg/50" />

          {/* Change indicator skeleton */}
          <div className="flex items-center gap-2 mt-1 mb-6">
            <div className="h-5 w-32 animate-pulse rounded bg-badge-bg/50" />
            <div className="h-5 w-20 animate-pulse rounded bg-badge-bg/50" />
          </div>

          {/* Chart skeleton */}
          <div className="rounded-xl border border-border bg-card-bg p-4">
            {/* Time range filters */}
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-12 animate-pulse rounded-lg bg-badge-bg/50"
                />
              ))}
            </div>
            {/* Chart area */}
            <div className="h-64 w-full animate-pulse rounded-lg bg-badge-bg/30" />
          </div>

          {/* Mobile trading widget */}
          <div className="lg:hidden mt-6">
            <div className="rounded-xl border border-border bg-card-bg p-6 space-y-4">
              <div className="flex gap-2">
                <div className="h-10 flex-1 animate-pulse rounded-lg bg-badge-bg/50" />
                <div className="h-10 flex-1 animate-pulse rounded-lg bg-badge-bg/50" />
              </div>
              <div className="space-y-3">
                <div className="h-12 w-full animate-pulse rounded-lg bg-badge-bg/50" />
                <div className="h-12 w-full animate-pulse rounded-lg bg-badge-bg/50" />
              </div>
              <div className="h-12 w-full animate-pulse rounded-lg bg-badge-bg/50" />
            </div>
          </div>
        </div>

        {/* Right side: Trade Widget skeleton */}
        <div className="hidden lg:block w-full lg:w-[340px] shrink-0">
          <div className="lg:sticky lg:top-8">
            <div className="rounded-xl border border-border bg-card-bg p-6 space-y-4">
              {/* Tab buttons */}
              <div className="flex gap-2">
                <div className="h-10 flex-1 animate-pulse rounded-lg bg-badge-bg/50" />
                <div className="h-10 flex-1 animate-pulse rounded-lg bg-badge-bg/50" />
              </div>
              {/* Input fields */}
              <div className="space-y-3">
                <div className="h-12 w-full animate-pulse rounded-lg bg-badge-bg/50" />
                <div className="h-12 w-full animate-pulse rounded-lg bg-badge-bg/50" />
              </div>
              {/* Summary lines */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between">
                  <div className="h-4 w-20 animate-pulse rounded bg-badge-bg/50" />
                  <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/50" />
                </div>
                <div className="flex justify-between">
                  <div className="h-4 w-24 animate-pulse rounded bg-badge-bg/50" />
                  <div className="h-4 w-12 animate-pulse rounded bg-badge-bg/50" />
                </div>
              </div>
              {/* Action button */}
              <div className="h-12 w-full animate-pulse rounded-lg bg-badge-bg/50" />
            </div>
          </div>
        </div>
      </div>

      {/* About section skeleton */}
      <div className="mt-10 space-y-10">
        {/* About */}
        <section>
          <div className="h-6 w-20 animate-pulse rounded bg-badge-bg/50 mb-1" />
          <div className="border-t border-border mb-4" />

          {/* Description skeleton */}
          <div className="space-y-2 mb-6">
            <div className="h-4 w-full animate-pulse rounded bg-badge-bg/50" />
            <div className="h-4 w-full animate-pulse rounded bg-badge-bg/50" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-badge-bg/50" />
          </div>

          {/* Company info grid skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/50 mb-1" />
                <div className="h-4 w-24 animate-pulse rounded bg-badge-bg/30" />
              </div>
            ))}
          </div>

          {/* Key facts grid skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-6 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="h-4 w-20 animate-pulse rounded bg-badge-bg/50 mb-1" />
                <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/30" />
              </div>
            ))}
          </div>
        </section>

        {/* Funding History skeleton */}
        <section>
          <div className="h-6 w-36 animate-pulse rounded bg-badge-bg/50 mb-1" />
          <div className="border-t border-border mb-4" />

          <div className="rounded-xl border border-border overflow-hidden">
            {/* Table header */}
            <div className="bg-badge-bg/50 border-b border-border px-4 py-2.5 flex">
              <div className="h-3 w-16 animate-pulse rounded bg-badge-bg/70 flex-1" />
              <div className="h-3 w-12 animate-pulse rounded bg-badge-bg/70 flex-1" />
              <div className="h-3 w-24 animate-pulse rounded bg-badge-bg/70 flex-1 text-right" />
              <div className="h-3 w-24 animate-pulse rounded bg-badge-bg/70 flex-1 text-right hidden md:block" />
              <div className="h-3 w-20 animate-pulse rounded bg-badge-bg/70 flex-1 text-right hidden lg:block" />
            </div>
            {/* Table rows */}
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="border-b border-border last:border-0 px-4 py-2.5 flex items-center"
              >
                <div className="h-4 w-20 animate-pulse rounded bg-badge-bg/50 flex-1" />
                <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/30 flex-1" />
                <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/30 flex-1 ml-auto" />
                <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/30 flex-1 ml-auto hidden md:block" />
                <div className="h-4 w-14 animate-pulse rounded bg-badge-bg/30 flex-1 ml-auto hidden lg:block" />
              </div>
            ))}
          </div>
        </section>

        {/* News skeleton */}
        <section>
          <div className="h-6 w-32 animate-pulse rounded bg-badge-bg/50 mb-1" />
          <div className="border-t border-border mb-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card-bg p-4 space-y-3"
              >
                <div className="h-4 w-3/4 animate-pulse rounded bg-badge-bg/50" />
                <div className="h-4 w-full animate-pulse rounded bg-badge-bg/30" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-badge-bg/30" />
                <div className="flex gap-2 pt-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-badge-bg/30" />
                  <div className="h-3 w-16 animate-pulse rounded bg-badge-bg/30" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Products skeleton */}
        <section>
          <div className="h-6 w-24 animate-pulse rounded bg-badge-bg/50 mb-1" />
          <div className="border-t border-border mb-4" />

          <div className="flex gap-2 md:gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-10 w-24 animate-pulse rounded-lg bg-badge-bg/50 flex-shrink-0"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
