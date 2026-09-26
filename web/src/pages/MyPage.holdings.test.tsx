import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { MyHoldings } from "../lib/holdings";
import { MyPage } from "./MyPage";

vi.mock("wagmi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wagmi")>()),
  useAccount: () => ({ address: "0x1234000000000000000000000000000000001234", isConnected: true }),
}));

function renderWith(data: MyHoldings) {
  const loadHoldings = vi.fn(async () => data);
  render(
    <MemoryRouter initialEntries={["/me"]}>
      <MyPage loadHoldings={loadHoldings} loadLaunched={async () => []} />
    </MemoryRouter>,
  );
  return loadHoldings;
}

describe("My page value cards", () => {
  it("shows holdings, tokens, bids and fees in ETH for a prophet", async () => {
    const loadHoldings = renderWith({
      holdingsValueWei: 2n * 10n ** 15n,
      tokensHeldWei: 2000n * 10n ** 18n,
      bidSpentWei: 4n * 10n ** 16n,
      feesWei: 5n * 10n ** 15n,
    });
    expect(await screen.findByText("0.002 ETH")).toBeInTheDocument();
    expect(loadHoldings).toHaveBeenCalledTimes(1);
    const labels = [...document.querySelectorAll(".summary .faint.small")].map((n) => n.textContent);
    expect(labels).toEqual(["Holdings value", "Tokens held", "ETH spent on bids", "Fees ready to claim"]);
    expect(screen.getByText("2K")).toBeInTheDocument();
    expect(screen.getByText("0.04 ETH")).toBeInTheDocument();
    expect(screen.getByText("0.005 ETH")).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/USD|\$/);
    expect(text).not.toMatch(/profit|return|investment|yield/i);
  });

  it("hides the fee card for a wallet that is not a prophet", async () => {
    renderWith({ holdingsValueWei: 0n, tokensHeldWei: 0n, bidSpentWei: 0n, feesWei: null });
    await waitFor(() => expect(document.querySelector(".summary")).toHaveAttribute("aria-busy", "false"));
    expect(screen.getAllByText("0 ETH")).toHaveLength(2);
    expect(screen.queryByText("Fees ready to claim")).toBeNull();
  });
});

describe("My page lists what the wallet holds", () => {
  const WAD = 10n ** 18n;
  const base = {
    fromChain: true,
    ticker: "X",
    creator: "ringo",
    createdAt: 0,
    sold: 0,
    ethRaised: 0,
    history: [],
  };
  const held = {
    ...base,
    id: "0xaaaa00000000000000000000000000000000aaaa",
    token: "0xaaaa00000000000000000000000000000000aaaa" as const,
    name: "trump.ringo.prophecy.eth",
    prophecy: "A line someone else wrote",
  };
  const mine = {
    ...base,
    id: "0xbbbb00000000000000000000000000000000bbbb",
    token: "0xbbbb00000000000000000000000000000000bbbb" as const,
    name: "lingo-2028.me.prophecy.eth",
    prophecy: "A line this wallet wrote",
  };

  it("shows tokens held from bids, claims or swaps, apart from the ones this wallet launched", async () => {
    renderWith({
      holdingsValueWei: 2n * 10n ** 15n,
      tokensHeldWei: 2000n * WAD,
      bidSpentWei: 0n,
      feesWei: 0n,
      held: [{ coin: held, balanceWei: 2000n * WAD, priceWei: 10n ** 12n, valueWei: 2n * 10n ** 15n, launchedByYou: false }],
      launched: [{ coin: mine, balanceWei: 0n }],
    });
    const heldList = await screen.findByTestId("held-list");
    expect(heldList).toHaveTextContent("A line someone else wrote");
    expect(heldList).toHaveTextContent("2K");
    expect(heldList).toHaveTextContent("0.000001 ETH per token");
    expect(heldList).not.toHaveTextContent("A line this wallet wrote");
    const launchedList = screen.getByTestId("launched-list");
    expect(launchedList).toHaveTextContent("Launched by you");
    expect(launchedList).toHaveTextContent("A line this wallet wrote");
    expect(launchedList).toHaveTextContent("Not held by this wallet");
  });

  it("says so when the wallet holds nothing", async () => {
    renderWith({ holdingsValueWei: 0n, tokensHeldWei: 0n, bidSpentWei: 0n, feesWei: null, held: [], launched: [] });
    expect(await screen.findByText(/You don't hold a prophecy token yet/)).toBeInTheDocument();
    expect(screen.queryByTestId("launched-list")).toBeNull();
  });
});
