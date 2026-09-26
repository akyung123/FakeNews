import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ISSUE_COPY } from "../lib/issue";
import { MOCK_RETURNING_SESSION } from "../lib/mock";
import { useStore } from "../lib/store";
import { createWorldClient } from "../lib/world";
import { IssueScreen } from "./CreatePage";

vi.mock("../lib/mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/mode")>()),
  isMockMode: () => false,
}));

function StoreSize({ onSize }: { onSize: (n: number) => void }) {
  onSize(useStore().coins.length);
  return null;
}

describe("chain-mode launch with no token back", () => {
  it("shows an error instead of creating a demo coin", async () => {
    const user = userEvent.setup();
    const issued: string[] = [];
    const sizes: number[] = [];
    render(
      <MemoryRouter>
        <StoreSize onSize={(n) => sizes.push(n)} />
        <IssueScreen
          session={MOCK_RETURNING_SESSION}
          world={createWorldClient({ mock: true })}
          launchProphecy={async () => null}
          lookupProphet={async () => MOCK_RETURNING_SESSION.prophetLabel ?? ""}
          onIssued={(id) => issued.push(id)}
        />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/^Prophecy$/i), "Coffee lasts until the last pitch");
    await user.type(screen.getByLabelText(/^Short name$/i), "coffee-last");
    await waitFor(() => expect(screen.getByRole("button", { name: ISSUE_COPY.launch })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.launch }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.launchUnavailable));
    expect(issued).toEqual([]);
    expect(new Set(sizes).size).toBe(1);
  });
});

describe("protocol fee recipient", () => {
  it("disables Launch and says why when the wallet receives protocol fees", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IssueScreen
          session={MOCK_RETURNING_SESSION}
          world={createWorldClient({ mock: true })}
          launchProphecy={async () => null}
          lookupProphet={async () => MOCK_RETURNING_SESSION.prophetLabel ?? ""}
          readFeeRecipient={async () => MOCK_RETURNING_SESSION.wallet.toUpperCase().replace("0X", "0x")}
        />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/^Prophecy$/i), "Coffee lasts until the last pitch");
    await user.type(screen.getByLabelText(/^Short name$/i), "coffee-last");
    await waitFor(() =>
      expect(screen.getByTestId("fee-recipient")).toHaveTextContent(
        "This wallet receives protocol fees and can't launch",
      ),
    );
    expect(screen.getByRole("button", { name: ISSUE_COPY.launch })).toBeDisabled();
  });

  it("leaves Launch on for any other wallet", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IssueScreen
          session={MOCK_RETURNING_SESSION}
          world={createWorldClient({ mock: true })}
          lookupProphet={async () => MOCK_RETURNING_SESSION.prophetLabel ?? ""}
          readFeeRecipient={async () => "0x9999999999999999999999999999999999999999"}
        />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/^Prophecy$/i), "Coffee lasts until the last pitch");
    await user.type(screen.getByLabelText(/^Short name$/i), "coffee-last");
    await waitFor(() => expect(screen.getByRole("button", { name: ISSUE_COPY.launch })).toBeEnabled());
    expect(screen.queryByTestId("fee-recipient")).toBeNull();
  });
});
