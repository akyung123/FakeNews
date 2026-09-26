/**
 * Bonding-curve quotes. Constants and rounding match SPEC.md exactly.
 *
 * tokensOut = vToken × ethNet / (vETH + ethNet)   (floor)
 * ethOut    = vETH × tokensIn / (vToken + tokensIn) (floor)
 *
 * Buy: take fee from incoming ETH first, then price the rest.
 * Sell: price first, then take fee from ethOut.
 * Fees round up. Buy cost rounds up. Sell payout rounds down.
 *
 * Do not precompute k and divide later — multiply first, divide once.
 */
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";

const WAD = 10n ** 18n;
const BPS_DENOM = 10_000n;

/** Human-unit supply used by the localStorage prototype screens. */
export const TOTAL_SUPPLY = 1_000_000_000;
export const CURVE_SUPPLY = 793_100_000;
export const LP_SUPPLY = 206_900_000;
export const VIRTUAL_TOKEN = 1_073_000_000;

export const TOTAL_SUPPLY_WEI = 1_000_000_000n * WAD;
export const CURVE_SUPPLY_WEI = 793_100_000n * WAD;
export const LP_SUPPLY_WEI = 206_900_000n * WAD;
export const VIRTUAL_TOKEN_WEI = 1_073_000_000n * WAD;
/** Unsellable virtual tokens. VIRTUAL_TOKEN − CURVE_SUPPLY. */
export const VIRTUAL_UNSELLABLE_WEI = 279_900_000n * WAD;
/** Demo scale: graduation at exactly 0.02 ETH. */
export const VIRTUAL_ETH_WEI = 7_058_378_514_689_194n;

export const FEE_BPS = 125n;
export const CREATOR_BPS = 30n;
export const PROTOCOL_BPS = 95n;

export type CurveState = { sold: number; ethRaised: number };

export type CurveWei = {
  /** Tokens already sold, 18 decimals. */
  sold: bigint;
  /** Real ETH sitting in the curve (not virtual, not fees). */
  realEth: bigint;
};

export type QuoteBuy = {
  tokensOut: bigint;
  /** ETH that enters the curve reserve after the fee. */
  ethNet: bigint;
  fee: bigint;
  /** Gross ETH consumed (ethNet + fee). Excess on a graduating buy is not included. */
  ethInUsed: bigint;
};

export type QuoteSell = {
  /** ETH the curve computes before the fee. Leaves the reserve. */
  ethOut: bigint;
  fee: bigint;
  /** ETH the seller receives. */
  ethPayout: bigint;
};

const ZERO_BUY: QuoteBuy = { tokensOut: 0n, ethNet: 0n, fee: 0n, ethInUsed: 0n };
const ZERO_SELL: QuoteSell = { ethOut: 0n, fee: 0n, ethPayout: 0n };

export function mulDiv(a: bigint, b: bigint, denom: bigint): bigint {
  return (a * b) / denom;
}

export function mulDivUp(a: bigint, b: bigint, denom: bigint): bigint {
  return (a * b + denom - 1n) / denom;
}

export function feeOnGross(gross: bigint, feeBps = FEE_BPS): bigint {
  if (gross === 0n || feeBps === 0n) return 0n;
  return mulDivUp(gross, feeBps, BPS_DENOM);
}

/** Smallest gross G such that G − feeOnGross(G) >= net. */
export function grossFromNet(net: bigint, feeBps = FEE_BPS): bigint {
  if (net === 0n) return 0n;
  if (feeBps === 0n) return net;
  const keepBps = BPS_DENOM - feeBps;
  let gross = mulDivUp(net, BPS_DENOM, keepBps);
  while (gross - feeOnGross(gross, feeBps) < net) gross += 1n;
  return gross;
}

export function reservesWei(c: CurveWei): { vEth: bigint; vToken: bigint; remaining: bigint } {
  return {
    vEth: VIRTUAL_ETH_WEI + c.realEth,
    vToken: VIRTUAL_TOKEN_WEI - c.sold,
    remaining: CURVE_SUPPLY_WEI - c.sold,
  };
}

export function isGraduatedWei(c: CurveWei): boolean {
  return c.sold >= CURVE_SUPPLY_WEI;
}

/**
 * Buy quote on explicit reserves. Used by SPEC toy vectors and the live curve.
 * `remaining` is how many tokens are still for sale (curve supply left).
 */
export function quoteBuyOn(args: {
  vEth: bigint;
  vToken: bigint;
  remaining: bigint;
  ethIn: bigint;
  feeBps?: bigint;
}): QuoteBuy {
  const feeBps = args.feeBps ?? FEE_BPS;
  const { vEth, vToken, remaining, ethIn } = args;
  if (ethIn <= 0n || remaining <= 0n || vEth <= 0n || vToken <= 0n) return ZERO_BUY;

  const fee = feeOnGross(ethIn, feeBps);
  if (fee >= ethIn) return ZERO_BUY;
  const ethNet = ethIn - fee;
  const tokensOut = (vToken * ethNet) / (vEth + ethNet);

  if (tokensOut <= remaining) {
    return { tokensOut, ethNet, fee, ethInUsed: ethIn };
  }

  // Last buy: fill only what is left. Cost rounds up; refund the rest.
  const denom = vToken - remaining;
  if (denom <= 0n) return ZERO_BUY;
  let fillNet = mulDivUp(remaining, vEth, denom);
  if (fillNet > ethNet) fillNet = ethNet;
  const ethInUsed = grossFromNet(fillNet, feeBps);
  const used = ethInUsed <= ethIn ? ethInUsed : ethIn;
  const usedFee = feeOnGross(used, feeBps);
  const usedNet = used - usedFee;
  return { tokensOut: remaining, ethNet: usedNet, fee: usedFee, ethInUsed: used };
}

/**
 * Sell quote on explicit reserves. `realEth` caps payout: a sell only pays real ETH.
 */
export function quoteSellOn(args: {
  vEth: bigint;
  vToken: bigint;
  tokensIn: bigint;
  realEth: bigint;
  feeBps?: bigint;
}): QuoteSell {
  const feeBps = args.feeBps ?? FEE_BPS;
  const { vEth, vToken, tokensIn, realEth } = args;
  if (tokensIn <= 0n || vEth <= 0n || vToken <= 0n || realEth <= 0n) return ZERO_SELL;

  let ethOut = (vEth * tokensIn) / (vToken + tokensIn);
  if (ethOut > realEth) ethOut = realEth;
  const fee = feeOnGross(ethOut, feeBps);
  const cappedFee = fee > ethOut ? ethOut : fee;
  return { ethOut, fee: cappedFee, ethPayout: ethOut - cappedFee };
}

export function quoteBuyWei(c: CurveWei, ethIn: bigint): QuoteBuy {
  if (ethIn <= 0n || isGraduatedWei(c)) return ZERO_BUY;
  const r = reservesWei(c);
  return quoteBuyOn({ ...r, ethIn });
}

export function quoteSellWei(c: CurveWei, tokensIn: bigint): QuoteSell {
  if (tokensIn <= 0n || isGraduatedWei(c) || c.sold <= 0n) return ZERO_SELL;
  const r = reservesWei(c);
  const inward = tokensIn > c.sold ? c.sold : tokensIn;
  return quoteSellOn({ vEth: r.vEth, vToken: r.vToken, tokensIn: inward, realEth: c.realEth });
}

export function toCurveWei(c: CurveState): CurveWei {
  return {
    sold: toWeiToken(c.sold),
    realEth: toWeiEth(c.ethRaised),
  };
}

function toWeiEth(eth: number): bigint {
  if (!Number.isFinite(eth) || eth <= 0) return 0n;
  return parseEther(eth.toFixed(18));
}

function toWeiToken(tokens: number): bigint {
  if (!Number.isFinite(tokens) || tokens <= 0) return 0n;
  return parseUnits(tokens.toFixed(8), 18);
}

function fromWeiEth(wei: bigint): number {
  return Number(formatEther(wei));
}

function fromWeiToken(wei: bigint): number {
  return Number(formatUnits(wei, 18));
}

function reserves(c: CurveState) {
  const w = reservesWei(toCurveWei(c));
  return { eth: fromWeiEth(w.vEth), token: fromWeiToken(w.vToken) };
}

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

export function graduated(c: CurveState & { complete?: boolean }): boolean {
  if (c.complete) return true;
  return c.sold >= CURVE_SUPPLY - 1e-6;
}

export const LAUNCH_MARKET_CAP = marketCap({ sold: 0, ethRaised: 0 });

export type PrototypeBuyQuote = {
  tokens: number;
  /** Gross ETH the buyer pays (after a possible graduation refund). */
  eth: number;
  ethNet: number;
  fee: number;
};

export type PrototypeSellQuote = {
  /** ETH the seller receives after the fee. */
  eth: number;
  ethOut: number;
  fee: number;
};

/** Tokens out for `ethIn`. Caps at remaining curve supply and refunds the rest. */
export function quoteBuy(c: CurveState, ethIn: number): PrototypeBuyQuote {
  const empty = { tokens: 0, eth: 0, ethNet: 0, fee: 0 };
  if (ethIn <= 0 || graduated(c)) return empty;
  const q = quoteBuyWei(toCurveWei(c), toWeiEth(ethIn));
  if (q.tokensOut <= 0n) return empty;
  return {
    tokens: fromWeiToken(q.tokensOut),
    eth: fromWeiEth(q.ethInUsed),
    ethNet: fromWeiEth(q.ethNet),
    fee: fromWeiEth(q.fee),
  };
}

export function quoteSell(c: CurveState, tokensIn: number): PrototypeSellQuote {
  const empty = { eth: 0, ethOut: 0, fee: 0 };
  if (tokensIn <= 0 || graduated(c)) return empty;
  const q = quoteSellWei(toCurveWei(c), toWeiToken(tokensIn));
  if (q.ethOut <= 0n) return empty;
  return {
    eth: fromWeiEth(q.ethPayout),
    ethOut: fromWeiEth(q.ethOut),
    fee: fromWeiEth(q.fee),
  };
}
