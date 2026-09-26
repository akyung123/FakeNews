/**
 * The figures a coin card or coin page shows, as wei. Chain rows carry exact
 * bigint reads; demo rows only have the float store, which is converted once.
 */
import { GRADUATION_ETH_WEI } from "./cca/config";
import { graduated as curveGraduated, price as curvePrice, progress as curveProgress } from "./curve";
import { ethToWei, raisedFraction } from "./format";
import type { Coin } from "./store";

/** ETH raised so far, in wei. */
export function coinRaisedWei(coin: Coin): bigint {
  return coin.raisedWei ?? ethToWei(coin.ethRaised);
}

/** Price of one whole token, in wei: clearing or pool price on chain, the demo curve otherwise. */
export function coinPriceWei(coin: Coin): bigint {
  if (coin.priceWei != null) return coin.priceWei;
  if (coin.fromChain) return 0n;
  return ethToWei(curvePrice(coin));
}

/** Auction progress 0…1. Chain rows: raised over the 0.02 ETH goal, on bigint. */
export function coinProgress(coin: Coin): number {
  if (coin.raisedWei != null) return raisedFraction(coin.raisedWei, GRADUATION_ETH_WEI);
  return curveProgress(coin);
}

/** Market stage read from the chain. Null when the auction has not been read. */
export type CoinStage = "live" | "ended" | "market_open";

export function coinStage(coin: Coin): CoinStage | null {
  if (coin.marketOpen) return "market_open";
  if (coin.endBlock == null || coin.readBlock == null) return null;
  return coin.readBlock < coin.endBlock ? "live" : "ended";
}

export const STAGE_BADGE: Record<CoinStage, string> = {
  live: "Auction live",
  ended: "Ended",
  market_open: "Market open",
};

/** Newest launch first. Chain rows sort by Launched block, demo rows by creation time. */
export function newestFirst(coins: readonly Coin[]): Coin[] {
  return [...coins].sort(
    (a, b) => (b.launchedBlock ?? 0) - (a.launchedBlock ?? 0) || (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );
}

/**
 * The home page's featured card. Chain mode: the newest auction whose end
 * block has not passed; an ended auction is never featured. Demo mode keeps
 * the open auction closest to its goal.
 */
export function pickFeatured(coins: readonly Coin[], chain: boolean): Coin | null {
  if (chain) return newestFirst(coins.filter((c) => coinStage(c) === "live"))[0] ?? null;
  const open = coins.filter((c) => !curveGraduated(c));
  return [...open].sort((a, b) => coinProgress(b) - coinProgress(a))[0] ?? null;
}
