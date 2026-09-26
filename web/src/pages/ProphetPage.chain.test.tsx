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
  claimableFeeWei: 1_200_000_000_000_000n,
});

describe("chain-mode prophet page", () => {
  it("shows Claim fees on a live own page and sends claimCreatorFee", async () => {
    const run = vi.fn(async () => true);
    const createClaim = vi.spyOn(writes, "createClaim").mockReturnValue(run);
    render(
      <MemoryRouter initialEntries={["/p/alice"]}>
        <Routes>
          <Route path="/p/:name" element={<ProphetPage loadProphet={async () => ownPage} />} />
        </Routes>
      </MemoryRouter>,
    );
    const button = await screen.findByRole("button", { name: /Claim fees/i });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(createClaim).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
    createClaim.mockRestore();
  });

  it("hides Claim fees on a mock prophet in chain mode", async () => {
    render(
      <MemoryRouter initialEntries={["/p/ringo"]}>
        <Routes>
          <Route path="/p/:name" element={<ProphetPage loadProphet={async () => null} />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("ringo.prophecy.eth")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Claim fees/i })).toBeNull();
  });
});
