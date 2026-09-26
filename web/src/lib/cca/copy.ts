/**
 * Designer v1 auction copy. English only. No wording about returns or price predictions.
 * `{blocks}`, `{mm:ss}`, `{raised}`, `{amount}` are interpolated by the helpers below.
 */
import { formatEther } from "viem";
import { GRADUATION_ETH_WEI, SEPOLIA_BLOCK_SECONDS } from "./constants";

export const CCA_COPY = {
  auctionLive: "Auction live · ends in {blocks} blocks (~{mm:ss})",
  currentClearingPrice: "Current clearing price",
  finalClearingPrice: "Final clearing price",
  samePrice:
    "Everyone who gets tokens pays this same price per token.",
  raisedProgress: "{raised} of 0.02 ETH raised to open the market",
  budgetEth: "Budget (ETH)",
  maxPricePerToken: "Max price per token (ETH)",
  placeBid: "Place bid",
  bidHelp:
    "You never pay more than your max price. Any ETH not used comes back to you after the auction.",
  claimTokens: "Claim tokens",
  refundUnused: "Get back unused ETH ({amount} ETH)",
  openMarket: "Open market",
  openMarketHelp:
    "Moves the raised ETH and tokens into a Uniswap v4 pool. Anyone can do this once the auction ends and the goal is reached.",
  poolFeeSplit:
    "Pool fee 1%. Fees are split 24% to the prophet and 76% to the protocol.",
  goalNotReached: "Auction ended · goal not reached",
  /** TBD(INTERFACE_CCA): designer has not written the goal-not-reached sub-line. */
  goalNotReachedSub: "TBD(INTERFACE_CCA)",
} as const;

export function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function blocksToMmSs(blocks: number, secondsPerBlock = SEPOLIA_BLOCK_SECONDS): string {
  return formatMmSs(Math.max(0, blocks) * secondsPerBlock);
}

export function auctionLiveCopy(blocks: number, secondsPerBlock = SEPOLIA_BLOCK_SECONDS): string {
  return CCA_COPY.auctionLive
    .replace("{blocks}", String(Math.max(0, blocks)))
    .replace("{mm:ss}", blocksToMmSs(blocks, secondsPerBlock));
}

export function raisedProgressCopy(raisedWei: bigint): string {
  return CCA_COPY.raisedProgress.replace("{raised}", formatEther(raisedWei));
}

export function refundUnusedCopy(amountWei: bigint): string {
  return CCA_COPY.refundUnused.replace("{amount}", formatEther(amountWei));
}

export function graduationGoalWei(): bigint {
  return GRADUATION_ETH_WEI;
}
