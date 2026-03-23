import type { PrivyClientConfig } from "@privy-io/react-auth";

export const privyConfig: PrivyClientConfig = {
  appearance: {
    theme: "light",
    accentColor: "#0a0a0a",
    showWalletLoginFirst: true,
  },
  loginMethods: ["wallet", "email", "google"],
  embeddedWallets: {
    ethereum: {
      createOnLogin: "users-without-wallets",
    },
  },
};
