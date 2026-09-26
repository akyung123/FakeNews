/**
 * CCA auction log queries.
 *
 * fromBlock is always set. A configured `VITE_LAUNCHPAD_DEPLOY_BLOCK` is used
 * as-is (via main's `launchedFromBlock`). When that env is unset, the window
 * is latest − 50_000, never genesis. If the auction `startBlock` is known,
 * the later of the two is used.
 *
 * `fetchCcaEventLogs` splits the range into chunks of at most 50_000 blocks.
 *
 * Events verified in Uniswap/continuous-clearing-auction v2.1.0
 * (commit a56d42231e7bf048136d9d88fa61e8518c10c5ff):
 *   BidSubmitted(uint256 indexed id, address indexed owner, uint256 priceQ96, uint128 amount)
 *   BidExited(uint256 indexed bidId, address indexed owner, uint256 tokensFilled, uint256 currencyRefunded)
 *   TokensClaimed(uint256 indexed bidId, address indexed owner, uint256 tokensFilled)
 */
import type { Address } from "viem";
import { LAUNCHED_LOOKBACK_BLOCKS, launchedFromBlock } from "../launchpad";
import { ccaAbi } from "./abi/cca";

export type CcaAuctionEvent = "BidSubmitted" | "BidExited" | "TokensClaimed";

export const CCA_LOG_CHUNK_BLOCKS = LAUNCHED_LOOKBACK_BLOCKS;

export function parseCcaDeployBlock(
  value: string | undefined = import.meta.env.VITE_LAUNCHPAD_DEPLOY_BLOCK,
): bigint | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !/^[0-9]+$/.test(trimmed)) return undefined;
  return BigInt(trimmed);
}

/**
 * fromBlock for CCA event logs.
 * Deploy block when the env is a decimal; otherwise latest − 50_000 (clamp 0).
 * When `auctionStartBlock` is known, use the later of the two.
 */
export function ccaLogsFromBlock(
  value: string | undefined = import.meta.env.VITE_LAUNCHPAD_DEPLOY_BLOCK,
  latestBlock = 0n,
  auctionStartBlock?: bigint,
): bigint {
  const fromDeployOrLookback = launchedFromBlock(parseCcaDeployBlock(value), latestBlock);
  if (auctionStartBlock === undefined) return fromDeployOrLookback;
  return fromDeployOrLookback > auctionStartBlock ? fromDeployOrLookback : auctionStartBlock;
}

/** Inclusive [fromBlock, toBlock] slices of at most `CCA_LOG_CHUNK_BLOCKS`. */
export function ccaLogChunks(
  fromBlock: bigint,
  toBlock: bigint,
  size: bigint = CCA_LOG_CHUNK_BLOCKS,
): { fromBlock: bigint; toBlock: bigint }[] {
  if (fromBlock > toBlock || size <= 0n) return [];
  const chunks: { fromBlock: bigint; toBlock: bigint }[] = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + size - 1n;
    const to = end < toBlock ? end : toBlock;
    chunks.push({ fromBlock: start, toBlock: to });
    start = to + 1n;
  }
  return chunks;
}

export function ccaEventLogsQuery(
  auction: Address,
  eventName: CcaAuctionEvent,
  toBlock: bigint,
  fromBlock: bigint,
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
  fromBlock: bigint,
) {
  return ccaEventLogsQuery(auction, "BidSubmitted", toBlock, fromBlock);
}

export function bidExitedLogsQuery(
  auction: Address,
  toBlock: bigint,
  fromBlock: bigint,
) {
  return ccaEventLogsQuery(auction, "BidExited", toBlock, fromBlock);
}

export function tokensClaimedLogsQuery(
  auction: Address,
  toBlock: bigint,
  fromBlock: bigint,
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
  fromBlock?: bigint,
  auctionStartBlock?: bigint,
): Promise<unknown[]> {
  const toBlock = await client.getBlockNumber();
  const rangeStart =
    fromBlock === undefined
      ? ccaLogsFromBlock(undefined, toBlock, auctionStartBlock)
      : auctionStartBlock !== undefined && auctionStartBlock > fromBlock
        ? auctionStartBlock
        : fromBlock;
  const out: unknown[] = [];
  for (const chunk of ccaLogChunks(rangeStart, toBlock)) {
    const part = await client.getContractEvents(
      ccaEventLogsQuery(auction, eventName, chunk.toBlock, chunk.fromBlock),
    );
    if (Array.isArray(part)) out.push(...part);
    else out.push(part);
  }
  return out;
}
