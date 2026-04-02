export default function PredictionsLoading() {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Title + description */}
      <div className="h-8 w-64 animate-pulse rounded bg-badge-bg/50" />
      <div className="mt-2 h-5 w-full max-w-xl animate-pulse rounded bg-badge-bg/30" />

      {/* Summary Stats - 3 cards */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-md border border-border bg-muted/30 px-4 py-3"
          >
            <div className="h-4 w-20 animate-pulse rounded bg-badge-bg/50" />
            <div className="mt-2 h-6 w-12 animate-pulse rounded bg-badge-bg/50" />
          </div>
        ))}
      </div>

      {/* User Positions Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-28 animate-pulse rounded bg-badge-bg/50" />
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="mx-auto h-4 w-48 animate-pulse rounded bg-badge-bg/30" />
        </div>
      </div>

      {/* IPO Valuation Cards */}
      <div className="mt-6 space-y-6">
        {[1, 2, 3].map((cardIndex) => (
          <div
            key={cardIndex}
            className="rounded-lg border border-border bg-background overflow-hidden"
          >
            {/* Card Header */}
            <div className="flex items-center px-4 py-3 border-b border-border bg-muted/20">
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="h-10 w-10 animate-pulse rounded-full bg-badge-bg/50" />
                <div>
                  <div className="h-5 w-32 animate-pulse rounded bg-badge-bg/50" />
                  <div className="mt-1 h-3 w-28 animate-pulse rounded bg-badge-bg/30" />
                </div>
              </div>
              <div className="flex-1 flex items-center justify-end gap-3">
                <div className="h-9 w-24 animate-pulse rounded-full bg-badge-bg/50" />
                <div className="h-9 w-24 animate-pulse rounded-full bg-badge-bg/50" />
              </div>
            </div>

            {/* Valuation Summary */}
            <div className="px-4 py-3 flex flex-wrap items-start gap-8 border-b border-border bg-muted/10">
              <div>
                <div className="h-3 w-28 animate-pulse rounded bg-badge-bg/30" />
                <div className="mt-1 h-6 w-20 animate-pulse rounded bg-badge-bg/50" />
                <div className="mt-1 h-3 w-32 animate-pulse rounded bg-badge-bg/20" />
              </div>
              <div>
                <div className="h-3 w-28 animate-pulse rounded bg-badge-bg/30" />
                <div className="mt-1 h-6 w-20 animate-pulse rounded bg-badge-bg/50" />
                <div className="mt-1 h-3 w-24 animate-pulse rounded bg-badge-bg/20" />
              </div>
              <div>
                <div className="h-3 w-28 animate-pulse rounded bg-badge-bg/30" />
                <div className="mt-1 h-6 w-12 animate-pulse rounded bg-badge-bg/50" />
                <div className="mt-1 h-3 w-0 animate-pulse rounded bg-badge-bg/20" />
              </div>
            </div>

            {/* Valuation Bands */}
            <div className="px-4 py-3">
              <div className="h-3 w-48 animate-pulse rounded bg-badge-bg/30 mb-3" />

              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((bandIndex) => (
                  <div key={bandIndex} className="flex items-center gap-3 py-1">
                    <div className="w-[7rem] h-4 animate-pulse rounded bg-badge-bg/50 shrink-0" />
                    <div className="flex-1 h-6 animate-pulse rounded bg-badge-bg/30" style={{ width: `${70 - bandIndex * 10}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer text */}
      <div className="mt-6 mx-auto h-3 w-72 animate-pulse rounded bg-badge-bg/20" />
    </div>
  );
}
