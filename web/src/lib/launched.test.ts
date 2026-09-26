import { describe, expect, it } from "vitest";
import { coinsFromLaunchedLogs, findLaunchedCoin } from "./launched";

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
    expect(coins[0]?.ticker).toBe("LINGO-2028");
    expect(coins[0]?.creator).toBe("ringo");
    expect(coins[0]?.name).toContain("lingo-2028.ringo");
    expect(findLaunchedCoin(TOKEN, coins)?.ticker).toBe("LINGO-2028");
    expect(findLaunchedCoin("lingo-2028.ringo.prophecy.eth", coins)?.id).toBe(TOKEN);
  });
});
