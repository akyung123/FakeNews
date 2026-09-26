/**
 * CCA bid prices are Q96 (Uniswap/continuous-clearing-auction FixedPoint96).
 * A user-facing "max ETH per token" is encoded as (weiPerToken * Q96) / 1e18.
 *
 * Valid ticks (PR #41 / AuctionBaseTest): `floor + k * tick`.
 * Round the user's max price DOWN onto that grid. Reject below the floor.
 */
import { formatEther, parseEther } from "viem";
import { CCA_CONFIG, Q96, WAD } from "./config";

export class MaxPriceBelowFloorError extends Error {
  readonly kind = "below_floor" as const;

  constructor() {
    super("Max price is below the auction floor.");
    this.name = "MaxPriceBelowFloorError";
  }
}

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
 * Snap a Q96 max price down to `floor + k * tick`.
 * Verified: TickStorage reverts TickPriceNotAtBoundary unless the price
 * sits on the grid; PR #41 bids use `maxPrice = floor + n * tick`.
 */
export function snapMaxPriceToTick(
  priceQ96: bigint,
  floorPriceQ96 = CCA_CONFIG.floorPriceQ96,
  tickSpacingQ96 = CCA_CONFIG.tickSpacingQ96,
): bigint {
  if (tickSpacingQ96 <= 0n) {
    throw new Error("tick spacing must be greater than zero");
  }
  if (priceQ96 < floorPriceQ96) {
    throw new MaxPriceBelowFloorError();
  }
  const k = (priceQ96 - floorPriceQ96) / tickSpacingQ96;
  return floorPriceQ96 + k * tickSpacingQ96;
}

/**
 * #41 / INTERFACE_CCA §4.4: `maxPrice = floor + n * tick`,
 * `prevTick = floor + (n - 1) * tick`. A bid sitting on the floor uses
 * the floor itself as the hint (same as the 4-arg overload).
 */
export function prevTickHintQ96(
  maxPriceQ96: bigint,
  floorPriceQ96 = CCA_CONFIG.floorPriceQ96,
  tickSpacingQ96 = CCA_CONFIG.tickSpacingQ96,
): bigint {
  const snapped = snapMaxPriceToTick(maxPriceQ96, floorPriceQ96, tickSpacingQ96);
  const n = (snapped - floorPriceQ96) / tickSpacingQ96;
  if (n === 0n) return floorPriceQ96;
  return floorPriceQ96 + (n - 1n) * tickSpacingQ96;
}

/** @deprecated Use snapMaxPriceToTick — same grid, with floor. */
export function alignPriceToTick(
  priceQ96: bigint,
  tickSpacingQ96 = CCA_CONFIG.tickSpacingQ96,
  floorPriceQ96 = CCA_CONFIG.floorPriceQ96,
): bigint {
  return snapMaxPriceToTick(priceQ96, floorPriceQ96, tickSpacingQ96);
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
