import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UserRejectedRequestError } from "viem";
import { describe, expect, it } from "vitest";
import { ISSUE_COPY } from "../lib/issue";
import type { RegisterProphetInput } from "../lib/launchpad";
import { MOCK_ISSUE_SESSION, MOCK_WORLD_VERIFY } from "../lib/mock";
import { WRITE_REVERT_COPY } from "../lib/writeErrors";
import { createWorldClient } from "../lib/world";
import { ClaimNameScreen } from "./NamePage";

function renderName(
  extras: {
    registerProphet?: (input: RegisterProphetInput) => Promise<void>;
  } = {},
) {
  return render(
    <MemoryRouter initialEntries={["/name"]}>
      <Routes>
        <Route
          path="/name"
          element={
            <ClaimNameScreen
              session={MOCK_ISSUE_SESSION}
              world={createWorldClient({ mock: true })}
              registerProphet={extras.registerProphet}
            />
          }
        />
        <Route path="/create" element={<div data-testid="create-page">Issue a prophecy</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function continueButton() {
  return screen.getByRole("button", { name: ISSUE_COPY.continueIssue });
}

async function verifyAndReady(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Name$/i), "mina");
  await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
  await waitFor(() => expect(continueButton()).toBeEnabled());
}

function assertNoRawCodes() {
  const text = document.body.textContent ?? "";
  expect(text).not.toContain("portal_rejected");
  expect(text).not.toContain("malformed_payload");
  expect(text).not.toContain("NullifierUsed");
  expect(text).not.toContain("LabelTaken");
  expect(text).not.toContain("AlreadyProphet");
}

describe("/name registerProphet write path", () => {
  it("calls registerProphet with { label, nullifier, serverSig } and goes to /create only after success", async () => {
    const user = userEvent.setup();
    const seen: RegisterProphetInput[] = [];
    renderName({
      registerProphet: async (input) => {
        seen.push(input);
      },
    });
    await verifyAndReady(user);
    await user.click(continueButton());
    await waitFor(() => expect(screen.getByTestId("create-page")).toBeInTheDocument());
    expect(seen).toEqual([
      {
        wallet: MOCK_ISSUE_SESSION.wallet,
        label: "mina",
        nullifier: MOCK_WORLD_VERIFY.nullifier,
        serverSig: MOCK_WORLD_VERIFY.serverSig,
      },
    ]);
  });

  it("maps LabelTaken, NullifierUsed, and AlreadyProphet to the main revert banners", async () => {
    const cases: [keyof typeof WRITE_REVERT_COPY, string][] = [
      ["LabelTaken", WRITE_REVERT_COPY.LabelTaken],
      ["NullifierUsed", WRITE_REVERT_COPY.NullifierUsed],
      ["AlreadyProphet", WRITE_REVERT_COPY.AlreadyProphet],
    ];
    for (const [name, message] of cases) {
      const user = userEvent.setup();
      const { unmount } = renderName({
        registerProphet: async () => {
          throw { data: { errorName: name } };
        },
      });
      await verifyAndReady(user);
      await user.click(continueButton());
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));
      expect(screen.getByRole("alert")).not.toHaveTextContent(ISSUE_COPY.registerFailed);
      expect(screen.queryByTestId("create-page")).toBeNull();
      expect(screen.queryByTestId("register-success")).toBeNull();
      expect(continueButton()).toBeEnabled();
      assertNoRawCodes();
      unmount();
    }
  });

  it("resets to idle with no failed banner when the wallet rejects registerProphet", async () => {
    const user = userEvent.setup();
    renderName({
      registerProphet: async () => {
        throw new UserRejectedRequestError(new Error("User rejected the request."));
      },
    });
    await verifyAndReady(user);
    await user.click(continueButton());
    await waitFor(() => {
      expect(screen.queryByTestId("register-pending")).toBeNull();
      expect(continueButton()).toBeEnabled();
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByTestId("register-success")).toBeNull();
    expect(screen.queryByTestId("create-page")).toBeNull();
    expect(document.body.textContent).not.toContain(ISSUE_COPY.registerFailed);
    expect(document.body.textContent).not.toContain("failed");
    assertNoRawCodes();
  });
});
