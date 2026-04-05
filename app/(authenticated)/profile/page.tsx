import { DepositPageClient } from "@/components/deposit/DepositPageClient";

/**
 * Profile page - user account management.
 * Auth is handled by the (authenticated) layout.
 */
export default async function ProfilePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-6">
      <DepositPageClient />
    </div>
  );
}
