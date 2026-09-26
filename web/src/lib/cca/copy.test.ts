import { describe, expect, test } from "vitest";
import { parseEther } from "viem";
import { auctionActionVisibility } from "./auction";
import {
  CCA_BID_ERROR_COPY,
  CCA_CLAIM_ERROR_COPY,
  CCA_COPY,
  CCA_ERROR_COPY,
  CCA_EXIT_ERROR_COPY,
  CCA_LAUNCH_ERROR_MESSAGE,
  CCA_LAUNCH_ERROR_NAMES,
  CCA_FEE_ERROR_COPY,
  CCA_MIGRATE_ERROR_COPY,
  CCA_SWAP_ERROR_COPY,
  FEE_COLLECT_COPY,
  SWAP_SECTION_COPY,
  auctionLiveCopy,
  auctionStatusCopy,
  auctionStatusSubCopy,
  ccaErrorCopy,
  claimBlockedCopy,
  departedReplacesAuctionStatus,
  exitCtaCopy,
  exitDoneCopy,
  exitHelpCopy,
  feeCollectCopy,
  getEthBackCopy,
  openMarketBeforeCopy,
  raisedProgressCopy,
  refundUnusedCopy,
  swapSectionCopy,
  yourBidCopy,
} from "./copy";
import { ccaErrorCopyFor } from "./errors";

/** Investment-sense wording only. Refund language ("returned") is allowed. */
const BANNED = ["predict", "prediction", "profit", "yield", "moon", "guaranteed"];

describe("designer FINAL CCA copy", () => {
  test("keeps status strings exactly", () => {
    expect(CCA_COPY.notFunded).toBe("Auction is getting ready");
    expect(CCA_COPY.notStarted).toBe("Auction starts in {startBlock - block} blocks");
    expect(CCA_COPY.auctionLive).toBe("Auction live · ends in {blocks} blocks");
    expect(CCA_COPY.soldOut).toBe("Auction live · all tokens are bid for");
    expect(CCA_COPY.soldOutSub).toBe("New bids are closed. Come back when the auction ends.");
    expect(CCA_COPY.auctionEnded).toBe("Auction ended");
    expect(CCA_COPY.endedNotFinalized).toBe("Auction ended");
    expect(CCA_COPY).not.toHaveProperty("setFinalPrice");
    expect(CCA_COPY).not.toHaveProperty("settingFinalPrice");
    expect(CCA_COPY.graduated).toBe("Auction ended · ready to open the market");
    expect(CCA_COPY.goalNotReached).toBe("Auction ended · goal not reached");
    expect(CCA_COPY.poolOpen).toBe("Market open on Uniswap v4");
    expect(auctionStatusCopy("not_funded")).toBe("Auction is getting ready");
    expect(auctionStatusCopy("not_started", { n: 4 })).toBe("Auction starts in 4 blocks");
    expect(auctionStatusCopy("live", { blocks: 25 })).toBe("Auction live · ends in 25 blocks");
    expect(auctionStatusCopy("sold_out")).toBe("Auction live · all tokens are bid for");
    expect(auctionStatusSubCopy("sold_out")).toBe("New bids are closed. Come back when the auction ends.");
    expect(auctionStatusCopy("ended_not_finalized")).toBe("Auction ended");
    expect(auctionStatusCopy("graduated")).toBe("Auction ended · ready to open the market");
    expect(auctionStatusCopy("failed")).toBe("Auction ended · goal not reached");
    expect(auctionStatusSubCopy("failed")).toBe(
      "The goal wasn't reached, so no tokens were issued and the market won't open. Every bid is returned in full.",
    );
    expect(auctionStatusCopy("pool_open")).toBe("Market open on Uniswap v4");
    expect(departedReplacesAuctionStatus()).toBe(false);
    expect(Object.values(CCA_COPY).join(" ")).not.toContain("Departed");
  });

  test("keeps price, progress, bid, exit, claim, and market strings exactly", () => {
    expect(CCA_COPY.currentClearingPrice).toBe("Current clearing price");
    expect(CCA_COPY.finalClearingPrice).toBe("Final clearing price");
    expect(CCA_COPY.clearingPriceHelp).toBe(
      "Everyone buying in the same block pays that block's price per token. You never pay more than your max price.",
    );
    expect(CCA_COPY.raisedProgress).toBe("{raised} of 0.02 ETH raised to open the market");
    expect(CCA_COPY.budgetEth).toBe("Budget (ETH)");
    expect(CCA_COPY.maxPricePerToken).toBe("Max price per token (ETH)");
    expect(CCA_COPY.bidHelp).toBe(
      "You never pay more than your max price. After the auction ends, you can get back any ETH not used.",
    );
    expect(CCA_COPY.placeBid).toBe("Place bid");
    expect(CCA_COPY.placingBid).toBe("Placing bid…");
    expect(CCA_COPY.bidPlaced).toBe("Bid placed");
    expect(CCA_COPY.yourBid).toBe("Your bid · {budget} ETH up to {max} ETH per token");
    expect(CCA_COPY.refundUnused).toBe("Get back unused ETH ({amount} ETH)");
    expect(CCA_COPY.getEthBack).toBe("Get your ETH back ({amount} ETH)");
    expect(CCA_COPY.ethReturned).toBe("ETH returned");
    expect(CCA_COPY.sendingEth).toBe("Sending ETH…");
    expect(CCA_COPY.exitHelp).toBe(
      "Do this first, even if all of your budget was used. Then claim your tokens.",
    );
    expect(CCA_COPY.allBudgetUsed).toBe("All of your budget was used.");
    expect(CCA_COPY.claimTokens).toBe("Claim tokens");
    expect(CCA_COPY.claiming).toBe("Claiming…");
    expect(CCA_COPY.tokensClaimed).toBe("Tokens claimed");
    expect(CCA_COPY.claimBlocked).toBe("Tokens can be claimed from block {claimBlock}.");
    expect(CCA_COPY.openMarket).toBe("Open market");
    expect(CCA_COPY.openMarketHelp).toBe(
      "Moves the raised ETH and tokens into a Uniswap v4 pool. Anyone can do this once the auction ends and the goal is reached.",
    );
    expect(CCA_COPY.openMarketBefore).toBe("The market can open from block {migrationBlock}.");
    expect(CCA_COPY.openingMarket).toBe("Opening market…");
    expect(CCA_COPY.marketOpen).toBe("Market open. You can swap now.");
    expect(CCA_COPY.marketCouldntOpen).toBe("Auction ended · market couldn't open");
    expect(CCA_COPY.marketFailedBody).toBe("The market couldn't open. No pool was created.");
    expect(CCA_COPY.marketFailedHelp).toBe(
      "This can't be tried again, so this token has no market for now. You can still get back unused ETH and claim your tokens.",
    );
    expect(CCA_COPY.marketFailedToast).toBe("Transaction confirmed, but the market couldn't open.");
  });

  test("interpolates countdown, raised, bids, and block-gated lines", () => {
    expect(auctionLiveCopy(25)).toBe("Auction live · ends in 25 blocks");
    expect(raisedProgressCopy(parseEther("0.007"))).toBe("0.007 of 0.02 ETH raised to open the market");
    expect(yourBidCopy("0.01", "1100")).toBe("Your bid · 0.01 ETH up to 1100 ETH per token");
    expect(refundUnusedCopy(parseEther("0.003"))).toBe("Get back unused ETH (0.003 ETH)");
    expect(getEthBackCopy(parseEther("0.01"))).toBe("Get your ETH back (0.01 ETH)");
    expect(exitCtaCopy(true, parseEther("0.003"))).toBe("Get back unused ETH (0.003 ETH)");
    expect(exitCtaCopy(false, parseEther("0.01"))).toBe("Get your ETH back (0.01 ETH)");
    expect(exitDoneCopy(false)).toBe("ETH returned");
    expect(exitDoneCopy(true)).toBe("ETH returned");
    expect(exitHelpCopy(false, parseEther("0.01"))).toBe(CCA_COPY.goalNotReachedSub);
    expect(exitHelpCopy(true, 0n)).toBe("All of your budget was used.");
    expect(exitHelpCopy(true, parseEther("0.001"))).toBe(CCA_COPY.exitHelp);
    expect(claimBlockedCopy(125n)).toBe("Tokens can be claimed from block 125.");
    expect(openMarketBeforeCopy(126n)).toBe("The market can open from block 126.");
  });

  test("maps every official error name to its designer string", () => {
    expect(CCA_BID_ERROR_COPY.AuctionNotStarted).toBe("The auction hasn't started yet.");
    expect(CCA_BID_ERROR_COPY.TokensNotReceived).toBe("The auction isn't ready yet. Try again in a moment.");
    expect(CCA_BID_ERROR_COPY.AuctionIsOver).toBe("This auction has ended.");
    expect(CCA_BID_ERROR_COPY.AuctionSoldOut).toBe("All tokens are bid for. New bids are closed.");
    expect(CCA_BID_ERROR_COPY.BidMustBeAboveClearingPrice).toBe(
      "Your max price must be above the current clearing price.",
    );
    expect(CCA_BID_ERROR_COPY.InvalidBidPriceTooHigh).toBe("That max price is too high. Enter a lower one.");
    expect(CCA_BID_ERROR_COPY.InvalidBidUnableToClear).toBe(
      "This bid can't be filled at that price. Raise your max price.",
    );
    expect(CCA_BID_ERROR_COPY.BidAmountTooSmall).toBe("Your budget is too small. Enter a larger amount.");
    expect(CCA_BID_ERROR_COPY.InvalidAmount).toBe("The ETH sent doesn't match your budget. Try again.");
    expect(CCA_BID_ERROR_COPY.CurrencyIsNotNative).toBe("Something went wrong with this bid. Try again.");
    expect(CCA_BID_ERROR_COPY.BidOwnerCannotBeZeroAddress).toBe(
      "Something went wrong with this bid. Try again.",
    );
    for (const name of [
      "TickPreviousPriceInvalid",
      "TickPriceNotIncreasing",
      "TickPriceNotAtBoundary",
      "TickNotInitialized",
      "InvalidTickPrice",
      "TickHintMustBeGreaterThanNextActiveTickPrice",
    ] as const) {
      expect(CCA_BID_ERROR_COPY[name]).toBe("Prices moved. Refresh and try again.");
    }

    expect(CCA_EXIT_ERROR_COPY.AuctionIsNotOver).toBe("You can get your ETH back after the auction ends.");
    expect(CCA_EXIT_ERROR_COPY.BidAlreadyExited).toBe("You already got your ETH back for this bid.");
    expect(CCA_EXIT_ERROR_COPY.CannotExitBid).toBe("This bid can't be settled this way. Refresh and try again.");
    expect(CCA_EXIT_ERROR_COPY.CannotPartiallyExitBidBeforeGraduation).toBe(
      "This bid can be settled after the auction ends.",
    );
    expect(CCA_EXIT_ERROR_COPY.CannotPartiallyExitBidBeforeEndBlock).toBe(
      "This bid can be settled after the auction ends.",
    );
    expect(CCA_EXIT_ERROR_COPY.InvalidLastFullyFilledCheckpointHint).toBe(
      "Auction data changed. Refresh and try again.",
    );
    expect(CCA_EXIT_ERROR_COPY.InvalidOutbidBlockCheckpointHint).toBe(
      "Auction data changed. Refresh and try again.",
    );
    expect(CCA_EXIT_ERROR_COPY.BidIdDoesNotExist).toBe("We couldn't find this bid.");

    expect(CCA_CLAIM_ERROR_COPY.NotGraduated).toBe(
      "The goal wasn't reached, so there are no tokens to claim.",
    );
    expect(ccaErrorCopy("NotClaimable", { claimBlock: 125n })).toBe(
      "Tokens can't be claimed yet. Try again from block 125.",
    );
    expect(CCA_CLAIM_ERROR_COPY.AuctionIsNotFinalized).toBe(
      "The final price isn't set yet. Set it first, then claim.",
    );
    expect(CCA_CLAIM_ERROR_COPY.BidNotExited).toBe("Get back unused ETH first, then claim your tokens.");
    expect(CCA_CLAIM_ERROR_COPY.BatchClaimDifferentOwner).toBe(
      "These bids belong to different wallets. Claim them one by one.",
    );

    expect(CCA_MIGRATE_ERROR_COPY.MigrationFailed).toBe("The market couldn't open. No pool was created.");
    expect(ccaErrorCopy("MigrationNotYetAllowed", { migrationBlock: 126n })).toBe(
      "Too early. The market can open from block 126.",
    );
    expect(CCA_MIGRATE_ERROR_COPY.InitializerNotRegistered).toBe("This auction isn't linked to a market.");
    expect(CCA_MIGRATE_ERROR_COPY.PoolManagerAlreadyUnlocked).toBe("The market couldn't open. Try again.");
    expect(CCA_ERROR_COPY).not.toHaveProperty("CurrencyRaisedMismatch");
    expect(CCA_ERROR_COPY).not.toHaveProperty("NoPositionsCreated");
    expect(CCA_ERROR_COPY).not.toHaveProperty("OnlySelfCall");

    for (const name of CCA_LAUNCH_ERROR_NAMES) {
      expect(CCA_ERROR_COPY[name]).toBe(CCA_LAUNCH_ERROR_MESSAGE);
    }
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
    expect(CCA_SWAP_ERROR_COPY.V4TooLittleReceived).toBe(
      "The price moved before your swap went through. Try again.",
    );
    expect(CCA_FEE_ERROR_COPY.UnknownLock).toBe("Fees start once the market opens.");
  });

  test("hides claim and open-market when the goal was missed", () => {
    expect(
      auctionActionVisibility({
        phase: "ended_goal_not_reached",
        isGraduated: false,
        endBlock: 125n,
        currentBlock: 130n,
      }),
    ).toEqual({ claim: false, openMarket: false, exit: true });
  });

  test("pins swap and fee-collect copy v2", () => {
    expect(SWAP_SECTION_COPY.title).toBe("Swap");
    expect(SWAP_SECTION_COPY.beforeOpen).toBe("Swapping opens when the market opens.");
    expect(SWAP_SECTION_COPY.youPayEth).toBe("You pay (ETH)");
    expect(SWAP_SECTION_COPY.buySymbol).toBe("Buy {SYMBOL}");
    expect(SWAP_SECTION_COPY.allowUniswap).toBe("Allow Uniswap to use your {SYMBOL}");
    expect(FEE_COLLECT_COPY.collectFees).toBe("Collect fees");
    expect(FEE_COLLECT_COPY.setupFeeCollection).toBe("Set up fee collection");
    expect(FEE_COLLECT_COPY.settingUp).toBe("Setting up…");
    expect(FEE_COLLECT_COPY.feeCollectionReady).toBe("Fee collection ready");
    expect(FEE_COLLECT_COPY.registerHelper).toBe(
      "One-time step after the market opens. Anyone can do this.",
    );
    expect(FEE_COLLECT_COPY.beforeOpen).toBe("Fees start once the market opens.");
    expect(swapSectionCopy().sold).toBe("Sold {amount} {SYMBOL}");
    expect(feeCollectCopy().helper).toContain("24% to the prophet");
    expect(auctionStatusCopy("market_failed")).toBe("Auction ended · market couldn't open");
  });

  test("does not talk about profit, yield, or price outlooks", () => {
    const joined = [
      ...Object.values(CCA_COPY),
      ...Object.values(CCA_ERROR_COPY),
      ...Object.values(SWAP_SECTION_COPY),
      ...Object.values(FEE_COLLECT_COPY),
    ]
      .join(" ")
      .toLowerCase();
    for (const word of BANNED) {
      expect(joined).not.toContain(word);
    }
    expect(joined).not.toMatch(/[+-]\d+(?:\.\d+)?%/);
    expect(joined).not.toContain("set final price");
  });
});
