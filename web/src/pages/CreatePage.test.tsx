import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ISSUE_COPY } from "../lib/issue";
import { MOCK_ISSUE_SESSION, MOCK_RETURNING_SESSION } from "../lib/mock";
import { createWorldClient } from "../lib/world";
import { IssueScreen } from "./CreatePage";

const NOW = Date.parse("2026-09-26T00:00:00Z");

function renderIssue(session = MOCK_ISSUE_SESSION) {
  return render(
    <MemoryRouter>
      <IssueScreen session={session} world={createWorldClient({ mock: true })} now={NOW} />
    </MemoryRouter>,
  );
}

async function fillFirstTimeForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Prophet name/i), "mina");
  await user.type(screen.getByLabelText(/^Prophecy$/i), "Coffee lasts until the last pitch");
  await user.type(screen.getByLabelText(/^Slug$/i), "coffee-last");
}

async function fillReturningForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Prophecy$/i), "Coffee lasts until the last pitch");
  await user.type(screen.getByLabelText(/^Slug$/i), "coffee-last");
}

function launchButton() {
  return screen.getByRole("button", { name: ISSUE_COPY.launch });
}

describe("Screen 2 button gating", () => {
  it("keeps Issue disabled until World verification succeeds", async () => {
    const user = userEvent.setup();
    renderIssue();
    await fillFirstTimeForm(user);

    expect(launchButton()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps Issue disabled and shows an error when verification is cancelled", async () => {
    const user = userEvent.setup();
    renderIssue();
    await fillFirstTimeForm(user);

    await user.click(screen.getByRole("button", { name: ISSUE_COPY.cancel }));

    expect(launchButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.cancelled);
  });

  it("keeps Issue disabled and shows an error when verification fails", async () => {
    const user = userEvent.setup();
    renderIssue();
    await fillFirstTimeForm(user);

    await user.click(screen.getByRole("button", { name: ISSUE_COPY.fail }));

    expect(launchButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.failed);
  });

  it("skips World ID for a returning prophet and enables Issue once the form is valid", async () => {
    const user = userEvent.setup();
    renderIssue(MOCK_RETURNING_SESSION);

    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(screen.getByTestId("world-gate")).toHaveTextContent(ISSUE_COPY.returning);
    expect(launchButton()).toBeDisabled();

    await fillReturningForm(user);

    expect(launchButton()).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not enable Issue on a first-time path with an empty form after success", async () => {
    const user = userEvent.setup();
    renderIssue();

    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(screen.getByText(/Verified/)).toBeInTheDocument());
    expect(launchButton()).toBeDisabled();
  });
});
