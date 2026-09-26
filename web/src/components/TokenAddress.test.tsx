import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseEther } from "viem";
import { describe, expect, it, vi } from "vitest";
import type { AuctionView } from "../lib/cca";
import type { CcaAuctionSnapshot } from "../lib/cca/loadAuction";
import type { Coin } from "../lib/store";
import { CcaTrade } from "./CcaTrade";
import { TokenAddress } from "./TokenAddress";
import { TokenName } from "./TokenName";

const TOKEN = "0x09f8d704556687efc0621580beef6511937b2398" as const;
const TX = `0x${"ab".repeat(32)}` as const;

function stubClipboard() {
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

describe("TokenAddress", () => {
  it("labels the token address, shortens it and copies the full address", async () => {
    const writeText = stubClipboard();
    render(<TokenAddress address={TOKEN} symbol="BRANCHING-M" watchAsset={async () => true} />);
    const block = screen.getByTestId("token-address");
    expect(block).toHaveTextContent("Token address");
    expect(block).toHaveTextContent("0x09f8…2398");
    await userEvent.click(screen.getByRole("button", { name: "Copy token address" }));
    expect(writeText).toHaveBeenCalledWith(TOKEN);
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy token address" })).toHaveTextContent("Copied"));
    expect(screen.getByRole("link", { name: "Etherscan" })).toHaveAttribute(
      "href",
      `https://sepolia.etherscan.io/token/${TOKEN}`,
    );
  });

  it("asks the wallet to watch the token with 18 decimals", async () => {
    const watchAsset = vi.fn(async () => true);
    render(<TokenAddress address={TOKEN} symbol="BRANCHING-MINDS" watchAsset={watchAsset} />);
    await userEvent.click(screen.getByRole("button", { name: "Add to MetaMask" }));
    expect(watchAsset).toHaveBeenCalledWith({ address: TOKEN, symbol: "BRANCHING-M", decimals: 18 });
    await waitFor(() => expect(screen.getByText("Added to your wallet")).toBeInTheDocument());
  });

  it("uses the same Copy button as the ENS name", async () => {
    const writeText = stubClipboard();
    render(<TokenName slug="lingo" ensName="lingo.ringo.prophecy.eth" copy />);
    await userEvent.click(screen.getByRole("button", { name: "Copy full name" }));
    expect(writeText).toHaveBeenCalledWith("lingo.ringo.prophecy.eth");
    expect(screen.getByRole("button", { name: "Copy full name" }).className).toBe("link token-copy");
  });
});

describe("tx hashes are labelled, never shown as a bare value", () => {
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
    tokenId: 7n,
    hook: "0x5555555555555555555555555555555555555555",
    locker: "0x3333333333333333333333333333333333333333",
    refundWei: 0n,
    migrateTx: TX,
  };

  it("shows the migrate tx as Market opened in tx with an Etherscan tx link", async () => {
    render(<CcaTrade coin={coin} balance={0} held={0} chain demo={false} chainId={11155111} loadAuction={async () => snap} />);
    const line = await screen.findByTestId("migrate-tx");
    expect(line).toHaveTextContent("Market opened in tx 0xabab…abab");
    expect(line.querySelector("a")).toHaveAttribute("href", `https://sepolia.etherscan.io/tx/${TX}`);
  });

  it("puts a write's hash behind an in tx label instead of the success line", async () => {
    const writes = {
      simulateContract: vi.fn(async () => ({})),
      writeContract: vi.fn(async () => TX),
      waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    };
    render(
      <CcaTrade
        coin={coin}
        balance={0}
        held={0}
        chain
        demo={false}
        chainId={11155111}
        loadAuction={async () => snap}
        writes={writes}
      />,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Collect fees" }));
    const success = await screen.findByText("Fees sent", { exact: false });
    expect(success).toHaveTextContent("Fees sent · in tx 0xabab…abab");
    expect(success.textContent).not.toContain(TX);
  });
});
