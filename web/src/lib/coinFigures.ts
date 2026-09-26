/**
 * The figures a coin card or coin page shows, as wei. Chain rows carry exact
 * bigint reads; demo rows only have the float store, which is converted once.
 */
import { GRADUATION_ETH_WEI } from "./cca/config";
import { price as curvePrice, progress as curveProgress } from "./curve";
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
