/**
 * pump.fun-style bonding curve with virtual reserves (see README).
 * Same math the ProphecyCoin contract will use; numbers are plain floats for the prototype.
 */
export const TOTAL_SUPPLY = 1_000_000_000;
export const CURVE_SUPPLY = 800_000_000;
const VIRTUAL_TOKEN = 1_073_000_000;
/** Demo scale: the curve sells out after roughly 2.9 ETH. */
const VIRTUAL_ETH = 1;
const K = VIRTUAL_ETH * VIRTUAL_TOKEN;

export type CurveState = { sold: number; ethRaised: number };

const reserves = (c: CurveState) => ({
  eth: VIRTUAL_ETH + c.ethRaised,
  token: VIRTUAL_TOKEN - c.sold,
});

/** ETH per token. */
export function price(c: CurveState): number {
  const r = reserves(c);
  return r.eth / r.token;
}

export function marketCap(c: CurveState): number {
  return price(c) * TOTAL_SUPPLY;
}

export function progress(c: CurveState): number {
  return Math.min(1, c.sold / CURVE_SUPPLY);
}

export function graduated(c: CurveState): boolean {
  return c.sold >= CURVE_SUPPLY - 1e-6;
}

export const LAUNCH_MARKET_CAP = marketCap({ sold: 0, ethRaised: 0 });

/** Tokens out for `ethIn`, capped at what is left on the curve (then less ETH is used). */
export function quoteBuy(c: CurveState, ethIn: number): { tokens: number; eth: number } {
  if (ethIn <= 0 || graduated(c)) return { tokens: 0, eth: 0 };
  const r = reserves(c);
  const left = CURVE_SUPPLY - c.sold;
  let tokens = r.token - K / (r.eth + ethIn);
  let eth = ethIn;
  if (tokens > left) {
    tokens = left;
    eth = K / (r.token - left) - r.eth;
  }
  return { tokens, eth };
}

export function quoteSell(c: CurveState, tokensIn: number): number {
  if (tokensIn <= 0 || graduated(c)) return 0;
  const r = reserves(c);
  return r.eth - K / (r.token + tokensIn);
}
