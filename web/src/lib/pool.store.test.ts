import { describe, expect, it } from "vitest";
import { LP_SUPPLY } from "./curve";
import { GRADUATION_ETH } from "./mock";
import { poolOf, poolPrice, quotePool, type Coin } from "./store";

function graduatedCoin(pool?: { eth: number; tokens: number }): Coin {
  return {
    id: "yolo",
    name: "Zero Tests",
    ticker: "YOLO",
    prophecy: "A team with zero tests ships on time",
    creator: "rin_park",
    createdAt: 0,
    history: [],
    sold: 793_100_000,
    ethRaised: GRADUATION_ETH,
    pool,
  };
}

describe("graduated pool", () => {
  it("starts with the LP reserve and the ETH the curve collected", () => {
    expect(poolOf(graduatedCoin())).toEqual({ eth: GRADUATION_ETH, tokens: LP_SUPPLY });
  });

  it("opens at the price the curve ended on", () => {
    // SPEC: the two differ by well under 0.1%.
    const gap = Math.abs(poolPrice(graduatedCoin()) - GRADUATION_ETH / LP_SUPPLY);
    expect(gap).toBeLessThan(1e-18);
  });

  it("charges the 1% pool fee on the way in", () => {
    const coin = graduatedCoin();
    const { eth, tokens } = poolOf(coin);
    const paid = 0.001;
    const { out } = quotePool(coin, "buy", paid);
    const noFee = (tokens * paid) / (eth + paid);
    expect(out).toBeLessThan(noFee);
    expect(out).toBeGreaterThan(noFee * 0.98);
  });

  it("moves the price up on a buy and down on a sell", () => {
    const coin = graduatedCoin();
    const bought = quotePool(coin, "buy", 0.001).pool;
    const sold = quotePool(coin, "sell", 1_000_000).pool;
    expect(bought.eth / bought.tokens).toBeGreaterThan(poolPrice(coin));
    expect(sold.eth / sold.tokens).toBeLessThan(poolPrice(coin));
  });

  it("never drains the pool, however large the sale", () => {
    const coin = graduatedCoin();
    const { out, pool } = quotePool(coin, "sell", LP_SUPPLY * 1_000);
    expect(out).toBeLessThan(GRADUATION_ETH);
    expect(pool.eth).toBeGreaterThan(0);
  });

  it("keeps trading from where the last trade left the pool", () => {
    const first = quotePool(graduatedCoin(), "buy", 0.001);
    const second = quotePool(graduatedCoin(first.pool), "buy", 0.001);
    // The second buy costs the same ETH and gets fewer tokens.
    expect(second.out).toBeLessThan(first.out);
  });

  it("quotes nothing for a non-positive amount", () => {
    expect(quotePool(graduatedCoin(), "buy", 0).out).toBe(0);
    expect(quotePool(graduatedCoin(), "sell", -1).out).toBe(0);
  });
});
