import { http, createConfig, injected } from "wagmi";
import { sepolia } from "wagmi/chains";
import { walletConnect } from "wagmi/connectors";
import { SEPOLIA_CHAIN_ID, webEnv } from "./env";

const connectors = [
  injected(),
  ...(webEnv.walletConnectProjectId
    ? [walletConnect({ projectId: webEnv.walletConnectProjectId })]
    : []),
];

/** Ethereum Sepolia only (chainId 11155111). RPC comes from VITE_RPC_URL when set. */
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http(webEnv.rpcUrl),
  },
});

if (sepolia.id !== SEPOLIA_CHAIN_ID) {
  throw new Error("wagmi sepolia.id must stay 11155111");
}

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
