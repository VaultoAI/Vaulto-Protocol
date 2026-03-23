"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";

export function ConnectWalletButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const activeWallet = wallets[0];
  const displayAddress = activeWallet?.address;

  if (!ready) {
    return (
      <div aria-hidden style={{ opacity: 0, pointerEvents: "none", userSelect: "none" }}>
        <button type="button" className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100">
          Connect Wallet
        </button>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <button onClick={login} type="button" className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100">
        Connect Wallet
      </button>
    );
  }

  return (
    <button onClick={logout} type="button" className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100">
      {displayAddress ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}` : "Connected"}
    </button>
  );
}
