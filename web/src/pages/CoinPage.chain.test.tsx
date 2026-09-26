import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CURVE_SUPPLY } from "../lib/curve";
import type { Coin } from "../lib/store";
import { CoinPage } from "./CoinPage";

const TOKEN = "0x1111111111111111111111111111111111111111" as const;

const live: Coin = {
  id: TOKEN,
  token: TOKEN,
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
});
