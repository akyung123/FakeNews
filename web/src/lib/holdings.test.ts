import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { CCA_COPY } from "./cca/copy";
import type { MarketSnapshot } from "./cca/loadAuction";
import { readMyHoldings, type HoldingsReadClient } from "./holdings";
import type { Coin } from "./store";

const WALLET = "0x1234000000000000000000000000000000001234" as Address;
const LAUNCHPAD = "0x9999999999999999999999999999999999999999" as Address;
const LOCKER = "0x8888888888888888888888888888888888888888" as Address;
const TOKEN_A = "0xaaaa00000000000000000000000000000000aaaa" as Address;
const TOKEN_B = "0xbbbb00000000000000000000000000000000bbbb" as Address;
const AUCTION_A = "0xa0a0000000000000000000000000000000000a0a" as Address;
const AUCTION_B = "0xb0b0000000000000000000000000000000000b0b" as Address;
const E18 = 10n ** 18n;

function coin(token: Address, auction: Address): Coin {
  return {
    id: token,
    token,
    auction,
    name: `x.alice.prophecy.eth`,
    ticker: "X",
    prophecy: "",
    creator: "alice",
    createdAt: 0,
    sold: 0,
    ethRaised: 0,
    history: [],
    fromChain: true,
  };
}

function snapshot(token: Address, priceWei: bigint): MarketSnapshot {
  return {
    token,
    status: "graduated",
    statusVars: {},
    priceLabel: CCA_COPY.finalClearingPrice,
    priceWei,
    history: [],
  };
}

function fakeClient(opts: { label: string; accrued?: bigint }) {
  const events = vi.fn(async (query: { eventName: string; address: Address[]; args: { owner: Address } }) => {
    expect(query.address).toEqual([AUCTION_A, AUCTION_B]);
    expect(query.args.owner).toBe(WALLET);
    if (query.eventName === "BidSubmitted") {
      return [{ args: { amount: 3n * 10n ** 16n } }, { args: { amount: 2n * 10n ** 16n } }];
    }
    return [{ args: { currencyRefunded: 10n ** 16n } }];
  });
  const reads = vi.fn(async (req: { address: Address; functionName: string }) => {
    if (req.functionName === "balanceOf") return req.address === TOKEN_A ? 2000n * E18 : 0n;
    if (req.functionName === "prophetOf") return opts.label;
    if (req.functionName === "accruedEth") {
      expect(req.address).toBe(LOCKER);
      return opts.accrued ?? 0n;
    }
    throw new Error(`unexpected ${req.functionName}`);
  });
  const client = {
    // Under one log window, so each event is one getLogs call.
    getBlockNumber: async () => 40_000n,
    readContract: reads,
    getContractEvents: events,
  } as unknown as HoldingsReadClient;
  return { client, reads, events };
}

describe("readMyHoldings", () => {
  it("adds balance × price, bids minus refunds, and fees for a prophet", async () => {
    const { client, events } = fakeClient({ label: "alice", accrued: 5n * 10n ** 15n });
    const loadMarkets = vi.fn(async () => new Map([[TOKEN_A, snapshot(TOKEN_A, 10n ** 12n)]]));
    const out = await readMyHoldings(WALLET, {
      client,
      launchpad: LAUNCHPAD,
      locker: LOCKER,
      loadCoins: async () => [coin(TOKEN_A, AUCTION_A), coin(TOKEN_B, AUCTION_B)],
      loadMarkets,
    });
    // Only held tokens get a price read.
    expect(loadMarkets).toHaveBeenCalledWith([{ token: TOKEN_A, auction: AUCTION_A }]);
    expect(out.tokensHeldWei).toBe(2000n * E18);
    expect(out.holdingsValueWei).toBe(2000n * 10n ** 12n);
    expect(out.bidSpentWei).toBe(4n * 10n ** 16n);
    expect(out.feesWei).toBe(5n * 10n ** 15n);
    // One getLogs per event for every auction at once.
    expect(events).toHaveBeenCalledTimes(2);
  });

  it("leaves fees out for a wallet with no prophet name", async () => {
    const { client, reads } = fakeClient({ label: "" });
    const out = await readMyHoldings(WALLET, {
      client,
      launchpad: LAUNCHPAD,
      locker: LOCKER,
      loadCoins: async () => [coin(TOKEN_A, AUCTION_A), coin(TOKEN_B, AUCTION_B)],
      loadMarkets: async () => new Map(),
    });
    expect(out.feesWei).toBeNull();
    expect(out.holdingsValueWei).toBe(0n);
    expect(reads.mock.calls.some(([req]) => req.functionName === "accruedEth")).toBe(false);
  });
});
