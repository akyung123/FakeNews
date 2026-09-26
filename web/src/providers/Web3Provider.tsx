import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { SEPOLIA_POLLING_MS } from "../lib/rpc";
import { wagmiConfig } from "../lib/wagmi";

/**
 * Chain data changes at most once per block. Treat a read as fresh for one
 * block, and do not re-read everything when the tab regains focus.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: SEPOLIA_POLLING_MS,
        refetchOnWindowFocus: false,
        refetchIntervalInBackground: false,
        retry: 2,
      },
    },
  });
}

const queryClient = createQueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
