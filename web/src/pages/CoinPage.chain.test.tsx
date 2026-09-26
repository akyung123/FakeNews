import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CURVE_SUPPLY } from "../lib/curve";
import { actions, type Coin } from "../lib/store";
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
  sold: CURVE_SUPPLY,
  ethRaised: 0.02,
  complete: true,
  history: [],
};

const liveOpen: Coin = {
  ...live,
  sold: 0,
  ethRaised: 0,
  complete: false,
};

describe("chain-mode token detail", () => {
  it("reads sold-out from the live curve, not prototypeCoinFromName", async () => {
    render(
      <MemoryRouter initialEntries={[`/coin/${TOKEN}`]}>
        <Routes>
          <Route path="/coin/:id" element={<CoinPage loadLaunched={async () => [live]} />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Every badge is a name")).toBeInTheDocument());
    expect(screen.getByText("Graduated to Uniswap V4")).toBeInTheDocument();
    expect(screen.queryByText("Prophecy not found")).toBeNull();
  });

  it("hides write buttons and never sends for a mock coin", async () => {
    actions.reset();
    const sendBuy = vi.fn(async () => true);
    const sendSell = vi.fn(async () => true);
    render(
      <MemoryRouter initialEntries={["/coin/wifi"]}>
        <Routes>
          <Route
            path="/coin/:id"
            element={<CoinPage loadLaunched={async () => []} sendBuy={sendBuy} sendSell={sendSell} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/venue Wi-Fi dies/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Buy \$WIFI/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sell \$WIFI/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Curve sold out/i })).toBeNull();
    expect(sendBuy).not.toHaveBeenCalled();
    expect(sendSell).not.toHaveBeenCalled();
  });

  it("still sends buy for a chain token", async () => {
    actions.reset();
    const sendBuy = vi.fn(async () => true);
    const sendSell = vi.fn(async () => true);
    render(
      <MemoryRouter initialEntries={[`/coin/${TOKEN}`]}>
        <Routes>
          <Route
            path="/coin/:id"
            element={<CoinPage loadLaunched={async () => [liveOpen]} sendBuy={sendBuy} sendSell={sendSell} />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Buy \$LINGO-2028/i })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: /Buy \$LINGO-2028/i }));
    await waitFor(() => expect(sendBuy).toHaveBeenCalledTimes(1));
    expect(sendBuy.mock.calls[0]?.[0]).toMatchObject({ token: TOKEN });
    expect(sendSell).not.toHaveBeenCalled();
  });
});
