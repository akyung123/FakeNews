/**
 * Read auction state through CCALens (`state`) plus auction start/end blocks.
 * Status, clearing price, raised vs 0.02 ETH, and blocks remaining are derived here.
 *
 * Schedule (PR #41): end = start + N, claim = end, migration = end + 1.
 * Open market is only enabled at block >= end + 1 and when graduated.
 */
import { CCA_SEPOLIA } from "./addresses";
import { ccaAbi } from "./abi/cca";
import { ccaLensAbi } from "./abi/ccaLens";
import { GRADUATION_ETH_WEI } from "./config";
import type { AuctionCopyStatus } from "./copy";
import type { Address } from "viem";

export type CcaCheckpoint = {
  clearingPrice: bigint;
  currencyRaisedAtClearingPriceQ96X7: bigint;
  cumulativeMpsPerPrice: bigint;
  cumulativeMps: number;
  prev: bigint;
  next: bigint;
};

export type CcaLensState = {
  checkpoint: CcaCheckpoint;
  currencyRaised: bigint;
  totalCleared: bigint;
  isGraduated: boolean;
};

/** INTERFACE_CCA §4.3 names. */
export type AuctionState = CcaLensState;
export type Checkpoint = CcaCheckpoint;

export type CcaBid = {
  startBlock: bigint;
  startCumulativeMps: number;
  exitedBlock: bigint;
  maxPrice: bigint;
  owner: Address;
  amountQ96: bigint;
  tokensFilled: bigint;
};

export type AuctionPhase = "not_started" | "live" | "ended_goal_reached" | "ended_goal_not_reached";

export type AuctionView = {
  phase: AuctionPhase;
  clearingPriceQ96: bigint;
  currencyRaised: bigint;
  graduationWei: bigint;
  goalReached: boolean;
  blocksRemaining: number;
  startBlock: bigint;
  endBlock: bigint;
  /** claim block = end */
  claimBlock: bigint;
  /** migration block = end + 1 */
  migrationBlock: bigint;
  isGraduated: boolean;
  /** Open market only when graduated and current block >= end + 1. */
  canOpenMarket: boolean;
};

export type AuctionActionVisibility = {
  claim: boolean;
  openMarket: boolean;
  exit: boolean;
};

/** Open market only at block >= end + 1 and when graduated. */
export function canOpenMarket(input: {
  isGraduated: boolean;
  endBlock: bigint;
  currentBlock: bigint;
}): boolean {
  return input.isGraduated && input.currentBlock >= input.endBlock + 1n;
}

/**
 * Hide claim and open-market when the goal was missed.
 * Exit stays available so every bid can be refunded in full.
 */
export function auctionActionVisibility(input: {
  phase: AuctionPhase;
  isGraduated: boolean;
  endBlock: bigint;
  currentBlock: bigint;
}): AuctionActionVisibility {
  if (input.phase === "ended_goal_not_reached") {
    return { claim: false, openMarket: false, exit: true };
  }
  if (input.phase === "ended_goal_reached") {
    return {
      claim: true,
      openMarket: canOpenMarket(input),
      exit: true,
    };
  }
  return { claim: false, openMarket: false, exit: false };
}

/**
 * Product rules when the auction ends below the graduation goal
 * (PR #41 fork: exitBid refunds all ETH, claimTokens reverts NotGraduated,
 * LBPStrategy.migrate never opens a pool).
 */
export function goalNotReachedEffects() {
  return {
    exitBidRefundsAllEth: true,
    claimTokensReverts: "NotGraduated" as const,
    poolOpens: false,
  };
}

export function ccaLensStateRequest(auction: Address, lens = CCA_SEPOLIA.ccaLens) {
  return {
    address: lens,
    abi: ccaLensAbi,
    functionName: "state" as const,
    args: [auction] as const,
  };
}

export function auctionScheduleRequest(auction: Address) {
  return {
    startBlock: {
      address: auction,
      abi: ccaAbi,
      functionName: "startBlock" as const,
      args: [] as const,
    },
    endBlock: {
      address: auction,
      abi: ccaAbi,
      functionName: "endBlock" as const,
      args: [] as const,
    },
    claimBlock: {
      address: auction,
      abi: ccaAbi,
      functionName: "claimBlock" as const,
      args: [] as const,
    },
    floorPrice: {
      address: auction,
      abi: ccaAbi,
      functionName: "floorPrice" as const,
      args: [] as const,
    },
    tickSpacing: {
      address: auction,
      abi: ccaAbi,
      functionName: "tickSpacing" as const,
      args: [] as const,
    },
    lastCheckpointedBlock: {
      address: auction,
      abi: ccaAbi,
      functionName: "lastCheckpointedBlock" as const,
      args: [] as const,
    },
    nextBidId: {
      address: auction,
      abi: ccaAbi,
      functionName: "nextBidId" as const,
      args: [] as const,
    },
  };
}

export function bidRead(auction: Address, bidId: bigint) {
  return {
    address: auction,
    abi: ccaAbi,
    functionName: "bids" as const,
    args: [bidId] as const,
  };
}

export function blocksRemaining(endBlock: bigint, currentBlock: bigint): number {
  if (currentBlock >= endBlock) return 0;
  const left = endBlock - currentBlock;
  return left > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(left);
}

export function isAuctionFinalized(lastCheckpointedBlock: bigint, endBlock: bigint): boolean {
  return lastCheckpointedBlock >= endBlock;
}

export function isAuctionSoldOut(totalCleared: bigint, totalSupply: bigint): boolean {
  return totalSupply > 0n && totalCleared >= totalSupply;
}

export function deriveAuctionCopyStatus(input: {
  view: AuctionView;
  soldOut?: boolean;
  finalized?: boolean;
  poolOpen?: boolean;
  marketFailed?: boolean;
}): AuctionCopyStatus {
  if (input.poolOpen) return "pool_open";
  if (input.marketFailed && input.view.goalReached) return "market_failed";
  if (input.view.phase === "not_started") return "not_started";
  if (input.view.phase === "live") return input.soldOut ? "sold_out" : "live";
  if (input.view.phase === "ended_goal_not_reached") return "failed";
  if (input.finalized === false) return "ended_not_finalized";
  return "graduated";
}

export function deriveAuctionView(input: {
  lens: CcaLensState;
  startBlock: bigint;
  endBlock: bigint;
  currentBlock: bigint;
}): AuctionView {
  const goalReached = input.lens.currencyRaised >= GRADUATION_ETH_WEI || input.lens.isGraduated;
  const remaining = blocksRemaining(input.endBlock, input.currentBlock);
  let phase: AuctionPhase;
  if (input.currentBlock < input.startBlock) phase = "not_started";
  else if (remaining > 0) phase = "live";
  else phase = goalReached ? "ended_goal_reached" : "ended_goal_not_reached";

  return {
    phase,
    clearingPriceQ96: input.lens.checkpoint.clearingPrice,
    currencyRaised: input.lens.currencyRaised,
    graduationWei: GRADUATION_ETH_WEI,
    goalReached,
    blocksRemaining: remaining,
    startBlock: input.startBlock,
    endBlock: input.endBlock,
    claimBlock: input.endBlock,
    migrationBlock: input.endBlock + 1n,
    isGraduated: input.lens.isGraduated,
    canOpenMarket: canOpenMarket({
      isGraduated: input.lens.isGraduated,
      endBlock: input.endBlock,
      currentBlock: input.currentBlock,
    }),
  };
}

export async function readAuctionLensState(
  client: { simulateContract: (request: ReturnType<typeof ccaLensStateRequest>) => Promise<{ result: CcaLensState }> },
  auction: Address,
  lens = CCA_SEPOLIA.ccaLens,
): Promise<CcaLensState> {
  const { result } = await client.simulateContract(ccaLensStateRequest(auction, lens));
  return result;
}

export async function readAuctionView(
  client: {
    simulateContract: (request: ReturnType<typeof ccaLensStateRequest>) => Promise<{ result: CcaLensState }>;
    readContract: (
      request:
        | ReturnType<typeof auctionScheduleRequest>["startBlock"]
        | ReturnType<typeof auctionScheduleRequest>["endBlock"],
    ) => Promise<bigint>;
    getBlockNumber: () => Promise<bigint>;
  },
  auction: Address,
  lens = CCA_SEPOLIA.ccaLens,
): Promise<AuctionView> {
  const schedule = auctionScheduleRequest(auction);
  const [lensState, startBlock, endBlock, currentBlock] = await Promise.all([
    readAuctionLensState(client, auction, lens),
    client.readContract(schedule.startBlock),
    client.readContract(schedule.endBlock),
    client.getBlockNumber(),
  ]);
  return deriveAuctionView({ lens: lensState, startBlock, endBlock, currentBlock });
}
