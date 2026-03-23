import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { mainnet } from "viem/chains";

const mainnetRpc =
  process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL ?? "https://eth.llamarpc.com";

export const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(mainnetRpc),
  },
});
