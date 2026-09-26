import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ISSUE_COPY } from "../lib/issue";
import type { RegisterProphetInput } from "../lib/launchpad";
import { MOCK_ISSUE_SESSION, MOCK_RETURNING_SESSION, MOCK_WORLD_HEALTH, MOCK_RP_CONTEXT_RESPONSE, MOCK_WORLD_VERIFY } from "../lib/mock";
import { WorldClientError, createWorldClient, type WorldClient } from "../lib/world";
import { IssueScreen } from "./CreatePage";

const NOW = Date.parse("2026-09-26T00:00:00Z");

function renderIssue(
  session = MOCK_ISSUE_SESSION,
  extras: { world?: WorldClient; registerProphet?: IssueScreenProps["registerProphet"] } = {},
) {
  return render(
    <MemoryRouter>
      <IssueScreen
        session={session}
        world={extras.world ?? createWorldClient({ mock: true })}
        now={NOW}
        registerProphet={extras.registerProphet}
      />
    </MemoryRouter>,
  );
}

type IssueScreenProps = {
  registerProphet?: (input: RegisterProphetInput) => Promise<void>;
};

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
  return screen.getByRole("button", {
    name: (name) => name === ISSUE_COPY.launch || name === ISSUE_COPY.disabledLaunch,
  });
}

function failingWorld(kind: "portal_rejected" | "malformed_payload" | "network"): WorldClient {
  const base = createWorldClient({ mock: true });
  return {
    ...base,
    async verifyProof() {
      throw new WorldClientError(kind);
    },
    async checkHealth() {
      return { ...MOCK_WORLD_HEALTH };
    },
    async fetchRpContext() {
      return { ...MOCK_RP_CONTEXT_RESPONSE, rp_context: { ...MOCK_RP_CONTEXT_RESPONSE.rp_context } };
    },
  };
}

function assertNoRawCodes() {
  const text = document.body.textContent ?? "";
  expect(text).not.toContain("portal_rejected");
  expect(text).not.toContain("malformed_payload");
  expect(text).not.toContain("NullifierUsed");
}

describe("Screen 2 button gating", () => {
  it("shows a neutral pending state and keeps Issue off while the check is running", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const world: WorldClient = {
      ...createWorldClient({ mock: true }),
      async fetchRpContext() {
        await gate;
        return { ...MOCK_RP_CONTEXT_RESPONSE, rp_context: { ...MOCK_RP_CONTEXT_RESPONSE.rp_context } };
      },
    };
    renderIssue(MOCK_ISSUE_SESSION, { world });
    await fillFirstTimeForm(user);

    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));

    expect(screen.getByTestId("world-pending")).toHaveTextContent(ISSUE_COPY.pending);
    expect(screen.queryByText(ISSUE_COPY.checkFailed)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(launchButton()).toBeDisabled();
    expect(launchButton()).toHaveTextContent(ISSUE_COPY.disabledLaunch);
    assertNoRawCodes();

    release();
    await waitFor(() => expect(launchButton()).toBeEnabled());
    expect(screen.queryByTestId("world-pending")).toBeNull();
    expect(screen.queryByText(ISSUE_COPY.checkFailed)).toBeNull();
  });

  it("maps a timeout or dropped check to the retry sentence only after it fails", async () => {
    const user = userEvent.setup();
    let rejectFetch!: (error: unknown) => void;
    const hung = new Promise<never>((_, reject) => {
      rejectFetch = reject;
    });
    const world: WorldClient = {
      ...createWorldClient({ mock: true }),
      async fetchRpContext() {
        await hung;
        return { ...MOCK_RP_CONTEXT_RESPONSE, rp_context: { ...MOCK_RP_CONTEXT_RESPONSE.rp_context } };
      },
    };
    renderIssue(MOCK_ISSUE_SESSION, { world });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));

    expect(screen.getByTestId("world-pending")).toBeInTheDocument();
    expect(screen.queryByText(ISSUE_COPY.checkFailed)).toBeNull();
    expect(launchButton()).toBeDisabled();

    rejectFetch(new WorldClientError("network"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.checkFailed));
    expect(screen.queryByTestId("world-pending")).toBeNull();
    expect(launchButton()).toBeDisabled();
    assertNoRawCodes();
  });

  it("keeps Issue disabled until World verification succeeds", async () => {
    const user = userEvent.setup();
    renderIssue();
    await fillFirstTimeForm(user);

    expect(launchButton()).toBeDisabled();
    expect(launchButton()).toHaveTextContent(ISSUE_COPY.disabledLaunch);

    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    expect(launchButton()).toHaveTextContent(ISSUE_COPY.launch);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("maps cancel to the designer locked-until-verify sentence", async () => {
    const user = userEvent.setup();
    renderIssue();
    await fillFirstTimeForm(user);

    await user.click(screen.getByRole("button", { name: ISSUE_COPY.cancel }));

    expect(launchButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.cancelled);
    assertNoRawCodes();
  });

  it("maps portal_rejected to the World App retry sentence", async () => {
    const user = userEvent.setup();
    renderIssue();
    await fillFirstTimeForm(user);

    await user.click(screen.getByRole("button", { name: ISSUE_COPY.fail }));

    expect(launchButton()).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.portalRejected);
    assertNoRawCodes();
  });

  it("maps a live portal_rejected verify error the same way", async () => {
    const user = userEvent.setup();
    renderIssue(MOCK_ISSUE_SESSION, { world: failingWorld("portal_rejected") });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.portalRejected));
    expect(launchButton()).toBeDisabled();
    assertNoRawCodes();
  });

  it("maps malformed_payload and network errors to the generic retry sentence", async () => {
    const user = userEvent.setup();
    renderIssue(MOCK_ISSUE_SESSION, { world: failingWorld("malformed_payload") });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.checkFailed));
    assertNoRawCodes();
  });

  it("maps a registerProphet nullifier reuse revert to one-human-one-name", async () => {
    const user = userEvent.setup();
    renderIssue(MOCK_ISSUE_SESSION, {
      registerProphet: async () => {
        throw new Error("NullifierUsed");
      },
    });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    await user.click(launchButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.nullifierReuse));
    expect(launchButton()).toBeDisabled();
    assertNoRawCodes();
  });

  it("shows a pending banner while registerProphet waits for the wallet", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    renderIssue(MOCK_ISSUE_SESSION, {
      registerProphet: async () => {
        await gate;
      },
    });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    await user.click(launchButton());
    await waitFor(() => expect(screen.getByTestId("register-pending")).toHaveTextContent(ISSUE_COPY.registerPending));
    expect(launchButton()).toBeDisabled();
    expect(screen.queryByRole("alert")).toBeNull();
    release();
    await waitFor(() => expect(screen.getByTestId("register-success")).toHaveTextContent(ISSUE_COPY.registerSuccess));
  });

  it("calls registerProphet with { label, nullifier, serverSig } and keeps label off the signed payload", async () => {
    const user = userEvent.setup();
    const seen: RegisterProphetInput[] = [];
    renderIssue(MOCK_ISSUE_SESSION, {
      registerProphet: async (input) => {
        seen.push(input);
      },
    });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    await user.click(launchButton());
    await waitFor(() => expect(seen).toEqual([
      {
        label: "mina",
        nullifier: MOCK_WORLD_VERIFY.nullifier,
        serverSig: MOCK_WORLD_VERIFY.serverSig,
      },
    ]));
    expect(MOCK_WORLD_VERIFY).not.toHaveProperty("label");
  });

  it("skips World ID for a returning prophet and enables Issue once the form is valid", async () => {
    const user = userEvent.setup();
    renderIssue(MOCK_RETURNING_SESSION);

    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(screen.getByTestId("world-gate")).toHaveTextContent(ISSUE_COPY.returning);
    expect(launchButton()).toBeDisabled();

    await fillReturningForm(user);

    expect(launchButton()).toBeEnabled();
    expect(launchButton()).toHaveTextContent(ISSUE_COPY.launch);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not enable Issue on a first-time path with an empty form after success", async () => {
    const user = userEvent.setup();
    renderIssue();

    expect(launchButton()).toHaveTextContent(ISSUE_COPY.disabledLaunch);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(screen.getByText(/Verified/)).toBeInTheDocument());
    expect(launchButton()).toBeDisabled();
  });
});
