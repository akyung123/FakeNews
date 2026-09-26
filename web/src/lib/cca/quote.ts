/**
 * Swap quotes from the official v4 Quoter (`quoteExactInputSingle`) on our
 * pool key: native ETH / token, fee 1% (10000), tickSpacing 200, ProphecyHook.
 * No local guess: a failed quote reads "Quote unavailable" and the swap stays off.
 */
import { parseEther, type Address } from "viem";
import { getPublicClient } from "../rpc";
import { minOutForSlippage, quoteExactInRequest, type QuoteExactInInput } from "./pool";

/** 1% under the quote is the least the swap accepts (`amountOutMinimum`). */
export const SWAP_SLIPPAGE_BPS = 100n;

export type SwapQuote =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; amountOut: bigint; minOut: bigint }
  | { status: "unavailable" };

export type QuoteSimulate = (request: ReturnType<typeof quoteExactInRequest>) => Promise<{ result: unknown }>;

/** amountOut for an exact-in swap. Throws when the Quoter reverts or returns nothing. */
export async function quoteExactIn(
  input: QuoteExactInInput,
  simulate: QuoteSimulate = (request) => getPublicClient().simulateContract(request as never) as Promise<{ result: unknown }>,
): Promise<bigint> {
  const { result } = await simulate(quoteExactInRequest(input));
  const amountOut = Array.isArray(result) ? result[0] : undefined;
  if (typeof amountOut !== "bigint" || amountOut <= 0n) throw new Error("Quote unavailable");
  return amountOut;
}

/** The quote, plus the 1% floor the swap sends as `amountOutMinimum` (never 0 for a positive quote). */
export function quoteWithSlippage(amountOut: bigint, bps = SWAP_SLIPPAGE_BPS): SwapQuote {
  const floor = minOutForSlippage(amountOut, bps);
  return { status: "ok", amountOut, minOut: floor > 0n ? floor : 1n };
}

/** What the person typed, in wei / token units. null when it is not a positive number. */
export function parseSwapAmount(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d*\.?\d+$|^\d+\.$/.test(trimmed)) return null;
  try {
    const parsed = parseEther(trimmed.endsWith(".") ? `${trimmed}0` : trimmed);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export type SwapQuoteInput = {
  token: Address;
  hooks: Address;
  zeroForOne: boolean;
  amountIn: bigint;
};

