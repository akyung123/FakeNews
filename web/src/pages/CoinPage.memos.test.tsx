import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MEMO_COPY } from "../lib/limits";
import { actions, type Coin } from "../lib/store";
import { Web3Provider } from "../providers/Web3Provider";
import { CoinPage } from "./CoinPage";

const TOKEN = "0x1111111111111111111111111111111111111111" as const;

const live: Coin = {
  id: TOKEN,
  token: TOKEN,
  fromChain: true,
  name: "lingo-2028.ringo.prophecy.eth",
  ticker: "LINGO-2028",
  prophecy: "Every badge is a name",
  creator: "ringo",
  createdAt: 1,
  sold: 0,
  ethRaised: 0,
  complete: false,
  history: [],
};

function renderCoin(id: string, loadLaunched?: () => Promise<Coin[]>) {
  return render(
    <Web3Provider>
      <MemoryRouter initialEntries={[`/coin/${id}`]}>
        <Routes>
          <Route path="/coin/:id" element={<CoinPage loadLaunched={loadLaunched} />} />
        </Routes>
      </MemoryRouter>
    </Web3Provider>,
  );
}

describe("Trade memos", () => {
  it("chain mode hides the memo block and says memos are not on-chain", async () => {
    actions.reset();
    renderCoin(TOKEN, async () => [live]);
    await waitFor(() => expect(screen.getByText("Every badge is a name")).toBeInTheDocument());
    expect(screen.getByTestId("memo-not-on-chain")).toHaveTextContent(MEMO_COPY.notOnChain);
    expect(screen.queryByRole("heading", { name: "Trade memos" })).toBeNull();
    expect(screen.queryByPlaceholderText(/one-line memo/i)).toBeNull();
    expect(screen.queryByText("Hold this prophecy to add a memo.")).toBeNull();
  });

  it("demo mode shows the memo box to a holder", () => {
    actions.reset();
    // The demo seed gives "you" a position in wifi.
    renderCoin("wifi");
    expect(screen.getByRole("heading", { name: "Trade memos" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/one-line memo/i)).toBeInTheDocument();
    expect(screen.queryByTestId("memo-not-on-chain")).toBeNull();
  });

  it("demo mode asks a non-holder to hold first", () => {
    actions.reset();
    renderCoin("oops");
    expect(screen.getByRole("heading", { name: "Trade memos" })).toBeInTheDocument();
    expect(screen.getByText("Hold this prophecy to add a memo.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/one-line memo/i)).toBeNull();
    expect(screen.queryByTestId("memo-not-on-chain")).toBeNull();
  });
});
