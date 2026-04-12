import { ProvidersMinimal } from "@/components/ProvidersMinimal";

/**
 * Public layout for waitlist pages.
 * Uses minimal providers (no Web3 stack) for faster initial load.
 * Always displays in light mode.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProvidersMinimal>
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
      </div>
    </ProvidersMinimal>
  );
}
