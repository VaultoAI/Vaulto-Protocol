"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {!connected ? (
              <button
                onClick={openConnectModal}
                type="button"
                className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100"
              >
                Connect Wallet
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                type="button"
                className="rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800"
              >
                Wrong network
              </button>
            ) : (
              <button
                onClick={openAccountModal}
                type="button"
                className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black shadow-sm ring-1 ring-black/10 transition hover:bg-gray-50 dark:bg-white dark:text-black dark:ring-white/20 dark:hover:bg-gray-100"
              >
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
