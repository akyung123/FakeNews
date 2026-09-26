import { createConfig, injected } from "wagmi";
import { sepolia } from "wagmi/chains";
import { walletConnect } from "wagmi/connectors";
import { SEPOLIA_CHAIN_ID, webEnv } from "./env";
import { SEPOLIA_POLLING_MS, sepoliaTransport } from "./rpc";

const connectors = [
  injected(),
  ...(webEnv.walletConnectProjectId
    ? [walletConnect({ projectId: webEnv.walletConnectProjectId })]
    : []),
];

/** Ethereum Sepolia only (chainId 11155111). Same fallback transport as getPublicClient(). */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: sepoliaTransport(),
  },
  // Same read budget as getPublicClient(): reads in one tick share a multicall,
  // and watchers poll once per block.
  batch: { multicall: true },
  pollingInterval: SEPOLIA_POLLING_MS,
  cacheTime: SEPOLIA_POLLING_MS,
});

if (sepolia.id !== SEPOLIA_CHAIN_ID) {
  throw new Error("wagmi sepolia.id must stay 11155111");
}

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
