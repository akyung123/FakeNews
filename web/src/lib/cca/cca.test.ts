import { describe, expect, it, vi } from "vitest";
import { decodeAbiParameters, encodePacked, parseEther, zeroAddress } from "viem";
import { wagmiConfig } from "../wagmi";
import { ccaAbi } from "./abi/cca";
import { ccaLensAbi } from "./abi/ccaLens";
import { lbpStrategyAbi } from "./abi/lbpStrategy";
import {
  SETTLE_ALL,
  SWAP_EXACT_IN_SINGLE,
  TAKE_ALL,
  V4_SWAP_COMMAND,
  universalRouterAbi,
} from "./abi/universalRouter";
import { CCA_SEPOLIA } from "./addresses";
import {
  auctionScheduleRequest,
  bidRead,
  blocksRemaining,
  ccaLensStateRequest,
  deriveAuctionView,
  readAuctionView,
  type CcaLensState,
} from "./auction";
import { placeBid, placeBidArgs, placeBidWrite } from "./bid";
import { claimTokens, claimTokensBatch, claimTokensWrite } from "./claim";
import { GRADUATION_ETH_WEI, POOL_FEE, POOL_TICK_SPACING, Q96 } from "./constants";
import { ccaUserMessage, mapCcaError } from "./errors";
import { exitBid, exitBidWrite, exitPartiallyFilledBid } from "./exit";
import {
  INTERFACE_CCA_TBD,
  InterfaceCcaPendingError,
  auctionAddressForToken,
  claimProphetFeeCcaWrite,
  initializerAddressForToken,
  launchCcaWrite,
  poolHooksForToken,
} from "./launchpadCca";
import { openMarket, openMarketWrite } from "./migrate";
import { alignPriceToTick, ethPerTokenToQ96, q96ToWeiPerToken, weiPerTokenToQ96 } from "./price";
import { encodeV4ExactInSingle, swapExactInSingle, swapExactInSingleWrite } from "./swap";
import {
  bidExitedLogsQuery,
  bidSubmittedLogsQuery,
  ccaLogsFromBlock,
  fetchCcaEventLogs,
  tokensClaimedLogsQuery,
} from "./logs";
import { assertSuccessfulReceipt } from "./writes";

const AUCTION = "0x1111111111111111111111111111111111111111" as const;
const OWNER = "0x2222222222222222222222222222222222222222" as const;
const TOKEN = "0xa555555555555555555555555555555555555555" as const;
const HOOKS = "0x1600059B95A80d500fC42400ea9a88A9C29D2000" as const;
const HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

function names(abi: readonly { type: string; name?: string }[], type: string): string[] {
  return abi.filter((item) => item.type === type && item.name).map((item) => item.name as string);
}

function okWrite() {
  return {
    simulate: vi.fn(async () => ({ result: undefined })),
    write: vi.fn(async () => HASH),
    wait: vi.fn(async () => ({ status: "success" as const })),
  };
}

function revertedWrite() {
  return {
    simulate: vi.fn(async () => ({ result: undefined })),
    write: vi.fn(async () => HASH),
    wait: vi.fn(async () => ({ status: "reverted" as const })),
  };
}

function optionsOf(fns: { simulate: unknown; write: unknown; wait: unknown }) {
  return {
    simulateContract: fns.simulate as never,
    writeContract: fns.write as never,
    waitForTransactionReceipt: fns.wait as never,
  };
}

describe("verified external ABIs", () => {
  it("CCA auction ABI only uses names from IContinuousClearingAuction v2.1.0", () => {
    expect(names(ccaAbi, "function")).toEqual(
      expect.arrayContaining([
        "submitBid",
        "exitBid",
        "exitPartiallyFilledBid",
        "claimTokens",
        "claimTokensBatch",
        "checkpoint",
        "clearingPrice",
        "isGraduated",
        "currencyRaised",
        "startBlock",
        "endBlock",
        "claimBlock",
        "floorPrice",
        "tickSpacing",
        "bids",
      ]),
    );
    expect(names(ccaAbi, "function")).not.toContain("buy");
    expect(names(ccaAbi, "function")).not.toContain("sell");
    expect(names(ccaAbi, "error")).toEqual(
      expect.arrayContaining([
        "BidMustBeAboveClearingPrice",
        "TickPriceNotAtBoundary",
        "NotGraduated",
        "BidNotExited",
        "AuctionIsOver",
      ]),
    );
  });

  it("CCALens.state matches AuctionStateLens", () => {
    const fn = ccaLensAbi.find((item) => item.type === "function" && item.name === "state");
    expect(fn).toBeDefined();
    if (!fn || fn.type !== "function") throw new Error("missing state");
    expect(fn.stateMutability).toBe("nonpayable");
    expect(fn.inputs.map((input) => input.name)).toEqual(["auction"]);
    expect(names(ccaLensAbi, "error")).toEqual(["CheckpointFailed", "InvalidRevertReasonLength"]);
  });

  it("LBPStrategy ABI is migrate plus verified events/errors", () => {
    expect(names(lbpStrategyAbi, "function")).toEqual(["migrate"]);
    expect(names(lbpStrategyAbi, "event")).toEqual(
      expect.arrayContaining(["Migrated", "MigrationFailed", "FundsRecovered"]),
    );
    expect(names(lbpStrategyAbi, "error")).toEqual(
      expect.arrayContaining(["InitializerNotRegistered", "MigrationNotYetAllowed", "PoolManagerAlreadyUnlocked"]),
    );
  });

  it("Universal Router ABI is execute from tag 2.0.0", () => {
    expect(names(universalRouterAbi, "function")).toEqual(["execute"]);
    expect(V4_SWAP_COMMAND).toBe(0x10);
    expect(SWAP_EXACT_IN_SINGLE).toBe(0x06);
    expect(SETTLE_ALL).toBe(0x0c);
    expect(TAKE_ALL).toBe(0x0f);
  });

  it("records BidSubmitted / BidExited / TokensClaimed with indexed owner", () => {
    const bid = ccaAbi.find((item) => item.type === "event" && item.name === "BidSubmitted");
    const exited = ccaAbi.find((item) => item.type === "event" && item.name === "BidExited");
    const claimed = ccaAbi.find((item) => item.type === "event" && item.name === "TokensClaimed");
    if (!bid || bid.type !== "event") throw new Error("missing BidSubmitted");
    if (!exited || exited.type !== "event") throw new Error("missing BidExited");
    if (!claimed || claimed.type !== "event") throw new Error("missing TokensClaimed");
    expect(bid.inputs.map((input) => [input.name, input.type, input.indexed])).toEqual([
      ["id", "uint256", true],
      ["owner", "address", true],
      ["priceQ96", "uint256", false],
      ["amount", "uint128", false],
    ]);
    expect(exited.inputs.map((input) => [input.name, input.type, input.indexed])).toEqual([
      ["bidId", "uint256", true],
      ["owner", "address", true],
      ["tokensFilled", "uint256", false],
      ["currencyRefunded", "uint256", false],
    ]);
    expect(claimed.inputs.map((input) => [input.name, input.type, input.indexed])).toEqual([
      ["bidId", "uint256", true],
      ["owner", "address", true],
      ["tokensFilled", "uint256", false],
    ]);
  });

  it("uses the official Sepolia addresses", () => {
    expect(CCA_SEPOLIA.lbpStrategy).toBe("0x95434E898Af471945Cab33D5064d2aC1A6Ba2000");
    expect(CCA_SEPOLIA.ccaFactory).toBe("0x000000001F26a0044BaA66024e7b6599c61963F8");
    expect(CCA_SEPOLIA.initializerHook).toBe("0x1600059B95A80d500fC42400ea9a88A9C29D2000");
    expect(CCA_SEPOLIA.ccaLens).toBe("0xc3C65F5453A3674aDb693cbdA3C842545cD30f53");
    expect(CCA_SEPOLIA.universalRouter).toBe("0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b");
  });
});

describe("Q96 price encoding", () => {
  it("encodes ETH per token as (wei * Q96) / 1e18", () => {
    expect(Q96).toBe(2n ** 96n);
    expect(ethPerTokenToQ96("1")).toBe(Q96);
    expect(ethPerTokenToQ96("0.001")).toBe((parseEther("0.001") * Q96) / 10n ** 18n);
    expect(weiPerTokenToQ96(parseEther("0.001"))).toBe((parseEther("0.001") * Q96) / 10n ** 18n);
    const encoded = ethPerTokenToQ96("0.001");
    expect(q96ToWeiPerToken(encoded)).toBe((encoded * 10n ** 18n) / Q96);
  });

  it("snaps a bid price onto the CCA tick grid", () => {
    const spacing = Q96 / 100n;
    expect(alignPriceToTick((Q96 / 1000n) * 15n, spacing)).toBe((Q96 / 100n) * 1n);
    expect(alignPriceToTick(spacing, spacing)).toBe(spacing);
  });
});

describe("CCALens auction view", () => {
  const lens = (raised: bigint, graduated: boolean, price = Q96 / 1000n): CcaLensState => ({
    checkpoint: {
      clearingPrice: price,
      currencyRaisedAtClearingPriceQ96X7: 0n,
      cumulativeMpsPerPrice: 0n,
      cumulativeMps: 0,
      prev: 0n,
      next: 0n,
    },
    currencyRaised: raised,
    totalCleared: 0n,
    isGraduated: graduated,
  });

  it("is live while current block is before endBlock", () => {
    const view = deriveAuctionView({
      lens: lens(parseEther("0.01"), false),
      startBlock: 100n,
      endBlock: 125n,
      currentBlock: 110n,
    });
    expect(view.phase).toBe("live");
    expect(view.blocksRemaining).toBe(15);
    expect(view.goalReached).toBe(false);
    expect(view.clearingPriceQ96).toBe(Q96 / 1000n);
    expect(view.graduationWei).toBe(GRADUATION_ETH_WEI);
  });

  it("marks the goal reached at 0.02 ETH", () => {
    const view = deriveAuctionView({
      lens: lens(parseEther("0.02"), true),
      startBlock: 100n,
      endBlock: 125n,
      currentBlock: 125n,
    });
    expect(view.phase).toBe("ended_goal_reached");
    expect(view.goalReached).toBe(true);
    expect(view.blocksRemaining).toBe(0);
    expect(blocksRemaining(125n, 200n)).toBe(0);
  });

  it("marks the goal missed after the last block", () => {
    const view = deriveAuctionView({
      lens: lens(parseEther("0.001"), false),
      startBlock: 100n,
      endBlock: 125n,
      currentBlock: 130n,
    });
    expect(view.phase).toBe("ended_goal_not_reached");
    expect(view.goalReached).toBe(false);
  });

  it("reads state through CCALens then start/end blocks on the auction", async () => {
    const request = ccaLensStateRequest(AUCTION);
    expect(request.address).toBe(CCA_SEPOLIA.ccaLens);
    expect(request.abi).toBe(ccaLensAbi);
    expect(request.functionName).toBe("state");
    expect(request.args).toEqual([AUCTION]);
    expect(auctionScheduleRequest(AUCTION).endBlock.functionName).toBe("endBlock");
    expect(bidRead(AUCTION, 1n).functionName).toBe("bids");

    const view = await readAuctionView(
      {
        async simulateContract() {
          return { result: lens(parseEther("0.005"), false) };
        },
        async readContract(req) {
          if (req.functionName === "startBlock") return 10n;
          if (req.functionName === "endBlock") return 35n;
          throw new Error(req.functionName);
        },
        async getBlockNumber() {
          return 20n;
        },
      },
      AUCTION,
    );
    expect(view.phase).toBe("live");
    expect(view.blocksRemaining).toBe(15);
    expect(view.currencyRaised).toBe(parseEther("0.005"));
  });
});

describe("bid encoding", () => {
  it("sends budget as msg.value and max price as Q96 on the 4-arg submitBid", () => {
    const input = {
      auction: AUCTION,
      owner: OWNER,
      budgetEth: "0.01",
      maxPricePerTokenEth: "0.001",
    };
    const args = placeBidArgs(input);
    expect(args.amount).toBe(parseEther("0.01"));
    expect(args.maxPriceQ96).toBe(Q96 / 1000n);
    const request = placeBidWrite(input);
    expect(request.address).toBe(AUCTION);
    expect(request.abi).toBe(ccaAbi);
    expect(request.functionName).toBe("submitBid");
    expect(request.args).toEqual([args.maxPriceQ96, args.amount, OWNER, "0x"]);
    expect(request.value).toBe(args.amount);
  });
});

describe("chain writes: simulate then write then require success", () => {
  const bidInput = {
    auction: AUCTION,
    owner: OWNER,
    budgetEth: "0.01",
    maxPricePerTokenEth: "0.001",
  };

  it("does not call writeContract when simulateContract throws", async () => {
    const simulate = vi.fn(async () => {
      throw new Error("BidMustBeAboveClearingPrice");
    });
    const write = vi.fn(async () => {
      throw new Error("write must not run after a failed simulation");
    });
    const wait = vi.fn(async () => {
      throw new Error("wait must not run after a failed simulation");
    });
    await expect(placeBid(bidInput, optionsOf({ simulate, write, wait }))).rejects.toThrow(
      /BidMustBeAboveClearingPrice/,
    );
    expect(simulate).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(wait).not.toHaveBeenCalled();
  });

  it("submitBid throws when the receipt is not success", async () => {
    const fns = revertedWrite();
    await expect(placeBid(bidInput, optionsOf(fns))).rejects.toThrow(/submitBid did not succeed/);
    expect(fns.write).toHaveBeenCalledTimes(1);
    expect(fns.write).toHaveBeenCalledWith(wagmiConfig, placeBidWrite(bidInput));
    expect(() => assertSuccessfulReceipt({ status: "reverted" }, "submitBid")).toThrow(/did not succeed/);
  });

  it("claimTokens throws when the receipt is not success", async () => {
    const fns = revertedWrite();
    await expect(claimTokens(AUCTION, 1n, optionsOf(fns))).rejects.toThrow(/claimTokens did not succeed/);
    expect(fns.write).toHaveBeenCalledWith(wagmiConfig, claimTokensWrite(AUCTION, 1n));
  });

  it("exitBid throws when the receipt is not success", async () => {
    const fns = revertedWrite();
    await expect(exitBid(AUCTION, 1n, optionsOf(fns))).rejects.toThrow(/exitBid did not succeed/);
    expect(fns.write).toHaveBeenCalledWith(wagmiConfig, exitBidWrite(AUCTION, 1n));
  });

  it("exitPartiallyFilledBid throws when the receipt is not success", async () => {
    const fns = revertedWrite();
    await expect(exitPartiallyFilledBid(AUCTION, 1n, 10n, 20n, optionsOf(fns))).rejects.toThrow(
      /exitPartiallyFilledBid did not succeed/,
    );
  });

  it("claimTokensBatch throws when the receipt is not success", async () => {
    const fns = revertedWrite();
    await expect(claimTokensBatch(AUCTION, OWNER, [1n, 2n], optionsOf(fns))).rejects.toThrow(
      /claimTokensBatch did not succeed/,
    );
  });

  it("migrate throws when the receipt is not success", async () => {
    const fns = revertedWrite();
    await expect(openMarket(AUCTION, optionsOf(fns))).rejects.toThrow(/migrate did not succeed/);
    expect(openMarketWrite(AUCTION).address).toBe(CCA_SEPOLIA.lbpStrategy);
    expect(openMarketWrite(AUCTION).functionName).toBe("migrate");
    expect(openMarketWrite(AUCTION).args).toEqual([AUCTION]);
  });

  it("v4 execute throws when the receipt is not success", async () => {
    const fns = revertedWrite();
    const input = {
      token: TOKEN,
      hooks: HOOKS,
      zeroForOne: true,
      amountIn: parseEther("0.001"),
      amountOutMinimum: 1n,
      deadline: 1_800_000_000n,
    };
    await expect(swapExactInSingle(input, optionsOf(fns))).rejects.toThrow(/execute did not succeed/);
    expect(fns.write).toHaveBeenCalledWith(wagmiConfig, swapExactInSingleWrite(input));
  });

  it("successful path simulates, writes, then waits", async () => {
    const fns = okWrite();
    await expect(exitBid(AUCTION, 3n, optionsOf(fns))).resolves.toBe(HASH);
    expect(fns.simulate).toHaveBeenCalledTimes(1);
    expect(fns.write).toHaveBeenCalledTimes(1);
    expect(fns.wait).toHaveBeenCalledWith(wagmiConfig, { hash: HASH });
  });
});

describe("v4 swap encoding", () => {
  it("encodes UR 2.0 V4_SWAP exact-in single with ETH as currency0", () => {
    const encoded = encodeV4ExactInSingle({
      token: TOKEN,
      hooks: HOOKS,
      zeroForOne: true,
      amountIn: parseEther("0.001"),
      amountOutMinimum: 2n,
      deadline: 1n,
    });
    expect(encoded.commands).toBe(encodePacked(["uint8"], [V4_SWAP_COMMAND]));
    expect(encoded.value).toBe(parseEther("0.001"));
    expect(encoded.poolKey).toEqual({
      currency0: zeroAddress,
      currency1: TOKEN,
      fee: POOL_FEE,
      tickSpacing: POOL_TICK_SPACING,
      hooks: HOOKS,
    });
    const [actions, params] = decodeAbiParameters(
      [
        { name: "actions", type: "bytes" },
        { name: "params", type: "bytes[]" },
      ],
      encoded.inputs[0],
    );
    expect(actions).toBe(encodePacked(["uint8", "uint8", "uint8"], [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]));
    expect(params).toHaveLength(3);
  });
});

describe("error mapper", () => {
  it("maps verified revert names without leaking them into designer copy", () => {
    expect(mapCcaError(new Error("BidMustBeAboveClearingPrice"))).toBe("bid_rejected");
    expect(mapCcaError(new Error("AuctionIsOver"))).toBe("auction_not_live");
    expect(mapCcaError(new Error("NotGraduated"))).toBe("goal_not_reached");
    expect(mapCcaError(new Error("MigrationNotYetAllowed"))).toBe("market_not_ready");
    expect(mapCcaError(new Error("User rejected the request"))).toBe("user_rejected");
    expect(ccaUserMessage("bid_rejected")).not.toMatch(/BidMustBeAboveClearingPrice/);
    expect(ccaUserMessage("goal_not_reached")).not.toMatch(/NotGraduated/);
  });
});

describe("TBD(INTERFACE_CCA) isolation", () => {
  it("does not guess our Launchpad / hook / locker names", () => {
    expect(() => auctionAddressForToken(TOKEN)).toThrow(InterfaceCcaPendingError);
    expect(() => initializerAddressForToken(TOKEN)).toThrow(/TBD\(INTERFACE_CCA\)/);
    expect(() => poolHooksForToken(TOKEN)).toThrow(INTERFACE_CCA_TBD);
    expect(() => launchCcaWrite()).toThrow(/launch on the CCA line/);
    expect(() => claimProphetFeeCcaWrite()).toThrow(/prophet fee claim/);
  });
});

describe("CCA log fromBlock", () => {
  it("reads VITE_LAUNCHPAD_DEPLOY_BLOCK as bigint and falls back to 0n if unset", () => {
    expect(ccaLogsFromBlock("12345678")).toBe(12_345_678n);
    expect(ccaLogsFromBlock("0")).toBe(0n);
    expect(ccaLogsFromBlock(undefined)).toBe(0n);
    expect(ccaLogsFromBlock("")).toBe(0n);
    expect(ccaLogsFromBlock("  ")).toBe(0n);
    expect(ccaLogsFromBlock("nope")).toBe(0n);
    expect(ccaLogsFromBlock()).toBe(0n);
  });

  it("always sends fromBlock on bid / exit / claim log queries", () => {
    const latest = 80_000n;
    const fromDeploy = bidSubmittedLogsQuery(AUCTION, latest, 12_000n);
    expect(fromDeploy.eventName).toBe("BidSubmitted");
    expect(fromDeploy.fromBlock).toBe(12_000n);
    expect(fromDeploy.toBlock).toBe(latest);
    expect(fromDeploy.address).toBe(AUCTION);
    expect(fromDeploy.abi).toBe(ccaAbi);
    expect(Object.keys(fromDeploy)).toContain("fromBlock");

    const unset = bidSubmittedLogsQuery(AUCTION, latest, ccaLogsFromBlock(undefined));
    expect(unset.fromBlock).toBe(0n);
    expect(bidExitedLogsQuery(AUCTION, latest, 9n).eventName).toBe("BidExited");
    expect(tokensClaimedLogsQuery(AUCTION, latest, 9n).eventName).toBe("TokensClaimed");
  });

  it("fetchCcaEventLogs forwards the deploy-block fromBlock", async () => {
    const seen: unknown[] = [];
    const logs = [{ eventName: "BidSubmitted" }];
    const got = await fetchCcaEventLogs(
      {
        async getBlockNumber() {
          return 90_000n;
        },
        async getContractEvents(query) {
          seen.push(query);
          return logs;
        },
      },
      AUCTION,
      "BidSubmitted",
      12_000n,
    );
    expect(got).toBe(logs);
    expect(seen).toEqual([bidSubmittedLogsQuery(AUCTION, 90_000n, 12_000n)]);
    expect((seen[0] as { fromBlock: bigint }).fromBlock).toBe(12_000n);
  });
});
