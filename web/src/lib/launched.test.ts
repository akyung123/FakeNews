import { describe, expect, it, vi } from "vitest";
import { coinsFromLaunchedLogs, fillLaunchTimes, findLaunchedCoin, resetBlockTimesForTests } from "./launched";

const TOKEN = "0x1111111111111111111111111111111111111111" as const;

describe("Launched logs → card shape", () => {
  it("maps a log into the existing Coin fields", () => {
    const coins = coinsFromLaunchedLogs([
      {
        args: {
          token: TOKEN,
          prophet: "0x2222222222222222222222222222222222222222",
          prophetLabel: "ringo",
          slug: "lingo-2028",
        },
        blockNumber: 99n,
      },
    ]);
    expect(coins).toHaveLength(1);
    expect(coins[0]?.id).toBe(TOKEN);
    expect(coins[0]?.token).toBe(TOKEN);
    expect(coins[0]?.fromChain).toBe(true);
    expect(coins[0]?.ticker).toBe("LINGO-2028");
    expect(coins[0]?.creator).toBe("ringo");
    expect(coins[0]?.name).toContain("lingo-2028.ringo");
    expect(findLaunchedCoin(TOKEN, coins)?.ticker).toBe("LINGO-2028");
    expect(findLaunchedCoin("lingo-2028.ringo.prophecy.eth", coins)?.id).toBe(TOKEN);
  });
});

describe("Launch time", () => {
  const log = {
    args: { token: TOKEN, prophet: "0x2222222222222222222222222222222222222222", prophetLabel: "ringo", slug: "trump" },
    blockNumber: 11_790_000n,
  };

  it("uses the block timestamp, never the block number", () => {
    expect(coinsFromLaunchedLogs([{ ...log, blockTimestamp: 1_790_000_000n }])[0]?.createdAt).toBe(1_790_000_000_000);
    expect(coinsFromLaunchedLogs([log])[0]?.createdAt).toBe(0);
  });

  it("reads missing timestamps from the block once", async () => {
    resetBlockTimesForTests();
    const getBlock = vi.fn(async () => ({ timestamp: 1_790_000_000n }));
    const coins = coinsFromLaunchedLogs([log, { ...log, args: { ...log.args, slug: "trump-two" } }]);
    const filled = await fillLaunchTimes(coins, getBlock);
    expect(filled.map((c) => c.createdAt)).toEqual([1_790_000_000_000, 1_790_000_000_000]);
    expect(getBlock).toHaveBeenCalledTimes(1);
    expect((await fillLaunchTimes(coinsFromLaunchedLogs([log]), undefined))[0]?.createdAt).toBe(1_790_000_000_000);
  });
});
