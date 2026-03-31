import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { polygon } from "viem/chains";

const polygonRpc =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org";

export const wagmiConfig = createConfig({
  chains: [polygon],
  transports: {
    [polygon.id]: http(polygonRpc),
  },
});
