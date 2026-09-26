import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { MEMO_COPY, memoRemainingLabel } from "../lib/limits";
import { actions } from "../lib/store";
import { CoinPage } from "./CoinPage";

function renderWifi() {
  actions.reset();
  return render(
    <MemoryRouter initialEntries={["/coin/wifi"]}>
      <Routes>
        <Route path="/coin/:id" element={<CoinPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Screen 3 trade memo limit", () => {
  it("shows remaining under the memo and disables Buy/Sell when over the UTF-8 limit", async () => {
    const user = userEvent.setup();
    renderWifi();
    const memo = screen.getByLabelText(/^Memo$/i);
    expect(screen.getByTestId("memo-left")).toHaveTextContent(memoRemainingLabel(""));
    expect(screen.getByTestId("memo-left")).toHaveTextContent("140 left");
    expect(screen.getByTestId("memo-left").textContent).not.toMatch(/byte/i);

    await user.click(memo);
    await user.paste("한".repeat(47));
    expect(screen.getByRole("alert")).toHaveTextContent(MEMO_COPY.tooLong);
    expect(screen.getByRole("alert")).toHaveTextContent("Memo is too long. Shorten it to trade.");
    expect(screen.queryByTestId("memo-left")).toBeNull();
    expect(screen.getByRole("button", { name: /Buy \$WIFI/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^Sell$/i }));
    expect(screen.getByRole("button", { name: /Sell \$WIFI/i })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(MEMO_COPY.tooLong);
  });
});
