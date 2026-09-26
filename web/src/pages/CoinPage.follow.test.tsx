import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { FOLLOWING_KEY, getFollowing } from "../lib/following";
import type { Coin } from "../lib/store";
import { Web3Provider } from "../providers/Web3Provider";
import { CoinPage } from "./CoinPage";

const TOKEN = "0x1111111111111111111111111111111111111111" as const;

const coin: Coin = {
  id: TOKEN,
  token: TOKEN,
  fromChain: true,
  name: "lingo-2028.ringo.prophecy.eth",
  ticker: "LINGO-2028",
  prophecy: "Every badge is a name",
  creator: "ringo",
  createdAt: 0,
  sold: 0,
  ethRaised: 0,
  history: [],
};

function renderCoin() {
  return render(
    <Web3Provider>
      <MemoryRouter initialEntries={[`/coin/${TOKEN}`]}>
        <Routes>
          <Route path="/coin/:id" element={<CoinPage loadLaunched={async () => [coin]} />} />
          <Route path="/p/:name" element={<p>prophet page</p>} />
        </Routes>
      </MemoryRouter>
    </Web3Provider>,
  );
}

describe("coin page creator line", () => {
  beforeEach(() => localStorage.removeItem(FOLLOWING_KEY));

  it("links the creator to the prophet page", async () => {
    renderCoin();
    const link = await screen.findByRole("link", { name: "ringo" });
    expect(link).toHaveAttribute("href", "/p/ringo");
    await userEvent.click(link);
    expect(screen.getByText("prophet page")).toBeInTheDocument();
  });

  it("toggles Follow and Following like the prophet page", async () => {
    renderCoin();
    const button = await screen.findByRole("button", { name: "Follow" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    await waitFor(() => expect(screen.getByRole("button", { name: "Following" })).toBeInTheDocument());
    expect(getFollowing()).toEqual(["ringo"]);
    await userEvent.click(screen.getByRole("button", { name: "Following" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument());
    expect(getFollowing()).toEqual([]);
  });

  it("hides the ago line when the launch time is unknown", async () => {
    renderCoin();
    await screen.findByRole("link", { name: "ringo" });
    expect(document.querySelector(".coin-by")?.textContent).not.toContain("ago");
  });
});
