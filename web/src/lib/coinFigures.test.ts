import { describe, expect, it } from "vitest";
import { GRADUATION_ETH_WEI } from "./cca/config";
import { coinStage, newestFirst, pickFeatured, STAGE_BADGE } from "./coinFigures";
import type { Coin } from "./store";

function coin(id: string, extra: Partial<Coin> = {}): Coin {
  return {
    id,
    name: id,
    ticker: id.toUpperCase(),
    prophecy: "",
    creator: "ringo",
    createdAt: 0,
    history: [],
    sold: 0,
    ethRaised: 0,
    fromChain: true,
    ...extra,
  };
}

describe("coinStage", () => {
  it("is live before the end block, even once the goal is met", () => {
    expect(coinStage(coin("a", { endBlock: 200, readBlock: 100 }))).toBe("live");
    expect(coinStage(coin("a", { endBlock: 200, readBlock: 199, raisedWei: GRADUATION_ETH_WEI, complete: true }))).toBe(
      "live",
    );
  });

  it("is ended at the end block when the goal was missed", () => {
    expect(coinStage(coin("a", { endBlock: 100, readBlock: 100, raisedWei: GRADUATION_ETH_WEI - 1n }))).toBe("ended");
  });

  it("is market open once the goal is met at the end, or the pool is open", () => {
    expect(coinStage(coin("a", { endBlock: 90, readBlock: 100, raisedWei: GRADUATION_ETH_WEI }))).toBe("market_open");
    expect(coinStage(coin("a", { endBlock: 90, readBlock: 100, complete: true }))).toBe("market_open");
    expect(coinStage(coin("a", { marketOpen: true }))).toBe("market_open");
  });

  it("is unknown until the auction is read", () => {
    expect(coinStage(coin("a"))).toBeNull();
    expect(coinStage(coin("a", { endBlock: 200 }))).toBeNull();
  });

  it("reads demo rows off the demo curve", () => {
    expect(coinStage(coin("a", { fromChain: undefined }))).toBe("live");
    expect(coinStage(coin("a", { fromChain: undefined, complete: true }))).toBe("market_open");
  });

  it("names every stage in words", () => {
    expect(STAGE_BADGE).toEqual({ live: "Auction live", ended: "Ended · refunded", market_open: "Market open" });
  });
});

describe("newestFirst", () => {
  it("sorts chain rows by Launched block and demo rows by creation time", () => {
    const rows = [coin("a", { launchedBlock: 1 }), coin("c", { launchedBlock: 3 }), coin("b", { launchedBlock: 2 })];
    expect(newestFirst(rows).map((c) => c.id)).toEqual(["c", "b", "a"]);
    const demo = [coin("old", { createdAt: 1 }), coin("new", { createdAt: 2 })];
    expect(newestFirst(demo).map((c) => c.id)).toEqual(["new", "old"]);
  });
});

describe("pickFeatured", () => {
  const live = (id: string, block: number) => coin(id, { launchedBlock: block, endBlock: 200, readBlock: 100 });
  const ended = (id: string, block: number) =>
    coin(id, { launchedBlock: block, endBlock: 90, readBlock: 100, raisedWei: 1n });
  const market = (id: string, block: number, endBlock: number) =>
    coin(id, { launchedBlock: block, endBlock, readBlock: 100, raisedWei: GRADUATION_ETH_WEI, marketOpen: true });

  it("takes the newest live auction and skips ended ones", () => {
    expect(pickFeatured([live("a", 1), live("b", 2), ended("trump", 3)])?.id).toBe("b");
  });

  it("falls back to the market that opened last", () => {
    expect(pickFeatured([market("a", 2, 50), market("b", 1, 80), ended("trump", 3)])?.id).toBe("b");
  });

  it("is empty when nothing is live or open", () => {
    expect(pickFeatured([ended("trump", 1), coin("unread", { launchedBlock: 2 })])).toBeNull();
    expect(pickFeatured([])).toBeNull();
  });
});
