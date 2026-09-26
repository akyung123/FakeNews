import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CCA_COPY } from "../lib/cca";
import { actions } from "../lib/store";
import { Web3Provider } from "../providers/Web3Provider";
import { CoinPage } from "./CoinPage";

function renderWifi() {
  actions.reset();
  return render(
    <Web3Provider>
      <MemoryRouter initialEntries={["/coin/wifi"]}>
        <Routes>
          <Route path="/coin/:id" element={<CoinPage />} />
        </Routes>
      </MemoryRouter>
    </Web3Provider>,
  );
}

describe("Screen 3 CCA bid panel", () => {
  it("disables Place bid when the budget is empty or 0", async () => {
    const user = userEvent.setup();
    renderWifi();
    const budget = screen.getByLabelText ? screen.getByDisplayValue("0.001") : screen.getAllByRole("textbox")[0];
    expect(screen.getByRole("button", { name: CCA_COPY.placeBid })).toBeEnabled();

    await user.clear(budget);
    expect(screen.getByRole("button", { name: CCA_COPY.placeBid })).toBeDisabled();

    await user.click(budget);
    await user.paste("0");
    expect(screen.getByRole("button", { name: CCA_COPY.placeBid })).toBeDisabled();
  });

  it("shows budget and max-price fields", () => {
    renderWifi();
    expect(screen.getByText(CCA_COPY.budgetEth)).toBeTruthy();
    expect(screen.getByText(CCA_COPY.maxPricePerToken)).toBeTruthy();
    expect(screen.getByText(CCA_COPY.placeBid)).toBeTruthy();
    expect(screen.getByText(CCA_COPY.bidHelp)).toBeTruthy();
  });
});
