import { ProvidersMinimal } from "@/components/ProvidersMinimal";
import { ThemeSwitch } from "@/components/ThemeSwitch";

/**
 * Public layout for waitlist pages.
 * Uses minimal providers (no Web3 stack) for faster initial load.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProvidersMinimal>
      <div className="flex min-h-screen flex-col">
        <header className="fixed right-0 top-0 z-20 flex items-center gap-3 pr-6 pt-6">
          <ThemeSwitch />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </ProvidersMinimal>
  );
}
