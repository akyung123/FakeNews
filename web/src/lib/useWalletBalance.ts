import { erc20Abi, formatEther, type Address } from "viem";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { sepolia } from "wagmi/chains";

// Public RPC is rate-limited; a slow refresh keeps several viewers under the limit.
const REFRESH_MS = 30_000;

/** Connected wallet's Sepolia ETH. Undefined until a wallet connects and the read lands. */
export function useEthBalance(): number | undefined {
  const { address } = useAccount();
  const { data } = useBalance({
    address,
    chainId: sepolia.id,
    query: { enabled: Boolean(address), refetchInterval: REFRESH_MS },
  });
  return data ? Number(formatEther(data.value)) : undefined;
}

/** Connected wallet's balance of one prophecy token (18 decimals). */
export function useTokenBalance(token: Address | undefined): number | undefined {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: Boolean(address && token), refetchInterval: REFRESH_MS },
  });
  return data == null ? undefined : Number(formatEther(data));
}
