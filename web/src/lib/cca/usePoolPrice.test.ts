import { describe, expect, it } from "vitest";
import { appendPricePoint, POOL_PRICE_MAX_POINTS } from "./usePoolPrice";

const WEI = 10n ** 9n;

describe("pool price series", () => {
  it("keeps a new price", () => {
    const series = appendPricePoint([], { at: 100, wei: WEI });
    expect(series).toHaveLength(1);
  });

  it("does not repeat an unchanged price within the same block", () => {
    const first = appendPricePoint([], { at: 100, wei: WEI });
    const second = appendPricePoint(first, { at: 101, wei: WEI });
    expect(second).toBe(first);
  });

  it("samples an unchanged price again after a block has passed", () => {
    const first = appendPricePoint([], { at: 100, wei: WEI });
    const second = appendPricePoint(first, { at: 130, wei: WEI });
    expect(second).toHaveLength(2);
  });

  it("keeps a price move in the same block", () => {
    const first = appendPricePoint([], { at: 100, wei: WEI });
    const second = appendPricePoint(first, { at: 101, wei: WEI * 2n });
    expect(second).toHaveLength(2);
  });

  it("drops the oldest sample once the window is full", () => {
    let series = appendPricePoint([], { at: 0, wei: WEI });
    for (let i = 1; i <= POOL_PRICE_MAX_POINTS + 10; i += 1) {
      series = appendPricePoint(series, { at: i, wei: WEI + BigInt(i) });
    }
    expect(series).toHaveLength(POOL_PRICE_MAX_POINTS);
    expect(series[series.length - 1].wei).toBe(WEI + BigInt(POOL_PRICE_MAX_POINTS + 10));
  });
});
