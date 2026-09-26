import { describe, expect, test } from "bun:test";
import { parseEther } from "viem";
import {
  CCA_COPY,
  auctionLiveCopy,
  blocksToMmSs,
  formatMmSs,
  raisedProgressCopy,
  refundUnusedCopy,
} from "./copy";

const BANNED = [
  "return",
  "returns",
  "predict",
  "prediction",
  "profit",
  "yield",
  "moon",
  "guaranteed",
];

describe("designer v1 CCA copy", () => {
  test("keeps the approved strings exactly", () => {
    expect(CCA_COPY.auctionLive).toBe("Auction live · ends in {blocks} blocks (~{mm:ss})");
    expect(CCA_COPY.currentClearingPrice).toBe("Current clearing price");
    expect(CCA_COPY.finalClearingPrice).toBe("Final clearing price");
    expect(CCA_COPY.samePrice).toBe("Everyone who gets tokens pays this same price per token.");
    expect(CCA_COPY.raisedProgress).toBe("{raised} of 0.02 ETH raised to open the market");
    expect(CCA_COPY.budgetEth).toBe("Budget (ETH)");
    expect(CCA_COPY.maxPricePerToken).toBe("Max price per token (ETH)");
    expect(CCA_COPY.placeBid).toBe("Place bid");
    expect(CCA_COPY.bidHelp).toBe(
      "You never pay more than your max price. Any ETH not used comes back to you after the auction.",
    );
    expect(CCA_COPY.claimTokens).toBe("Claim tokens");
    expect(CCA_COPY.refundUnused).toBe("Get back unused ETH ({amount} ETH)");
    expect(CCA_COPY.openMarket).toBe("Open market");
    expect(CCA_COPY.openMarketHelp).toBe(
      "Moves the raised ETH and tokens into a Uniswap v4 pool. Anyone can do this once the auction ends and the goal is reached.",
    );
    expect(CCA_COPY.poolFeeSplit).toBe(
      "Pool fee 1%. Fees are split 24% to the prophet and 76% to the protocol.",
    );
    expect(CCA_COPY.goalNotReached).toBe("Auction ended · goal not reached");
    expect(CCA_COPY.goalNotReachedSub).toBe("TBD(INTERFACE_CCA)");
  });

  test("interpolates live countdown, raised, and unused ETH", () => {
    expect(formatMmSs(300)).toBe("05:00");
    expect(blocksToMmSs(25)).toBe("05:00");
    expect(auctionLiveCopy(25)).toBe("Auction live · ends in 25 blocks (~05:00)");
    expect(auctionLiveCopy(5)).toBe("Auction live · ends in 5 blocks (~01:00)");
    expect(raisedProgressCopy(parseEther("0.007"))).toBe("0.007 of 0.02 ETH raised to open the market");
    expect(refundUnusedCopy(parseEther("0.003"))).toBe("Get back unused ETH (0.003 ETH)");
  });

  test("does not talk about returns or price predictions", () => {
    const joined = Object.values(CCA_COPY).join(" ").toLowerCase();
    for (const word of BANNED) {
      expect(joined).not.toContain(word);
    }
  });
});
