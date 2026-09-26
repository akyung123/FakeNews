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
