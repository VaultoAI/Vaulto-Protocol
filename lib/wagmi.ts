import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { mainnet } from "wagmi/chains";

const mainnetRpc =
  process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ?? "https://eth.llamarpc.com";

export const config = getDefaultConfig({
  appName: "Vaulto",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "vaulto-app",
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(mainnetRpc),
  },
  ssr: true,
});
