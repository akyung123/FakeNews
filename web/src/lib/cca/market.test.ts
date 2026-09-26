import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { CCA_COPY } from "./copy";
import {
  clearingPricePoints,
  loadMarketSnapshots,
  marketPriceOf,
  POOL_PRICE_LABEL,
  type MarketReadClient,
} from "./loadAuction";
import { Q96 } from "./config";
import { q96ToWeiPerToken } from "./price";

const TOKEN = "0xaaaa00000000000000000000000000000000aaaa" as Address;
const AUCTION = "0xa0a0000000000000000000000000000000000a0a" as Address;
const HOOK = "0x1111111111111111111111111111111111110000" as Address;
const GWEI_Q96 = (10n ** 9n * Q96) / 10n ** 18n;
/** Q96 → wei rounds down, so compare against the same conversion. */
const GWEI = q96ToWeiPerToken(GWEI_Q96);

function lens(opts: { raised: bigint; graduated: boolean }) {
  return {
    checkpoint: {
      clearingPrice: GWEI_Q96,
      currencyRaisedAtClearingPriceQ96X7: 0n,
      cumulativeMpsPerPrice: 0n,
      cumulativeMps: 0,
      prev: 0n,
      next: 0n,
    },
    currencyRaised: opts.raised,
    totalCleared: 0n,
    isGraduated: opts.graduated,
  };
}

function client(opts: { block: bigint; end: bigint; sqrt?: bigint; graduated?: boolean }) {
  const getBlockNumber = vi.fn(async () => opts.block);
  const c = {
    getBlockNumber,
    simulateContract: vi.fn(async () => ({
      result: lens({ raised: opts.graduated ? 3n * 10n ** 16n : 0n, graduated: Boolean(opts.graduated) }),
    })),
    readContract: vi.fn(async (req: { functionName: string }) => {
      switch (req.functionName) {
        case "startBlock":
          return 100n;
        case "endBlock":
          return opts.end;
        case "lastCheckpointedBlock":
          return opts.end;
        case "totalSupply":
          return 10n ** 27n;
        case "getSlot0":
          return [opts.sqrt ?? 0n, 0, 0, 0];
        default:
          throw new Error(req.functionName);
      }
    }),
    getContractEvents: vi.fn(async () => [
      { args: { blockNumber: 101n, clearingPriceQ96: GWEI_Q96 } },
      { args: { blockNumber: 110n, clearingPriceQ96: GWEI_Q96 * 2n } },
    ]),
  };
  return { c, getBlockNumber, typed: c as unknown as MarketReadClient };
}

describe("market snapshots", () => {
  it("labels the price by stage", () => {
    expect(marketPriceOf({ status: "live", clearingPriceQ96: GWEI_Q96 })).toEqual({
      priceLabel: CCA_COPY.currentClearingPrice,
      priceWei: GWEI,
    });
    expect(marketPriceOf({ status: "graduated", clearingPriceQ96: GWEI_Q96 }).priceLabel).toBe(
      CCA_COPY.finalClearingPrice,
    );
    const pool = marketPriceOf({ status: "pool_open", clearingPriceQ96: GWEI_Q96, sqrtPriceX96: Q96 });
    expect(pool).toEqual({ priceLabel: POOL_PRICE_LABEL, priceWei: 10n ** 18n });
  });

  it("reads a live auction with one block number for the whole list", async () => {
    const { typed, getBlockNumber } = client({ block: 120n, end: 200n });
    const out = await loadMarketSnapshots(
      [
        { token: TOKEN, auction: AUCTION },
        { token: HOOK, auction: AUCTION },
      ],
      { client: typed, hook: HOOK },
    );
    const snap = out.get(TOKEN)!;
    expect(snap.status).toBe("live");
    expect(snap.statusVars).toEqual({ blocks: 80 });
    expect(snap.priceLabel).toBe(CCA_COPY.currentClearingPrice);
    expect(snap.priceWei).toBe(GWEI);
    expect(snap.history).toEqual([]);
    expect(getBlockNumber).toHaveBeenCalledTimes(1);
  });

  it("switches to the pool price once the market is open, with clearing history for the chart", async () => {
    const { typed } = client({ block: 300n, end: 200n, sqrt: Q96, graduated: true });
    const out = await loadMarketSnapshots([{ token: TOKEN, auction: AUCTION }], {
      client: typed,
      hook: HOOK,
      history: true,
      now: () => 1_000_000,
    });
    const snap = out.get(TOKEN)!;
    expect(snap.status).toBe("pool_open");
    expect(snap.priceLabel).toBe(POOL_PRICE_LABEL);
    expect(snap.priceWei).toBe(10n ** 18n);
    expect(snap.history.map((p) => p.wei)).toEqual([GWEI, q96ToWeiPerToken(GWEI_Q96 * 2n), 10n ** 18n]);
  });

  it("orders clearing-price points by time and skips malformed logs", () => {
    const points = clearingPricePoints(
      [{ args: { blockNumber: 10n, clearingPriceQ96: GWEI_Q96 } }, { args: {} }, { nope: true }],
      12n,
      1_000,
    );
    expect(points).toEqual([{ at: 1_000 - 2 * 12, wei: GWEI }]);
  });
});
