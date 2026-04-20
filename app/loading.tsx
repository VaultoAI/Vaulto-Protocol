/* eslint-disable @next/next/no-img-element */

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        {/* Light logo (shown in dark mode) */}
        <img
          src="/vaulto-logo-light.png"
          alt="Vaulto"
          className="hidden h-8 w-auto dark:block"
        />
        {/* Dark logo (shown in light mode) */}
        <img
          src="/vaulto-logo-dark.png"
          alt="Vaulto"
          className="block h-8 w-auto dark:hidden"
        />
        <p className="text-sm text-muted-foreground">
          The future of private company investing.
        </p>
        <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full animate-pulse bg-foreground/20" />
        </div>
      </div>
    </div>
  );
}
