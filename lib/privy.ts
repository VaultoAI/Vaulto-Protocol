import type { PrivyClientConfig } from "@privy-io/react-auth";
import { polygon } from "viem/chains";

export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: "light",
    accentColor: "#0a0a0a",
    showWalletLoginFirst: true,
  },
  loginMethods: ["wallet", "email", "google"],
  embeddedWallets: {
    ethereum: {
      // Create embedded wallet for ALL users (trading wallet)
      createOnLogin: "all-users",
    },
  },
  // Default chain for smart wallets on Polygon
  defaultChain: polygon,
  supportedChains: [polygon],
};

// Smart wallet configuration for Polygon
// paymasterContext is used to pass metadata to the paymaster
export const smartWalletConfig = {
  paymasterContext: {
    // These are passed to the Privy paymaster
    // Sponsorship policy is configured in Privy dashboard
  },
};
