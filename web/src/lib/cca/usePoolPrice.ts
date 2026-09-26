/**
 * Poll the v4 pool's slot0 and keep a rolling price series for the chart.
 * Missing launchpad or missing pool → the hook stays closed and the page
 * falls back to the local history (demo / no chain).
 */
import { useEffect, useRef, useState } from "react";
import { useReadContract } from "wagmi";
import type { Address } from "viem";
import { hasLaunchpad } from "../contracts";
import { SEPOLIA_BLOCK_SECONDS } from "./config";
import { ethPerTokenWei, isPoolOpen, poolIdForToken, slot0Request } from "./pool";

export type PricePoint = { at: number; wei: bigint };

export type PoolPriceState = {
  open: boolean;
  sqrtPriceX96?: bigint;
  tick?: number;
  priceWei: bigint;
  history: PricePoint[];
};

/** A block or two of samples is enough to see movement without a huge series. */
export const POOL_PRICE_MAX_POINTS = 120;

/** Keep the newest sample, drop the oldest once the window is full. */
export function appendPricePoint(
  history: readonly PricePoint[],
  point: PricePoint,
  max = POOL_PRICE_MAX_POINTS,
): PricePoint[] {
  const last = history[history.length - 1];
  if (last && last.wei === point.wei && point.at - last.at < SEPOLIA_BLOCK_SECONDS) {
    return history as PricePoint[];
  }
  const next = [...history, point];
  return next.length > max ? next.slice(next.length - max) : next;
}

export function usePoolPrice(
  token: Address | undefined,
  hooks: Address | undefined,
  intervalMs = SEPOLIA_BLOCK_SECONDS * 1000,
): PoolPriceState {
  const live = hasLaunchpad() && Boolean(token) && Boolean(hooks);
  const poolId = live && token && hooks ? poolIdForToken(token, hooks) : undefined;
  const [history, setHistory] = useState<PricePoint[]>([]);
  const seriesKey = useRef<string | undefined>(undefined);

  const { data } = useReadContract({
    ...(poolId ? slot0Request(poolId) : {}),
    query: { enabled: Boolean(poolId), refetchInterval: intervalMs },
  });

  const sqrtPriceX96 = Array.isArray(data) ? (data[0] as bigint | undefined) : undefined;
  const tick = Array.isArray(data) ? (data[1] as number | undefined) : undefined;
  const open = isPoolOpen(sqrtPriceX96);
  const priceWei = open && sqrtPriceX96 ? ethPerTokenWei(sqrtPriceX96) : 0n;

  // A different pool starts a different series.
  useEffect(() => {
    if (seriesKey.current === poolId) return;
    seriesKey.current = poolId;
    setHistory([]);
  }, [poolId]);

  useEffect(() => {
    if (!open || priceWei <= 0n) return;
    setHistory((prev) => appendPricePoint(prev, { at: Date.now() / 1000, wei: priceWei }));
  }, [open, priceWei]);

  return { open, sqrtPriceX96, tick, priceWei, history };
}
