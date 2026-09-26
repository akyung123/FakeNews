/**
 * CCA bid prices are Q96 (Uniswap/continuous-clearing-auction FixedPoint96).
 * A user-facing "max ETH per token" is encoded as (weiPerToken * Q96) / 1e18.
 * Bid ticks must sit on `priceQ96 % tickSpacingQ96 == 0` (TickStorage._getTick).
 */
import { formatEther, parseEther } from "viem";
import { Q96, WAD } from "./constants";

export function ethPerTokenToQ96(ethPerToken: string): bigint {
  return weiPerTokenToQ96(parseEther(ethPerToken));
}

export function weiPerTokenToQ96(weiPerToken: bigint): bigint {
  if (weiPerToken <= 0n) {
    throw new Error("max price per token must be greater than zero");
  }
  return (weiPerToken * Q96) / WAD;
}

export function q96ToWeiPerToken(priceQ96: bigint): bigint {
  return (priceQ96 * WAD) / Q96;
}

export function q96ToEthPerToken(priceQ96: bigint): string {
  return formatEther(q96ToWeiPerToken(priceQ96));
}

/**
 * Snap a Q96 price down onto the auction tick grid.
 * Verified: TickStorage reverts TickPriceNotAtBoundary unless
 * `priceQ96 % TICK_SPACING_Q96 == 0`.
 */
export function alignPriceToTick(priceQ96: bigint, tickSpacingQ96: bigint): bigint {
  if (tickSpacingQ96 <= 0n) {
    throw new Error("tick spacing must be greater than zero");
  }
  const aligned = (priceQ96 / tickSpacingQ96) * tickSpacingQ96;
  if (aligned === 0n) return tickSpacingQ96;
  return aligned;
}

/** Bid amount is uint128 currency wei; ETH bids send the same value. */
export function budgetEthToAmount(budgetEth: string): bigint {
  const amount = parseEther(budgetEth);
  if (amount <= 0n) {
    throw new Error("budget must be greater than zero");
  }
  if (amount > 0xffffffffffffffffffffffffffffffffn) {
    throw new Error("budget exceeds uint128");
  }
  return amount;
}

/** Bid.amountQ96 is currency wei << 96 (ContinuousClearingAuction._submitBid). */
export function bidAmountQ96ToWei(amountQ96: bigint): bigint {
  return amountQ96 >> 96n;
}
