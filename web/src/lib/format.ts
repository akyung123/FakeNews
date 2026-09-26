/**
 * Every ETH, price and token figure on screen goes through this file.
 * Amounts stay bigint (wei / 18-decimal units) until the last step, so a
 * figure never picks up float noise such as 0.040000000000000001.
 */
import { formatEther, formatUnits, parseEther } from "viem";

const WEI_PER_ETH = 10n ** 18n;

/** Round a non-negative value to the nearest multiple of `unit` (half up). */
function roundTo(value: bigint, unit: bigint): bigint {
  if (unit <= 1n) return value;
  return ((value + unit / 2n) / unit) * unit;
}

/** The unit that keeps `sig` significant digits of `value`. */
function sigUnit(value: bigint, sig: number): bigint {
  const digits = value.toString().length;
  return digits > sig ? 10n ** BigInt(digits - sig) : 1n;
}

/**
 * Wei as an ETH number, no unit. 1 ETH or more: 4 decimals. Under 1 ETH:
 * 4 significant digits. Trailing zeros are dropped.
 * 999999999999999 wei → "0.001", 40000000000000001 wei → "0.04".
 */
export function formatEthAmount(wei: bigint): string {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  if (abs === 0n) return "0";
  const rounded = abs >= WEI_PER_ETH ? roundTo(abs, 10n ** 14n) : roundTo(abs, sigUnit(abs, 4));
  return `${negative ? "-" : ""}${formatEther(rounded)}`;
}

/** Wei as "0.001 ETH". */
export function formatEth(wei: bigint): string {
  return `${formatEthAmount(wei)} ETH`;
}

/**
 * Price of one whole token, in wei. Clearing price, final clearing price and
 * pool price all use this, so every price reads in the same unit and digits.
 */
export function formatPrice(weiPerToken: bigint): string {
  return `${formatEthAmount(weiPerToken)} ETH per token`;
}

const TOKEN_SUFFIXES = ["", "K", "M", "B"] as const;

/**
 * Token amount in base units (18 decimals by default), abbreviated with K / M / B.
 * 1 or more: up to 2 decimals. Under 1: 4 significant digits.
 */
export function formatTokenAmount(units: bigint, decimals = 18): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  if (abs === 0n) return "0";
  const sign = negative ? "-" : "";
  const one = 10n ** BigInt(decimals);
  if (abs < one) {
    return `${sign}${formatUnits(roundTo(abs, sigUnit(abs, 4)), decimals)}`;
  }
  let step = 0;
  while (step < TOKEN_SUFFIXES.length - 1 && abs >= one * 1000n ** BigInt(step + 1)) step++;
  for (;;) {
    const scale = decimals + 3 * step;
    const rounded = roundTo(abs, 10n ** BigInt(Math.max(0, scale - 2)));
    const bumps = step < TOKEN_SUFFIXES.length - 1 && rounded >= 10n ** BigInt(scale) * 1000n;
    if (!bumps) return `${sign}${formatUnits(rounded, scale)}${TOKEN_SUFFIXES[step]}`;
    step++;
  }
}

/** A float ETH figure (demo store, wallet balance) as wei. Non-finite or negative → 0. */
export function ethToWei(value: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return 0n;
  return parseEther(value.toFixed(18));
}

/** Demo-mode ETH figure (the demo store keeps floats). Same output as formatEth. */
export function eth(value: number): string {
  return formatEth(ethToWei(value));
}

/** Demo-mode token count (the demo store keeps floats). Same output as formatTokenAmount. */
export function tokens(value: number): string {
  return formatTokenAmount(ethToWei(value));
}

/** Demo-mode price per token (float ETH). Same output as formatPrice. */
export function pricePerToken(ethPerToken: number): string {
  return formatPrice(ethToWei(ethPerToken));
}

/** Raised over goal as 0…1, computed on bigint so 0.02 of 0.02 is exactly 1. */
export function raisedFraction(raisedWei: bigint, goalWei: bigint): number {
  if (goalWei <= 0n || raisedWei <= 0n) return 0;
  const capped = raisedWei >= goalWei ? goalWei : raisedWei;
  return Number((capped * 10_000n) / goalWei) / 10_000;
}

export function pct(change: number): string {
  const v = change * 100;
  const sign = v > 0 ? "+" : "";
  return `${sign}${Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)}%`;
}

export function trend(change: number): "up" | "down" | "flat" {
  if (change > 0.0005) return "up";
  if (change < -0.0005) return "down";
  return "flat";
}

/**
 * "5m ago", "3h ago", "2d ago". Empty string when the time is unknown, so the
 * caller can hide the line instead of showing a date from 1970.
 */
export function ago(at: number | null | undefined, now = Date.now()): string {
  if (at == null || !Number.isFinite(at) || at <= 0) return "";
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
