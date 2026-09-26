import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { prophetPageFromChain } from "../lib/prophetData";
import * as writes from "../lib/writes";
import { ProphetPage } from "./ProphetPage";

const WALLET = "0x3333333333333333333333333333333333333333" as const;

const ownPage = prophetPageFromChain({
  label: "alice",
  wallet: WALLET,
  claimableFeeWei: 0n,
});

function renderOwn(props: {
  readCreatorFee?: (wallet: string) => Promise<bigint>;
} = {}) {
  return render(
    <MemoryRouter initialEntries={["/p/alice"]}>
      <Routes>
        <Route
          path="/p/:name"
          element={<ProphetPage loadProphet={async () => ownPage} readCreatorFee={props.readCreatorFee} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("chain-mode prophet page", () => {
  it("disables Claim fees when creatorFeeOf is 0 and does not simulate", async () => {
    const run = vi.fn(async () => true);
    const createClaim = vi.spyOn(writes, "createClaim").mockReturnValue(run);
    const readCreatorFee = vi.fn(async () => 0n);
    renderOwn({ readCreatorFee });
    const button = await screen.findByRole("button", { name: /Claim fees/i });
    await waitFor(() => expect(readCreatorFee).toHaveBeenCalledWith(WALLET));
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(createClaim).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    createClaim.mockRestore();
  });

  it("enables Claim fees when creatorFeeOf is greater than 0 and sends claimCreatorFee", async () => {
    const run = vi.fn(async () => true);
    const createClaim = vi.spyOn(writes, "createClaim").mockReturnValue(run);
    const readCreatorFee = vi.fn(async () => 1_200_000_000_000_000n);
    renderOwn({ readCreatorFee });
    const button = await screen.findByRole("button", { name: /Claim fees/i });
    await waitFor(() => expect(button).toBeEnabled());
    expect(readCreatorFee).toHaveBeenCalledWith(WALLET);
    await userEvent.click(button);
    expect(createClaim).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
    createClaim.mockRestore();
  });

  it("never falls back to a sample prophet in chain mode", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/p/ringo"]}>
        <Routes>
          <Route path="/p/:name" element={<ProphetPage loadProphet={async () => null} />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Prophet not found")).toBeInTheDocument());
    expect(container.innerHTML).not.toContain("ringo");
    expect(screen.queryByRole("button", { name: /Claim fees/i })).toBeNull();
  });
});
