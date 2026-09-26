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

/**
 * Market stage. Chain rows: read from the auction's end block, the goal and
 * the pool. Null when the auction has not been read, so no stage is guessed.
 * Demo rows: from the demo curve.
 */
export type CoinStage = "live" | "ended" | "market_open";

export function coinStage(coin: Coin): CoinStage | null {
  if (coin.marketOpen) return "market_open";
  if (!coin.fromChain) return curveGraduated(coin) ? "market_open" : "live";
  if (coin.endBlock == null || coin.readBlock == null) return null;
  // A goal met before the end block still takes bids until the end block.
  if (coin.readBlock < coin.endBlock) return "live";
  return coin.complete || coinRaisedWei(coin) >= GRADUATION_ETH_WEI ? "market_open" : "ended";
}

/** Badge text. Every stage shows it, so the card never relies on color alone. */
export const STAGE_BADGE: Record<CoinStage, string> = {
  live: "Auction live",
  ended: "Ended · refunded",
  market_open: "Market open",
};

/** Card class for a stage; the colors live in styles.css. */
export const STAGE_CLASS: Record<CoinStage, string> = {
  live: "stage-live",
  ended: "stage-ended",
  market_open: "stage-market",
};

/** Newest launch first. Chain rows sort by Launched block, demo rows by creation time. */
export function newestFirst(coins: readonly Coin[]): Coin[] {
  return [...coins].sort(
    (a, b) => (b.launchedBlock ?? 0) - (a.launchedBlock ?? 0) || (b.createdAt ?? 0) - (a.createdAt ?? 0),
  );
}

/**
 * The home page's featured card: the newest auction still before its end
 * block. With none, the market that opened last. With neither, no card.
 */
export function pickFeatured(coins: readonly Coin[]): Coin | null {
  const newest = newestFirst(coins);
  const live = newest.find((c) => coinStage(c) === "live");
  if (live) return live;
  // A market opens right after its auction's end block, so the latest end block opened last.
  const markets = newest.filter((c) => coinStage(c) === "market_open");
  return markets.sort((a, b) => (b.endBlock ?? 0) - (a.endBlock ?? 0))[0] ?? null;
}
