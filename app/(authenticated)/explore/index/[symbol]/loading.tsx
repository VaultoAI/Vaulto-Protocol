export default function IndexDetailLoading() {
  return (
    <div>
      {/* Main content: Chart + Trade Widget */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left side: Index info + Chart */}
        <div className="flex-1 min-w-0">
          {/* Index header skeleton */}
          <div className="flex items-center gap-3 mb-2">
            {/* Holdings avatars skeleton */}
            <div className="flex items-center">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-8 animate-pulse rounded-full bg-badge-bg/50 border-2 border-background"
                  style={{ marginLeft: i === 1 ? 0 : -8 }}
                />
              ))}
            </div>
            <div className="h-7 w-12 animate-pulse rounded bg-badge-bg/50" />
            <div className="h-6 w-20 animate-pulse rounded-md bg-badge-bg/50" />
          </div>

          {/* Full name skeleton */}
          <div className="h-5 w-56 animate-pulse rounded bg-badge-bg/50 mb-3" />

          {/* Price skeleton */}
          <div className="h-12 w-36 animate-pulse rounded bg-badge-bg/50 mb-1" />

          {/* Change indicator skeleton */}
          <div className="flex items-center gap-2 mt-1 mb-6">
            <div className="h-5 w-32 animate-pulse rounded bg-badge-bg/50" />
            <div className="h-5 w-12 animate-pulse rounded bg-badge-bg/50" />
          </div>

          {/* Chart skeleton */}
          <div className="w-full">
            {/* Chart area */}
            <div className="h-[340px] w-full animate-pulse rounded-lg bg-badge-bg/30 mb-3" />
            {/* Time range buttons */}
            <div className="flex gap-2 border-t border-border pt-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-12 animate-pulse rounded-lg bg-badge-bg/50"
                />
              ))}
            </div>
          </div>

          {/* About section skeleton */}
          <div className="mt-10">
            <div className="h-6 w-16 animate-pulse rounded bg-badge-bg/50 mb-1" />
            <div className="border-t border-border mb-4" />
            <div className="space-y-2 mb-6">
              <div className="h-4 w-full animate-pulse rounded bg-badge-bg/50" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-badge-bg/50" />
            </div>
            {/* Info grid skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/50 mb-1" />
                  <div className="h-4 w-24 animate-pulse rounded bg-badge-bg/30" />
                </div>
              ))}
            </div>
          </div>

          {/* Holdings section skeleton */}
          <div className="mt-10">
            <div className="h-6 w-20 animate-pulse rounded bg-badge-bg/50 mb-1" />
            <div className="border-t border-border mb-4" />
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Table header */}
              <div className="bg-badge-bg/50 border-b border-border px-4 py-2.5 flex">
                <div className="h-3 w-24 animate-pulse rounded bg-badge-bg/70 flex-1" />
                <div className="h-3 w-16 animate-pulse rounded bg-badge-bg/70 flex-1" />
                <div className="h-3 w-16 animate-pulse rounded bg-badge-bg/70 flex-1 text-right" />
                <div className="h-3 w-20 animate-pulse rounded bg-badge-bg/70 flex-1 text-right" />
              </div>
              {/* Table rows */}
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="border-b border-border last:border-0 px-4 py-3 flex items-center"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-badge-bg/50" />
                    <div className="h-4 w-24 animate-pulse rounded bg-badge-bg/50" />
                  </div>
                  <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/30 flex-1" />
                  <div className="h-4 w-16 animate-pulse rounded bg-badge-bg/30 flex-1 ml-auto" />
                  <div className="h-4 w-20 animate-pulse rounded bg-badge-bg/30 flex-1 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side: Trade Widget skeleton */}
        <div className="w-full lg:w-[340px] shrink-0">
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
              </div>
              {/* Action button */}
              <div className="h-12 w-full animate-pulse rounded-lg bg-badge-bg/50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
