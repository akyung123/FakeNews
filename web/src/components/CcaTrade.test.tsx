import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { parseEther } from "viem";
import {
  CCA_COPY,
  FEE_COLLECT_COPY,
  SWAP_SECTION_COPY,
  type AuctionView,
} from "../lib/cca";
import type { CcaAuctionSnapshot } from "../lib/cca/loadAuction";
import type { Coin } from "../lib/store";
import { CcaTrade } from "./CcaTrade";

const TOKEN = "0x1111111111111111111111111111111111111111" as const;
const AUCTION = "0x2222222222222222222222222222222222222222" as const;
const LOCKER = "0x3333333333333333333333333333333333333333" as const;
const STRATEGY = "0x95434E898Af471945Cab33D5064d2aC1A6Ba2000" as const;
const HOOK = "0x5555555555555555555555555555555555555555" as const;
const OWNER = "0x6666666666666666666666666666666666666666" as const;

const coin: Coin = {
  id: TOKEN,
  token: TOKEN,
  fromChain: true,
  name: "lingo-2028.ringo.prophecy.eth",
  ticker: "LINGO",
  prophecy: "Every badge is a name",
  creator: "ringo",
  createdAt: 1,
  sold: 0,
  ethRaised: 0.01,
  history: [],
};

function view(over: Partial<AuctionView> = {}): AuctionView {
  return {
    phase: "live",
    clearingPriceQ96: 0n,
    currencyRaised: parseEther("0.01"),
    graduationWei: parseEther("0.02"),
    goalReached: false,
    blocksRemaining: 12,
    startBlock: 100n,
    endBlock: 125n,
    claimBlock: 125n,
    migrationBlock: 126n,
    isGraduated: false,
    canOpenMarket: false,
    ...over,
  };
}

function snap(over: Partial<CcaAuctionSnapshot> = {}): CcaAuctionSnapshot {
  return {
    missing: [],
    auction: AUCTION,
    view: view(),
    copyStatus: "live",
    soldOut: false,
    finalized: false,
    poolOpen: false,
    marketFailed: false,
    bids: [],
    needsRegister: false,
    hook: HOOK,
    locker: LOCKER,
    lbpStrategy: STRATEGY,
    refundWei: 0n,
    owner: OWNER,
    ...over,
  };
}

function renderTrade(row: CcaAuctionSnapshot) {
  return render(
    <CcaTrade
      coin={coin}
      balance={0.05}
      held={0}
      chain
      loadAuction={async () => row}
    />,
  );
}

describe("CcaTrade CCA states", () => {
  it("shows bid fields while the auction is live", async () => {
    renderTrade(snap());
    await waitFor(() => expect(screen.getByText(CCA_COPY.placeBid)).toBeInTheDocument());
    expect(screen.getByText(CCA_COPY.budgetEth)).toBeInTheDocument();
    expect(screen.getByText(CCA_COPY.maxPricePerToken)).toBeInTheDocument();
    expect(screen.getByText(/Auction live · ends in 12 blocks/)).toBeInTheDocument();
    expect(screen.getByText(/Current clearing price/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CCA_COPY.placeBid })).toBeEnabled();
  });

  it("disables Place bid before start and when sold out", async () => {
    renderTrade(
      snap({
        copyStatus: "not_started",
        view: view({ phase: "not_started", blocksRemaining: 25, startBlock: 200n }),
      }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: CCA_COPY.placeBid })).toBeDisabled());
    cleanup();

    renderTrade(snap({ copyStatus: "sold_out", soldOut: true }));
    await waitFor(() => expect(screen.getByText(CCA_COPY.soldOutSub)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: CCA_COPY.placeBid })).toBeDisabled();
  });

  it("shows checkpoint then unused-ETH and claim after the goal is met", async () => {
    renderTrade(
      snap({
        copyStatus: "ended_not_finalized",
        view: view({
          phase: "ended_goal_reached",
          goalReached: true,
          isGraduated: true,
          blocksRemaining: 0,
        }),
        bids: [
          {
            id: 0n,
            bid: {
              startBlock: 100n,
              startCumulativeMps: 0,
              exitedBlock: 0n,
              maxPrice: 1n,
              owner: OWNER,
              amountQ96: parseEther("0.003") << 96n,
              tokensFilled: 0n,
            },
          },
        ],
        refundWei: parseEther("0.003"),
      }),
    );
    await waitFor(() => expect(screen.getByText(CCA_COPY.setFinalPrice)).toBeInTheDocument());
    expect(screen.getByText("Get back unused ETH (0.003 ETH)")).toBeInTheDocument();
    expect(screen.getByText(CCA_COPY.claimTokens)).toBeInTheDocument();
  });

  it("uses the full-refund CTA when the goal was missed", async () => {
    renderTrade(
      snap({
        copyStatus: "failed",
        view: view({
          phase: "ended_goal_not_reached",
          goalReached: false,
          isGraduated: false,
          blocksRemaining: 0,
          currencyRaised: parseEther("0.004"),
        }),
        bids: [
          {
            id: 0n,
            bid: {
              startBlock: 100n,
              startCumulativeMps: 0,
              exitedBlock: 0n,
              maxPrice: 1n,
              owner: OWNER,
              amountQ96: parseEther("0.004") << 96n,
              tokensFilled: 0n,
            },
          },
        ],
        refundWei: parseEther("0.004"),
      }),
    );
    await waitFor(() => expect(screen.getByText("Get your ETH back (0.004 ETH)")).toBeInTheDocument());
    expect(screen.queryByText(CCA_COPY.claimTokens)).toBeNull();
    expect(screen.queryByText(CCA_COPY.openMarket)).toBeNull();
    expect(screen.getAllByText(CCA_COPY.goalNotReachedSub).length).toBeGreaterThan(0);
  });

  it("opens the market only after graduation and hides swap on a failed migrate", async () => {
    renderTrade(
      snap({
        copyStatus: "graduated",
        view: view({
          phase: "ended_goal_reached",
          goalReached: true,
          isGraduated: true,
          blocksRemaining: 0,
          canOpenMarket: true,
        }),
        finalized: true,
      }),
    );
    await waitFor(() => expect(screen.getByText(CCA_COPY.openMarket)).toBeInTheDocument());
    expect(screen.getByText(CCA_COPY.openMarketHelp)).toBeInTheDocument();
    cleanup();

    renderTrade(
      snap({
        copyStatus: "market_failed",
        marketFailed: true,
        view: view({
          phase: "ended_goal_reached",
          goalReached: true,
          isGraduated: true,
          blocksRemaining: 0,
        }),
        finalized: true,
      }),
    );
    await waitFor(() => expect(screen.getByText(CCA_COPY.marketCouldntOpen)).toBeInTheDocument());
    expect(screen.getByText(CCA_COPY.marketFailedBody)).toBeInTheDocument();
    expect(screen.queryByText(CCA_COPY.openMarket)).toBeNull();
    expect(screen.queryByText(SWAP_SECTION_COPY.title)).toBeNull();
    expect(screen.getByText(CCA_COPY.claimTokens)).toBeInTheDocument();
  });

  it("shows swap and collect after the pool opens, or register when UnknownLock", async () => {
    renderTrade(
      snap({
        copyStatus: "pool_open",
        poolOpen: true,
        view: view({
          phase: "ended_goal_reached",
          goalReached: true,
          isGraduated: true,
          blocksRemaining: 0,
        }),
      }),
    );
    await waitFor(() => expect(screen.getByText(SWAP_SECTION_COPY.title)).toBeInTheDocument());
    expect(screen.getByText(FEE_COLLECT_COPY.collectFees)).toBeInTheDocument();
    expect(screen.queryByText(FEE_COLLECT_COPY.setupFeeCollection)).toBeNull();
    cleanup();

    renderTrade(
      snap({
        copyStatus: "pool_open",
        poolOpen: true,
        needsRegister: true,
        tokenId: 7n,
        view: view({
          phase: "ended_goal_reached",
          goalReached: true,
          isGraduated: true,
          blocksRemaining: 0,
        }),
      }),
    );
    await waitFor(() => expect(screen.getByText(FEE_COLLECT_COPY.setupFeeCollection)).toBeInTheDocument());
    expect(screen.getByText(FEE_COLLECT_COPY.registerHelper)).toBeInTheDocument();
    expect(screen.queryByText(FEE_COLLECT_COPY.collectFees)).toBeNull();
  });

  it("runs simulate then write then receipt on Place bid", async () => {
    const user = userEvent.setup();
    const simulateContract = vi.fn(async () => ({}));
    const writeContract = vi.fn(async () => "0xabc" as const);
    const waitForTransactionReceipt = vi.fn(async () => ({ status: "success" }));
    render(
      <CcaTrade
        coin={coin}
        balance={0.05}
        held={0}
        chain
        loadAuction={async () =>
          snap({
            floorPriceQ96: 1000n << 96n,
            tickSpacingQ96: 100n << 96n,
          })
        }
        writes={{ simulateContract, writeContract, waitForTransactionReceipt }}
      />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: CCA_COPY.placeBid })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: CCA_COPY.placeBid }));
    await waitFor(() => expect(simulateContract).toHaveBeenCalled());
    expect(writeContract).toHaveBeenCalled();
    expect(waitForTransactionReceipt).toHaveBeenCalled();
  });
});
