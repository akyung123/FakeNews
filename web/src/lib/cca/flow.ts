/**
 * Canonical four-step fork sequence — INTERFACE_CCA.md §8
 * (PR #40 head b02a445, source PR #41 `_runHappyPath` at d84aed4).
 *
 * Create → 5-arg bid → settle/claim → migrate at end+1 → swap.
 */
import { V4_SWAP_COMMAND } from "./abi/universalRouter";
import { CCA_CONFIG, FIRST_BID_ID, auctionClaimBlock, auctionEndBlock, auctionMigrationBlock } from "./config";

export const CCA_FORK_PIN_BLOCK = CCA_CONFIG.sepoliaForkBlock;

export const CCA_FORK_STEPS = [
  {
    id: 1 as const,
    name: "create",
    calls: ["initializeDistribution"] as const,
  },
  {
    id: 2 as const,
    name: "bid",
    functionName: "submitBid" as const,
    arity: 5 as const,
    firstBidId: FIRST_BID_ID,
  },
  {
    id: 3 as const,
    name: "settle",
    calls: ["checkpoint", "exitBid", "claimTokens", "migrate"] as const,
  },
  {
    id: 4 as const,
    name: "swap",
    // Universal Router 2.1.2 execute, commands = V4_SWAP (INTERFACE_CCA 4.7).
    encoding: "universalRouter.execute" as const,
    command: V4_SWAP_COMMAND,
  },
] as const;

export function forkHappyPathSchedule(startBlock: bigint, n = CCA_CONFIG.auctionBlocks) {
  return {
    startBlock,
    endBlock: auctionEndBlock(startBlock, n),
    claimBlock: auctionClaimBlock(startBlock, n),
    migrationBlock: auctionMigrationBlock(startBlock, n),
    submitBidArity: 5 as const,
    firstBidId: FIRST_BID_ID,
    swapEncoding: "universalRouter.execute" as const,
  };
}
