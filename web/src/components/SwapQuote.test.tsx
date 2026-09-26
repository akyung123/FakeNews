import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseEther } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { AuctionView } from "../lib/cca";
import type { CcaAuctionSnapshot } from "../lib/cca/loadAuction";
import { decodeV4ExactInSingle } from "../lib/cca/swap";
import type { Coin } from "../lib/store";
import { CcaTrade, QUOTE_UNAVAILABLE } from "./CcaTrade";

const TOKEN = "0x09f8d704556687efc0621580beef6511937b2398" as const;
const HOOK = "0x5f7Ba2Fa7e57873D9E57575e2Fc30F71897ea000" as const;
const WAD = 10n ** 18n;

const coin: Coin = {
  id: TOKEN,
  token: TOKEN,
  fromChain: true,
  name: "branching-minds.ringo.prophecy.eth",
  ticker: "BRANCHING-M",
  prophecy: "",
  creator: "ringo",
  createdAt: 0,
  sold: 0,
  ethRaised: 0,
  history: [],
};

const view: AuctionView = {
  phase: "ended_goal_reached",
  clearingPriceQ96: 0n,
  currencyRaised: parseEther("0.02"),
  graduationWei: parseEther("0.02"),
  goalReached: true,
  blocksRemaining: 0,
  startBlock: 100n,
  endBlock: 110n,
  claimBlock: 110n,
  migrationBlock: 111n,
  isGraduated: true,
  canOpenMarket: true,
};

const snap: CcaAuctionSnapshot = {
  missing: [],
  auction: "0x2222222222222222222222222222222222222222",
  view,
  copyStatus: "pool_open",
  soldOut: false,
  finalized: true,
  poolOpen: true,
  marketFailed: false,
  bids: [],
  needsRegister: false,
  hook: HOOK,
  refundWei: 0n,
};

function renderSwap(quoteSwap: (input: { zeroForOne: boolean; amountIn: bigint }) => Promise<bigint>, writes = {}) {
  return render(
    <CcaTrade
      coin={coin}
      balance={1}
      held={10}
      chain
      demo={false}
      chainId={11155111}
      loadAuction={async () => snap}
      quoteSwap={quoteSwap as never}
      writes={writes}
      readApprovals={async () => ({ erc20: 2n ** 200n, permit2Amount: 2n ** 159n, permit2Expiration: 2 ** 47 })}
    />,
  );
}

describe("swap quote from the V4 Quoter", () => {
  it("shows the quoted tokens for a buy and the 1% minimum", async () => {
    const quoteSwap = vi.fn(async () => 123_456n * WAD);
    renderSwap(quoteSwap);
    await waitFor(() => expect(screen.getByTestId("swap-quote")).toHaveTextContent("You get about 123.46K $BRANCHING-M"));
    expect(screen.getByTestId("swap-min")).toHaveTextContent("At least 122.22K $BRANCHING-M");
    expect(quoteSwap).toHaveBeenCalledWith({ token: TOKEN, hooks: HOOK, zeroForOne: true, amountIn: parseEther("0.001") });
  });

  it("shows ETH out for a sell, not the typed amount", async () => {
    const user = userEvent.setup();
    const quoteSwap = vi.fn(async ({ zeroForOne }: { zeroForOne: boolean }) =>
      zeroForOne ? 1_000n * WAD : 40_000_000_001n,
    );
    renderSwap(quoteSwap);
    await user.click(await screen.findByRole("button", { name: "Sell" }));
    await waitFor(() => expect(screen.getByTestId("swap-quote")).toHaveTextContent("You get about 0.00000004 ETH"));
    expect(screen.getByTestId("swap-quote")).not.toHaveTextContent("about 1 ETH");
    expect(quoteSwap).toHaveBeenLastCalledWith(expect.objectContaining({ zeroForOne: false, amountIn: WAD }));
  });

  it("says Quote unavailable and keeps the swap off when the Quoter fails", async () => {
    renderSwap(async () => {
      throw new Error("PoolNotInitialized");
    });
    await waitFor(() => expect(screen.getByTestId("swap-quote")).toHaveTextContent(QUOTE_UNAVAILABLE));
    expect(screen.queryByTestId("swap-min")).toBeNull();
    expect(screen.getByRole("button", { name: "Buy $BRANCHING-M" })).toBeDisabled();
    expect(document.body.textContent).not.toContain("You get about 0.001");
  });

  it("sends the 1% minimum as amountOutMinimum", async () => {
    const user = userEvent.setup();
    const writeContract = vi.fn(async () => `0x${"ab".repeat(32)}` as const);
    renderSwap(async () => 1_000n * WAD, {
      simulateContract: vi.fn(async () => ({})),
      writeContract,
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    });
    const buy = await screen.findByRole("button", { name: "Buy $BRANCHING-M" });
    await waitFor(() => expect(buy).toBeEnabled());
    await user.click(buy);
    await waitFor(() => expect(writeContract).toHaveBeenCalledTimes(1));
    const request = writeContract.mock.calls[0]![1] as { args: [`0x${string}`, `0x${string}`[], bigint] };
    const decoded = decodeV4ExactInSingle({ commands: request.args[0], inputs: request.args[1] });
    expect(decoded.amountIn).toBe(parseEther("0.001"));
    expect(decoded.amountOutMinimum).toBe(990n * WAD);
    expect(decoded.poolKey).toMatchObject({ fee: 10_000, tickSpacing: 200 });
  });
});
