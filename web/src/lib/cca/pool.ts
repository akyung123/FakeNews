/**
 * Live v4 pool reads: current price for the chart, quotes for the swap box.
 *
 * Pool key is always native ETH as currency0 and the token as currency1, so
 * `sqrtPriceX96` squared is tokens per ETH and its inverse is ETH per token.
 */
import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";
import { CCA_SEPOLIA } from "./addresses";
import { POOL_FEE, POOL_TICK_SPACING, WAD } from "./config";
import { quoterAbi, stateViewAbi } from "./abi/v4Lens";
import { ethTokenPoolKey, type V4PoolKey } from "./swap";

const Q96 = 1n << 96n;
const Q192 = 1n << 192n;

/** v4 PoolId = keccak256 of the abi-encoded 5-field PoolKey. */
export function poolIdOf(key: V4PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint24" },
        { type: "int24" },
        { type: "address" },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

export function poolIdForToken(
  token: Address,
  hooks: Address,
  fee = POOL_FEE,
  tickSpacing = POOL_TICK_SPACING,
): Hex {
  return poolIdOf(ethTokenPoolKey(token, hooks, fee, tickSpacing));
}

export function slot0Request(poolId: Hex, stateView: Address = CCA_SEPOLIA.stateView) {
  return {
    address: stateView,
    abi: stateViewAbi,
    functionName: "getSlot0",
    args: [poolId],
  } as const;
}

export function poolLiquidityRequest(poolId: Hex, stateView: Address = CCA_SEPOLIA.stateView) {
  return {
    address: stateView,
    abi: stateViewAbi,
    functionName: "getLiquidity",
    args: [poolId],
  } as const;
}

/** A pool that was never initialized reports sqrtPriceX96 = 0. */
export function isPoolOpen(sqrtPriceX96: bigint | undefined): boolean {
  return typeof sqrtPriceX96 === "bigint" && sqrtPriceX96 > 0n;
}

/**
 * ETH per whole token, in wei. Both currencies are 18 decimals, so the raw
 * ratio is the human ratio: price = sqrtPriceX96^2 / 2^192 tokens per ETH.
 */
export function ethPerTokenWei(sqrtPriceX96: bigint): bigint {
  if (sqrtPriceX96 <= 0n) return 0n;
  return (WAD * Q192) / (sqrtPriceX96 * sqrtPriceX96);
}

/** Tokens per 1 ETH, in whole-token wei. The inverse of the line above. */
export function tokensPerEthWei(sqrtPriceX96: bigint): bigint {
  if (sqrtPriceX96 <= 0n) return 0n;
  return (WAD * sqrtPriceX96 * sqrtPriceX96) / Q192;
}

/** Market cap in wei for a fixed supply, at the pool's current price. */
export function poolMarketCapWei(sqrtPriceX96: bigint, totalSupplyWei: bigint): bigint {
  return (ethPerTokenWei(sqrtPriceX96) * totalSupplyWei) / WAD;
}

export type QuoteExactInInput = {
  token: Address;
  hooks: Address;
  zeroForOne: boolean;
  amountIn: bigint;
  fee?: number;
  tickSpacing?: number;
  hookData?: Hex;
  quoter?: Address;
};

/** Not `view`: call it through `simulateContract`, never `readContract`. */
export function quoteExactInRequest(input: QuoteExactInInput) {
  return {
    address: input.quoter ?? CCA_SEPOLIA.quoter,
    abi: quoterAbi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        poolKey: ethTokenPoolKey(input.token, input.hooks, input.fee, input.tickSpacing),
        zeroForOne: input.zeroForOne,
        exactAmount: input.amountIn,
        hookData: input.hookData ?? "0x",
      },
    ],
  } as const;
}

/**
 * Local fallback quote from the pool price, ignoring price impact.
 * Used to show an estimate when the Quoter is unreachable; the swap itself
 * still protects the trader with `amountOutMinimum`.
 */
export function quoteFromSpotPrice(
  sqrtPriceX96: bigint,
  zeroForOne: boolean,
  amountIn: bigint,
  feePips = POOL_FEE,
): bigint {
  if (sqrtPriceX96 <= 0n || amountIn <= 0n) return 0n;
  const afterFee = (amountIn * BigInt(1_000_000 - feePips)) / 1_000_000n;
  return zeroForOne
    ? (afterFee * tokensPerEthWei(sqrtPriceX96)) / WAD
    : (afterFee * ethPerTokenWei(sqrtPriceX96)) / WAD;
}

/** Slippage floor for `amountOutMinimum`. Basis points off the quote. */
export function minOutForSlippage(quoted: bigint, slippageBps: bigint): bigint {
  if (quoted <= 0n) return 0n;
  return (quoted * (10_000n - slippageBps)) / 10_000n;
}

export function swapDeadline(nowSeconds: number, windowSeconds = 600): bigint {
  return BigInt(Math.floor(nowSeconds) + windowSeconds);
}

export { Q96 as POOL_Q96 };
