/**
 * CCA auction log queries.
 *
 * fromBlock is always set. It comes from `import.meta.env.VITE_LAUNCHPAD_DEPLOY_BLOCK`
 * (decimal bigint). Unset or invalid falls back to 0n — callers still pass an
 * explicit fromBlock, so the RPC is never asked to scan from genesis by default
 * (omitting fromBlock).
 *
 * Events verified in Uniswap/continuous-clearing-auction v2.1.0
 * (commit a56d42231e7bf048136d9d88fa61e8518c10c5ff):
 *   BidSubmitted(uint256 indexed id, address indexed owner, uint256 priceQ96, uint128 amount)
 *   BidExited(uint256 indexed bidId, address indexed owner, uint256 tokensFilled, uint256 currencyRefunded)
 *   TokensClaimed(uint256 indexed bidId, address indexed owner, uint256 tokensFilled)
 */
import type { Address } from "viem";
import { ccaAbi } from "./abi/cca";

export type CcaAuctionEvent = "BidSubmitted" | "BidExited" | "TokensClaimed";

/** Decimal deploy block, or 0n when VITE_LAUNCHPAD_DEPLOY_BLOCK is unset/invalid. */
export function ccaLogsFromBlock(
  value: string | undefined = import.meta.env.VITE_LAUNCHPAD_DEPLOY_BLOCK,
): bigint {
  const trimmed = value?.trim();
  if (!trimmed || !/^[0-9]+$/.test(trimmed)) return 0n;
  return BigInt(trimmed);
}

export function ccaEventLogsQuery(
  auction: Address,
  eventName: CcaAuctionEvent,
  toBlock: bigint,
  fromBlock: bigint = ccaLogsFromBlock(),
) {
  return {
    address: auction,
    abi: ccaAbi,
    eventName,
    fromBlock,
    toBlock,
  };
}

export function bidSubmittedLogsQuery(
  auction: Address,
  toBlock: bigint,
  fromBlock: bigint = ccaLogsFromBlock(),
) {
  return ccaEventLogsQuery(auction, "BidSubmitted", toBlock, fromBlock);
}

export function bidExitedLogsQuery(
  auction: Address,
  toBlock: bigint,
  fromBlock: bigint = ccaLogsFromBlock(),
) {
  return ccaEventLogsQuery(auction, "BidExited", toBlock, fromBlock);
}

export function tokensClaimedLogsQuery(
  auction: Address,
  toBlock: bigint,
  fromBlock: bigint = ccaLogsFromBlock(),
) {
  return ccaEventLogsQuery(auction, "TokensClaimed", toBlock, fromBlock);
}

export async function fetchCcaEventLogs(
  client: {
    getBlockNumber: () => Promise<bigint>;
    getContractEvents: (query: ReturnType<typeof ccaEventLogsQuery>) => Promise<unknown>;
  },
  auction: Address,
  eventName: CcaAuctionEvent,
  fromBlock: bigint = ccaLogsFromBlock(),
): Promise<unknown> {
  const toBlock = await client.getBlockNumber();
  return client.getContractEvents(ccaEventLogsQuery(auction, eventName, toBlock, fromBlock));
}
