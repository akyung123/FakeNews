import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseEther } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { AuctionView } from "../lib/cca";
import { sellStep, type SellApprovals } from "../lib/cca/approvals";
import type { CcaAuctionSnapshot } from "../lib/cca/loadAuction";
import type { Coin } from "../lib/store";
import { CcaTrade } from "./CcaTrade";

const TOKEN = "0x09f8d704556687efc0621580beef6511937b2398" as const;
const OWNER = "0x6666666666666666666666666666666666666666" as const;
const WAD = 10n ** 18n;
const MAX = 2n ** 160n - 1n;
const FAR = 2 ** 47;

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
  hook: "0x5f7Ba2Fa7e57873D9E57575e2Fc30F71897ea000",
  refundWei: 0n,
  owner: OWNER,
};

const none: SellApprovals = { erc20: 0n, permit2Amount: 0n, permit2Expiration: 0 };
const permit2Only: SellApprovals = { erc20: MAX, permit2Amount: 0n, permit2Expiration: 0 };
const ready: SellApprovals = { erc20: MAX, permit2Amount: MAX, permit2Expiration: FAR };

function renderSell(readApprovals: (owner: `0x${string}`, token: `0x${string}`) => Promise<SellApprovals>, writes = {}) {
  render(
    <CcaTrade
      coin={coin}
      balance={1}
      held={10}
      chain
      demo={false}
      chainId={11155111}
      loadAuction={async () => snap}
      quoteSwap={async () => WAD / 1000n}
      readApprovals={readApprovals}
      writes={writes}
    />,
  );
}

function stepButtons() {
  return screen.queryAllByRole("button", { name: /^Step \d of 3/ });
}

describe("sellStep", () => {
  it("picks the first missing approval", () => {
    expect(sellStep(none, WAD, 100)).toBe(1);
    expect(sellStep(permit2Only, WAD, 100)).toBe(2);
    expect(sellStep({ ...ready, permit2Expiration: 100 }, WAD, 100)).toBe(2);
    expect(sellStep({ ...ready, permit2Amount: WAD - 1n }, WAD, 100)).toBe(2);
    expect(sellStep(ready, WAD, 100)).toBe(3);
  });
});

describe("sell approvals, one step at a time", () => {
  it("shows only the step still needed and walks to the sale as each receipt lands", async () => {
    const user = userEvent.setup();
    const states = [none, permit2Only, ready];
    let reads = 0;
    const readApprovals = vi.fn(async () => states[Math.min(reads++, states.length - 1)]!);
    const writeContract = vi.fn(async () => `0x${"ab".repeat(32)}` as const);
    renderSell(readApprovals, {
      simulateContract: vi.fn(async () => ({})),
      writeContract,
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    });
    await user.click(await screen.findByRole("button", { name: "Sell" }));

    await waitFor(() => expect(stepButtons().map((b) => b.textContent)).toEqual(["Step 1 of 3 · Allow Uniswap"]));
    expect(readApprovals).toHaveBeenCalledWith(OWNER, TOKEN);

    await user.click(stepButtons()[0]!);
    await waitFor(() =>
      expect(stepButtons().map((b) => b.textContent)).toEqual(["Step 2 of 3 · Confirm for this sale"]),
    );
    expect(writeContract.mock.calls[0]?.[1]).toMatchObject({ functionName: "approve", address: TOKEN });
    expect(screen.getByRole("list", { name: "Steps to sell" })).toHaveTextContent("✓ Step 1 of 3 · Allow Uniswap");

    await user.click(stepButtons()[0]!);
    await waitFor(() =>
      expect(stepButtons().map((b) => b.textContent)).toEqual(["Step 3 of 3 · Sell $BRANCHING-M"]),
    );
    expect(writeContract.mock.calls[1]?.[1]).toMatchObject({ functionName: "approve" });
    expect(screen.getByRole("list", { name: "Steps to sell" })).toHaveTextContent("✓ Step 2 of 3 · Confirm for this sale");
    expect(readApprovals).toHaveBeenCalledTimes(3);
  });

  it("skips straight to the sale when both approvals are already on chain", async () => {
    const user = userEvent.setup();
    renderSell(async () => ready);
    await user.click(await screen.findByRole("button", { name: "Sell" }));
    await waitFor(() =>
      expect(stepButtons().map((b) => b.textContent)).toEqual(["Step 3 of 3 · Sell $BRANCHING-M"]),
    );
    expect(screen.queryByRole("button", { name: /Allow Uniswap/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
  });

  it("asks for step 2 again when the Permit2 allowance has expired", async () => {
    const user = userEvent.setup();
    renderSell(async () => ({ ...ready, permit2Expiration: 1 }));
    await user.click(await screen.findByRole("button", { name: "Sell" }));
    await waitFor(() =>
      expect(stepButtons().map((b) => b.textContent)).toEqual(["Step 2 of 3 · Confirm for this sale"]),
    );
  });
});
