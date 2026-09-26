/**
 * Read auction state through CCALens (`state`) plus auction start/end blocks.
 * Status, clearing price, raised vs 0.02 ETH, and blocks remaining are derived here.
 */
import { CCA_SEPOLIA } from "./addresses";
import { ccaAbi } from "./abi/cca";
import { ccaLensAbi } from "./abi/ccaLens";
import { GRADUATION_ETH_WEI } from "./constants";
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
  isGraduated: boolean;
};

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
    isGraduated: input.lens.isGraduated,
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
