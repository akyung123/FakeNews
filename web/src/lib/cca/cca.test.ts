import { describe, expect, it, vi } from "vitest";
import { encodeAbiParameters, encodeEventTopics, encodePacked, parseEther, zeroAddress } from "viem";
import { wagmiConfig } from "../wagmi";
import { ccaAbi } from "./abi/cca";
import { ccaLensAbi } from "./abi/ccaLens";
import { lbpStrategyAbi } from "./abi/lbpStrategy";
import { launchpadCcaAbi, lockerCcaAbi } from "./abi/launchpadCca";
import { V4_SWAP_COMMAND, universalRouterAbi } from "./abi/universalRouter";
import { CCA_SEPOLIA, FUNDS_RECIPIENT } from "./addresses";
import {
  auctionActionVisibility,
  auctionScheduleRequest,
  bidRead,
  blocksRemaining,
  canOpenMarket,
  ccaLensStateRequest,
  deriveAuctionView,
  goalNotReachedEffects,
  readAuctionView,
  type CcaLensState,
} from "./auction";
import { placeBid, placeBidArgs, placeBidWrite } from "./bid";
import { claimTokens, claimTokensBatch, claimTokensWrite } from "./claim";
import { checkpoint, checkpointWrite } from "./checkpoint";
import {
  AUCTION_BLOCKS,
  AUCTION_STEPS_MPS_TOTAL,
  CCA_CONFIG,
  FIRST_BID_ID,
  FLOOR_PRICE_Q96,
  GRADUATION_ETH_WEI,
  NATIVE_ETH,
  POOL_FEE,
  POOL_TICK_SPACING,
  Q96,
  TICK_SPACING_Q96,
  auctionClaimBlock,
  auctionEndBlock,
  auctionMigrationBlock,
  packUniformAuctionSteps,
  resolveCcaConfig,
} from "./config";
import { CCA_BID_ERROR_COPY, CCA_CLAIM_ERROR_COPY, CCA_LAUNCH_ERROR_MESSAGE } from "./copy";
import { ccaErrorCopyFor, ccaUserMessage, mapCcaError } from "./errors";
import { exitBid, exitBidWrite, exitPartiallyFilledBid } from "./exit";
import { CCA_FORK_PIN_BLOCK, CCA_FORK_STEPS, forkHappyPathSchedule } from "./flow";
import {
  INTERFACE_CCA_PENDING,
  INTERFACE_CCA_TBD,
  InterfaceCcaPendingError,
  auctionOfRead,
  backendLaunchErrorNames,
  collectCcaWrite,
  hookRead,
  initializeDistributionSalt,
  initializerFromAuction,
  launchCcaWrite,
  lockerCollectActionBytes,
  lockerTokenIdBinding,
  withdrawAccruedWrite,
} from "./launchpadCca";
import { positionManagerTransferAbi, tokenIdsMintedToLocker } from "./register";
import { migrateOutcomeFromReceipt, openMarket, openMarketResult, openMarketWrite } from "./migrate";
import {
  MaxPriceBelowFloorError,
  ethPerTokenToQ96,
  prevTickHintQ96,
  q96ToWeiPerToken,
  snapMaxPriceToTick,
  weiPerTokenToQ96,
} from "./price";
import { encodeV4ExactInSingle, ethTokenPoolKey } from "./swap";
import {
  CCA_LOG_CHUNK_BLOCKS,
  bidExitedLogsQuery,
  bidSubmittedLogsQuery,
  ccaLogChunks,
  ccaLogsFromBlock,
  fetchCcaEventLogs,
  tokensClaimedLogsQuery,
} from "./logs";
import { assertSuccessfulReceipt, sendCcaWrite } from "./writes";

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
        "lastCheckpointedBlock",
        "nextBidId",
      ]),
    );
    expect(names(ccaAbi, "function")).not.toContain("buy");
    expect(names(ccaAbi, "function")).not.toContain("sell");
    expect(names(ccaAbi, "error")).toEqual(
      expect.arrayContaining([
        "BidMustBeAboveClearingPrice",
        "TickPriceNotAtBoundary",
        "TickPriceNotIncreasing",
        "TickHintMustBeGreaterThanNextActiveTickPrice",
        "BatchClaimDifferentOwner",
        "NotGraduated",
        "BidNotExited",
        "AuctionIsOver",
      ]),
    );
    const errorByName = Object.fromEntries(
      ccaAbi.filter((item) => item.type === "error").map((item) => [item.name, item]),
    );
    expect(errorByName.TickPriceNotIncreasing?.inputs).toEqual([]);
    expect(errorByName.TickHintMustBeGreaterThanNextActiveTickPrice?.inputs).toEqual([
      { name: "tickPriceQ96", type: "uint256" },
      { name: "nextActiveTickPriceQ96", type: "uint256" },
    ]);
    expect(errorByName.BatchClaimDifferentOwner?.inputs).toEqual([
      { name: "expectedOwner", type: "address" },
      { name: "receivedOwner", type: "address" },
    ]);
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

  it("Universal Router ABI is execute with V4_SWAP 0x10", () => {
    expect(names(universalRouterAbi, "function")).toEqual(["execute"]);
    expect(V4_SWAP_COMMAND).toBe(0x10);
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
    expect(CCA_SEPOLIA.universalRouter).toBe("0x7E4f6c5e954Da5c61B3423D81E2277431Ac043f3");
    expect(CCA_SEPOLIA.poolManager).toBe("0xE03A1074c86CFeDd5C142C4F04F1a1536e203543");
    expect(CCA_SEPOLIA.positionManager).toBe("0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4");
    expect(FUNDS_RECIPIENT).toBe(CCA_SEPOLIA.lbpStrategy);
  });
});

describe("confirmed CCA config (PR #41 head d84aed4)", () => {
  it("keeps the fork-test values in one overrideable object", () => {
    expect(CCA_CONFIG.currency).toBe(zeroAddress);
    expect(NATIVE_ETH).toBe(zeroAddress);
    expect(CCA_CONFIG.floorPriceQ96).toBe(1000n << 96n);
    expect(CCA_CONFIG.tickSpacingQ96).toBe(100n << 96n);
    expect(FLOOR_PRICE_Q96).toBe(1000n * Q96);
    expect(TICK_SPACING_Q96).toBe(100n * Q96);
    expect(CCA_CONFIG.graduationWei).toBe(parseEther("0.02"));
    expect(GRADUATION_ETH_WEI).toBe(parseEther("0.02"));
    expect(CCA_CONFIG.poolFee).toBe(10_000);
    expect(CCA_CONFIG.poolTickSpacing).toBe(200);
    expect(POOL_FEE).toBe(10_000);
    expect(POOL_TICK_SPACING).toBe(200);
    expect(CCA_CONFIG.auctionBlocks).toBe(25);
    expect(AUCTION_BLOCKS).toBe(25);
    expect(CCA_CONFIG.firstBidId).toBe(0n);
    expect(FIRST_BID_ID).toBe(0n);
    expect(CCA_CONFIG.sepoliaForkBlock).toBe(11_784_960n);
    expect(CCA_FORK_PIN_BLOCK).toBe(11_784_960n);
    expect(CCA_CONFIG.prophetFeeShare).toBe(24);
    expect(CCA_CONFIG.protocolFeeShare).toBe(76);
    expect(CCA_CONFIG.auctionStepsMpsTotal).toBe(10_000_000);
    expect(AUCTION_STEPS_MPS_TOTAL).toBe(10_000_000);
    expect(packUniformAuctionSteps(25)).toBe(encodePacked(["uint24", "uint40"], [400_000, 25]));
    expect(packUniformAuctionSteps(10)).toBe(encodePacked(["uint24", "uint40"], [1_000_000, 10]));
  });

  it("lets INTERFACE_CCA override fields without rewriting defaults", () => {
    const next = resolveCcaConfig({ auctionBlocks: 10, graduationWei: parseEther("0.05") });
    expect(next.auctionBlocks).toBe(10);
    expect(next.graduationWei).toBe(parseEther("0.05"));
    expect(next.floorPriceQ96).toBe(CCA_CONFIG.floorPriceQ96);
    expect(CCA_CONFIG.auctionBlocks).toBe(25);
  });

  it("derives end = start+N, claim = end, migration = end+1", () => {
    expect(auctionEndBlock(11_784_960n)).toBe(11_784_985n);
    expect(auctionClaimBlock(11_784_960n)).toBe(11_784_985n);
    expect(auctionMigrationBlock(11_784_960n)).toBe(11_784_986n);
    expect(auctionEndBlock(100n, 10)).toBe(110n);
    expect(auctionMigrationBlock(100n, 10)).toBe(111n);
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

  it("snaps max price DOWN onto floor + k*tick and rejects below the floor", () => {
    expect(snapMaxPriceToTick(FLOOR_PRICE_Q96)).toBe(FLOOR_PRICE_Q96);
    expect(snapMaxPriceToTick(ethPerTokenToQ96("1100"))).toBe(1100n * Q96);
    expect(snapMaxPriceToTick(ethPerTokenToQ96("1150"))).toBe(1100n * Q96);
    expect(snapMaxPriceToTick(ethPerTokenToQ96("1199"))).toBe(1100n * Q96);
    expect(snapMaxPriceToTick(ethPerTokenToQ96("1200"))).toBe(1200n * Q96);
    expect(prevTickHintQ96(ethPerTokenToQ96("1100"))).toBe(FLOOR_PRICE_Q96);
    expect(prevTickHintQ96(ethPerTokenToQ96("1200"))).toBe(1100n * Q96);
    expect(prevTickHintQ96(FLOOR_PRICE_Q96)).toBe(FLOOR_PRICE_Q96);
    expect(() => snapMaxPriceToTick(ethPerTokenToQ96("999"))).toThrow(MaxPriceBelowFloorError);
    expect(() => snapMaxPriceToTick(ethPerTokenToQ96("0.001"))).toThrow(/below the auction floor/);
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
    expect(view.canOpenMarket).toBe(false);
    expect(view.claimBlock).toBe(125n);
    expect(view.migrationBlock).toBe(126n);
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
    expect(view.claimBlock).toBe(125n);
    expect(view.migrationBlock).toBe(126n);
    expect(view.canOpenMarket).toBe(false);
    expect(blocksRemaining(125n, 200n)).toBe(0);
  });

  it("enables open market only at block >= end+1 when graduated", () => {
    const atEnd = deriveAuctionView({
      lens: lens(parseEther("0.02"), true),
      startBlock: 100n,
      endBlock: 125n,
      currentBlock: 125n,
    });
    expect(atEnd.canOpenMarket).toBe(false);
    expect(canOpenMarket({ isGraduated: true, endBlock: 125n, currentBlock: 125n })).toBe(false);

    const afterEnd = deriveAuctionView({
      lens: lens(parseEther("0.02"), true),
      startBlock: 100n,
      endBlock: 125n,
      currentBlock: 126n,
    });
    expect(afterEnd.canOpenMarket).toBe(true);
    expect(canOpenMarket({ isGraduated: true, endBlock: 125n, currentBlock: 126n })).toBe(true);
    expect(canOpenMarket({ isGraduated: false, endBlock: 125n, currentBlock: 200n })).toBe(false);
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
    expect(view.canOpenMarket).toBe(false);
    expect(view.claimBlock).toBe(125n);
    expect(view.migrationBlock).toBe(126n);
  });

  it("hides claim and open-market when the goal was missed", () => {
    const missed = auctionActionVisibility({
      phase: "ended_goal_not_reached",
      isGraduated: false,
      endBlock: 125n,
      currentBlock: 130n,
    });
    expect(missed).toEqual({ claim: false, openMarket: false, exit: true });

    const atClaimBlock = auctionActionVisibility({
      phase: "ended_goal_reached",
      isGraduated: true,
      endBlock: 125n,
      currentBlock: 125n,
    });
    expect(atClaimBlock).toEqual({ claim: true, openMarket: false, exit: true });

    const afterMigration = auctionActionVisibility({
      phase: "ended_goal_reached",
      isGraduated: true,
      endBlock: 125n,
      currentBlock: 126n,
    });
    expect(afterMigration).toEqual({ claim: true, openMarket: true, exit: true });
  });

  it("records goal-not-reached effects: full ETH refund, NotGraduated, no pool", () => {
    expect(goalNotReachedEffects()).toEqual({
      exitBidRefundsAllEth: true,
      claimTokensReverts: "NotGraduated",
      poolOpens: false,
    });
  });

  it("reads state through CCALens then start/end blocks on the auction", async () => {
    const request = ccaLensStateRequest(AUCTION);
    expect(request.address).toBe(CCA_SEPOLIA.ccaLens);
    expect(request.abi).toBe(ccaLensAbi);
    expect(request.functionName).toBe("state");
    expect(request.args).toEqual([AUCTION]);
    expect(auctionScheduleRequest(AUCTION).endBlock.functionName).toBe("endBlock");
    expect(bidRead(AUCTION, FIRST_BID_ID).functionName).toBe("bids");
    expect(bidRead(AUCTION, FIRST_BID_ID).args).toEqual([0n]);

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
  it("sends budget as msg.value and snaps max price DOWN onto floor + k*tick", () => {
    const input = {
      auction: AUCTION,
      owner: OWNER,
      budgetEth: "0.01",
      maxPricePerTokenEth: "1150",
    };
    const args = placeBidArgs(input);
    expect(args.amount).toBe(parseEther("0.01"));
    expect(args.maxPriceQ96).toBe(1100n * Q96);
    const request = placeBidWrite(input);
    expect(request.address).toBe(AUCTION);
    expect(request.abi).toBe(ccaAbi);
    expect(request.functionName).toBe("submitBid");
    expect(args.prevTickPriceQ96).toBe(FLOOR_PRICE_Q96);
    expect(request.args).toEqual([
      args.maxPriceQ96,
      args.amount,
      OWNER,
      args.prevTickPriceQ96,
      "0x",
    ]);
    expect(request.value).toBe(args.amount);
    expect(request.args).toHaveLength(5);
  });

  it("keeps a max price that already sits on a valid tick", () => {
    expect(placeBidArgs({
      auction: AUCTION,
      owner: OWNER,
      budgetEth: "0.01",
      maxPricePerTokenEth: "1000",
    }).maxPriceQ96).toBe(FLOOR_PRICE_Q96);
  });

  it("rejects a max price below the floor", () => {
    expect(() =>
      placeBidArgs({
        auction: AUCTION,
        owner: OWNER,
        budgetEth: "0.01",
        maxPricePerTokenEth: "0.001",
      }),
    ).toThrow(MaxPriceBelowFloorError);
  });
});

describe("chain writes: simulate then write then require success", () => {
  const bidInput = {
    auction: AUCTION,
    owner: OWNER,
    budgetEth: "0.01",
    maxPricePerTokenEth: "1100",
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

  it("skips the Sepolia gate when simulate/write are injected", async () => {
    const fns = okWrite();
    const ensureSepolia = vi.fn(async () => false);
    await sendCcaWrite(
      { address: AUCTION, abi: ccaAbi, functionName: "checkpoint" },
      "checkpoint",
      { ...optionsOf(fns), ensureSepolia },
    );
    expect(ensureSepolia).not.toHaveBeenCalled();
    expect(fns.simulate).toHaveBeenCalled();
    expect(fns.write).toHaveBeenCalled();
  });

  it("blocks a live write until the wallet is on Sepolia", async () => {
    const ensureSepolia = vi.fn(async () => false);
    const simulate = vi.fn(async () => ({}));
    await expect(
      sendCcaWrite(
        { address: AUCTION, abi: ccaAbi, functionName: "checkpoint" },
        "checkpoint",
        { ensureSepolia },
      ),
    ).rejects.toThrow(/Switch to Sepolia/);
    expect(ensureSepolia).toHaveBeenCalledTimes(1);
    expect(simulate).not.toHaveBeenCalled();
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

  it("reads MigrationFailed + FundsRecovered from a successful migrate receipt", async () => {
    const topics = encodeEventTopics({
      abi: lbpStrategyAbi,
      eventName: "MigrationFailed",
      args: { initializer: AUCTION },
    });
    const data = encodeAbiParameters([{ type: "bytes" }], ["0x"]);
    const receipt = {
      status: "success" as const,
      logs: [{ address: CCA_SEPOLIA.lbpStrategy, topics, data }],
    };
    expect(migrateOutcomeFromReceipt(receipt)).toBe("failed");
    const fns = okWrite();
    fns.wait.mockResolvedValue(receipt);
    await expect(openMarketResult(AUCTION, optionsOf(fns))).resolves.toEqual({
      hash: HASH,
      outcome: "failed",
      receipt,
    });
  });

  it("reads tokenId from PositionManager mint Transfer logs", () => {
    const locker = "0x3333333333333333333333333333333333333333" as const;
    const topics = encodeEventTopics({
      abi: positionManagerTransferAbi,
      eventName: "Transfer",
      args: { from: zeroAddress, to: locker, tokenId: 7n },
    });
    expect(tokenIdsMintedToLocker([{ address: CCA_SEPOLIA.positionManager, topics, data: "0x" }], locker)).toEqual([
      7n,
    ]);
  });

  it("checkpoint throws when the receipt is not success", async () => {
    const fns = revertedWrite();
    await expect(checkpoint(AUCTION, optionsOf(fns))).rejects.toThrow(/checkpoint did not succeed/);
    expect(fns.write).toHaveBeenCalledWith(wagmiConfig, checkpointWrite(AUCTION));
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
  it("keeps the ETH/token pool key and encodes UR 2.1.2 V4_SWAP", () => {
    expect(ethTokenPoolKey(TOKEN, HOOKS)).toEqual({
      currency0: zeroAddress,
      currency1: TOKEN,
      fee: POOL_FEE,
      tickSpacing: POOL_TICK_SPACING,
      hooks: HOOKS,
    });
    const input = {
      token: TOKEN,
      hooks: HOOKS,
      zeroForOne: true,
      amountIn: parseEther("0.001"),
      amountOutMinimum: 2n,
      deadline: 1n,
    };
    const encoded = encodeV4ExactInSingle(input);
    expect(encoded.commands).toBe("0x10");
    expect(encoded.actions).toBe("0x060c0f");
    expect(V4_SWAP_COMMAND).toBe(0x10);
  });
});

describe("error mapper", () => {
  it("maps verified revert names without leaking them into designer copy", () => {
    expect(mapCcaError(new Error("BidMustBeAboveClearingPrice"))).toBe("bid_rejected");
    expect(mapCcaError(new Error("AuctionIsOver"))).toBe("auction_not_live");
    expect(mapCcaError(new Error("NotGraduated"))).toBe("goal_not_reached");
    expect(mapCcaError(new Error("MigrationNotYetAllowed"))).toBe("market_not_ready");
    expect(mapCcaError(new Error("TickPreviousPriceInvalid"))).toBe("bid_rejected");
    expect(mapCcaError(new Error("CannotPartiallyExitBidBeforeEndBlock"))).toBe("cannot_exit");
    expect(mapCcaError(new Error("TickPriceNotIncreasing"))).toBe("bid_rejected");
    expect(mapCcaError(new Error("TickHintMustBeGreaterThanNextActiveTickPrice"))).toBe(
      "bid_rejected",
    );
    expect(mapCcaError(new Error("BatchClaimDifferentOwner"))).toBe("cannot_claim");
    expect(mapCcaError(new Error("InvalidFundsRecipient"))).toBe("launch_rejected");
    expect(mapCcaError(new Error("User rejected the request"))).toBe("user_rejected");
    expect(mapCcaError(new MaxPriceBelowFloorError())).toBe("bid_rejected");
    expect(ccaUserMessage("bid_rejected")).not.toMatch(/BidMustBeAboveClearingPrice/);
    expect(ccaUserMessage("goal_not_reached")).toBe(CCA_CLAIM_ERROR_COPY.NotGraduated);
    expect(ccaUserMessage("goal_not_reached")).not.toMatch(/NotGraduated/);
    expect(ccaErrorCopyFor(new Error("NotGraduated"))).toBe(CCA_CLAIM_ERROR_COPY.NotGraduated);
    expect(ccaErrorCopyFor(new Error("BidMustBeAboveClearingPrice"))).toBe(
      CCA_BID_ERROR_COPY.BidMustBeAboveClearingPrice,
    );
    expect(ccaErrorCopyFor(new Error("InvalidFundsRecipient"))).toBe(CCA_LAUNCH_ERROR_MESSAGE);
    expect(ccaErrorCopyFor(new Error("TickPriceNotIncreasing"))).toBe(
      "Prices moved. Refresh and try again.",
    );
    expect(ccaErrorCopyFor(new Error("TickHintMustBeGreaterThanNextActiveTickPrice"))).toBe(
      "Prices moved. Refresh and try again.",
    );
    expect(ccaErrorCopyFor(new Error("BatchClaimDifferentOwner"))).toBe(
      "These bids belong to different wallets. Claim them one by one.",
    );
  });
});

describe("INTERFACE_CCA specified Launchpad names", () => {
  const launchpad = "0x3333333333333333333333333333333333333333" as const;
  const locker = "0x4444444444444444444444444444444444444444" as const;

  it("uses auctionOf / launch / collect / withdrawAccrued with the documented args", () => {
    expect(auctionOfRead(launchpad, TOKEN)).toMatchObject({
      address: launchpad,
      abi: launchpadCcaAbi,
      functionName: "auctionOf",
      args: [TOKEN],
    });
    expect(initializerFromAuction(AUCTION)).toBe(AUCTION);
    expect(hookRead(launchpad).functionName).toBe("hook");
    const launched = launchCcaWrite(launchpad, "lingo-2028", "hello", 1_800_000_000n);
    expect(launched.functionName).toBe("launch");
    expect(launched.args).toEqual(["lingo-2028", "hello", 1_800_000_000n]);
    expect(collectCcaWrite(locker, TOKEN)).toMatchObject({
      abi: lockerCcaAbi,
      functionName: "collect",
      args: [TOKEN],
    });
    expect(withdrawAccruedWrite(locker).functionName).toBe("withdrawAccrued");
  });

  it("records answered Launchpad / locker names from #42 / #44", () => {
    expect(() => initializeDistributionSalt()).toThrow(InterfaceCcaPendingError);
    expect(lockerTokenIdBinding()).toEqual({ functionName: "register", args: ["token", "tokenId"] });
    expect(lockerCollectActionBytes()).toBe("0x0111");
    expect(backendLaunchErrorNames()).toEqual(
      expect.arrayContaining(["CcaNotSet", "AuctionExists", "AuctionNotCreated"]),
    );
    expect(INTERFACE_CCA_PENDING).toEqual(
      expect.arrayContaining([
        "floor / tick Q96 pending #42 recalculation",
        "Universal Router 2.1.2 calldata not live-verified on Sepolia",
      ]),
    );
    expect(INTERFACE_CCA_TBD).toBe("TBD(INTERFACE_CCA)");
  });

  it("records the four fork-test steps from INTERFACE_CCA §8", () => {
    expect(CCA_FORK_STEPS.map((step) => step.id)).toEqual([1, 2, 3, 4]);
    expect(CCA_FORK_STEPS[1]).toMatchObject({
      name: "bid",
      functionName: "submitBid",
      arity: 5,
      firstBidId: 0n,
    });
    expect(CCA_FORK_STEPS[2].calls).toEqual(["checkpoint", "exitBid", "claimTokens", "migrate"]);
    expect(CCA_FORK_STEPS[3].encoding).toEqual({ command: 0x10, actions: [0x06, 0x0c, 0x0f] });
    const schedule = forkHappyPathSchedule(11_784_960n);
    expect(schedule.endBlock).toBe(11_784_985n);
    expect(schedule.claimBlock).toBe(11_784_985n);
    expect(schedule.migrationBlock).toBe(11_784_986n);
    expect(schedule.submitBidArity).toBe(5);
    expect(schedule.firstBidId).toBe(0n);
    expect(schedule.swapEncoding).toEqual({ command: 0x10, actions: [0x06, 0x0c, 0x0f] });
  });
});

describe("CCA log fromBlock", () => {
  it("reads VITE_LAUNCHPAD_DEPLOY_BLOCK as bigint and falls back to latest minus 50k if unset", () => {
    expect(ccaLogsFromBlock("12345678", 200_000n)).toBe(12_345_678n);
    expect(ccaLogsFromBlock("0", 90_000n)).toBe(0n);
    expect(ccaLogsFromBlock(undefined, 90_000n)).toBe(40_000n);
    expect(ccaLogsFromBlock("", 90_000n)).toBe(40_000n);
    expect(ccaLogsFromBlock("  ", 90_000n)).toBe(40_000n);
    expect(ccaLogsFromBlock("nope", 90_000n)).toBe(40_000n);
    expect(ccaLogsFromBlock(undefined, 10_000n)).toBe(0n);
  });

  it("prefers the later of lookback/deploy and auction startBlock", () => {
    expect(ccaLogsFromBlock(undefined, 90_000n, 50_000n)).toBe(50_000n);
    expect(ccaLogsFromBlock(undefined, 90_000n, 10_000n)).toBe(40_000n);
    expect(ccaLogsFromBlock("1000", 90_000n, 5_000n)).toBe(5_000n);
    expect(ccaLogsFromBlock("80000", 90_000n, 5_000n)).toBe(80_000n);
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

    const unset = bidSubmittedLogsQuery(AUCTION, latest, ccaLogsFromBlock(undefined, latest));
    expect(unset.fromBlock).toBe(30_000n);
    expect(bidExitedLogsQuery(AUCTION, latest, 9n).eventName).toBe("BidExited");
    expect(tokensClaimedLogsQuery(AUCTION, latest, 9n).eventName).toBe("TokensClaimed");
  });

  it("splits 120_000 blocks into 3 inclusive chunks with no overlap or gap", () => {
    expect(CCA_LOG_CHUNK_BLOCKS).toBe(50_000n);
    const chunks = ccaLogChunks(0n, 119_999n);
    expect(chunks).toEqual([
      { fromBlock: 0n, toBlock: 49_999n },
      { fromBlock: 50_000n, toBlock: 99_999n },
      { fromBlock: 100_000n, toBlock: 119_999n },
    ]);
    expect(chunks).toHaveLength(3);
    for (const chunk of chunks) {
      expect(chunk.toBlock - chunk.fromBlock + 1n).toBeLessThanOrEqual(CCA_LOG_CHUNK_BLOCKS);
    }
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].fromBlock).toBe(chunks[i - 1].toBlock + 1n);
    }
    expect(chunks[0].fromBlock).toBe(0n);
    expect(chunks[chunks.length - 1].toBlock).toBe(119_999n);
  });

  it("fetchCcaEventLogs applies lookback even when fromBlock is passed", async () => {
    const seen: unknown[] = [];
    const logsA = [{ eventName: "BidSubmitted", id: 1 }];
    const got = await fetchCcaEventLogs(
      {
        async getBlockNumber() {
          return 90_000n;
        },
        async getContractEvents(query) {
          seen.push(query);
          return logsA;
        },
      },
      AUCTION,
      "BidSubmitted",
      12_000n,
    );
    expect(got).toEqual([...logsA, ...logsA]);
    expect(seen).toEqual([
      bidSubmittedLogsQuery(AUCTION, 89_999n, 40_000n),
      bidSubmittedLogsQuery(AUCTION, 90_000n, 90_000n),
    ]);
  });

  it("fetchCcaEventLogs keeps a later explicit fromBlock above the lookback", async () => {
    const seen: { fromBlock: bigint; toBlock: bigint }[] = [];
    const got = await fetchCcaEventLogs(
      {
        async getBlockNumber() {
          return 119_999n;
        },
        async getContractEvents(query) {
          seen.push({ fromBlock: query.fromBlock, toBlock: query.toBlock });
          return [{ n: seen.length }];
        },
      },
      AUCTION,
      "BidSubmitted",
      80_000n,
    );
    expect(got).toEqual([{ n: 1 }]);
    expect(seen).toEqual([{ fromBlock: 80_000n, toBlock: 119_999n }]);
  });

  it("fetchCcaEventLogs uses lookback when fromBlock is omitted, then the later startBlock", async () => {
    const seen: { fromBlock: bigint; toBlock: bigint }[] = [];
    await fetchCcaEventLogs(
      {
        async getBlockNumber() {
          return 90_000n;
        },
        async getContractEvents(query) {
          seen.push({ fromBlock: query.fromBlock, toBlock: query.toBlock });
          return [];
        },
      },
      AUCTION,
      "BidSubmitted",
    );
    expect(seen[0]?.fromBlock).toBe(40_000n);

    seen.length = 0;
    await fetchCcaEventLogs(
      {
        async getBlockNumber() {
          return 90_000n;
        },
        async getContractEvents(query) {
          seen.push({ fromBlock: query.fromBlock, toBlock: query.toBlock });
          return [];
        },
      },
      AUCTION,
      "BidSubmitted",
      undefined,
      55_000n,
    );
    expect(seen).toEqual([{ fromBlock: 55_000n, toBlock: 90_000n }]);
  });
});
