import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { UserRejectedRequestError } from "viem";
import { describe, expect, it } from "vitest";
import { ISSUE_COPY } from "../lib/issue";
import type { RegisterProphetInput } from "../lib/launchpad";
import { LaunchedParseError, WRITE_COPY, launchWrite, type LaunchInput } from "../lib/writes";
import { MOCK_ISSUE_SESSION, MOCK_RETURNING_SESSION, MOCK_WORLD_HEALTH, MOCK_RP_CONTEXT_RESPONSE, MOCK_WORLD_VERIFY } from "../lib/mock";
import { WorldClientError, createWorldClient, type WorldClient } from "../lib/world";
import { IssueScreen } from "./CreatePage";

function renderIssue(
  session = MOCK_ISSUE_SESSION,
  extras: {
    world?: WorldClient;
    registerProphet?: IssueScreenProps["registerProphet"];
    launchProphecy?: IssueScreenProps["launchProphecy"];
    lookupProphet?: IssueScreenProps["lookupProphet"];
    onIssued?: (id: string) => void;
  } = {},
) {
  return render(
    <MemoryRouter>
      <IssueScreen
        session={session}
        world={extras.world ?? createWorldClient({ mock: true })}
        registerProphet={extras.registerProphet}
        launchProphecy={extras.launchProphecy}
        lookupProphet={extras.lookupProphet}
        onIssued={extras.onIssued}
      />
    </MemoryRouter>,
  );
}

type IssueScreenProps = {
  registerProphet?: (input: RegisterProphetInput) => Promise<void>;
  launchProphecy?: (input: LaunchInput) => Promise<`0x${string}` | null>;
  lookupProphet?: (wallet: string) => Promise<string>;
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

  it("maps a registerProphet NullifierUsed revert to the World ID banner", async () => {
    const user = userEvent.setup();
    const issued: string[] = [];
    renderIssue(MOCK_ISSUE_SESSION, {
      registerProphet: async () => {
        throw { data: { errorName: "NullifierUsed" } };
      },
      onIssued: (id) => {
        issued.push(id);
      },
    });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    await user.click(launchButton());
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("This World ID already has a name."),
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(ISSUE_COPY.registerFailed);
    expect(screen.queryByTestId("register-success")).toBeNull();
    expect(issued).toEqual([]);
    expect(launchButton()).toBeEnabled();
    assertNoRawCodes();
  });

  it("shows the name-claim failure copy after a reverted receipt and does not advance", async () => {
    const user = userEvent.setup();
    const issued: string[] = [];
    renderIssue(MOCK_ISSUE_SESSION, {
      registerProphet: async () => {
        throw new Error("registerProphet did not succeed");
      },
      onIssued: (id) => {
        issued.push(id);
      },
    });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    await user.click(launchButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.registerFailed));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Name claim failed. Nothing was charged except gas. Try again.",
    );
    expect(screen.queryByTestId("register-success")).toBeNull();
    expect(issued).toEqual([]);
    expect(launchButton()).toBeEnabled();
    assertNoRawCodes();
  });

  it("resets the issue button to idle with no banner when the wallet rejects registerProphet", async () => {
    const user = userEvent.setup();
    const issued: string[] = [];
    renderIssue(MOCK_ISSUE_SESSION, {
      registerProphet: async () => {
        throw new UserRejectedRequestError(new Error("User rejected the request."));
      },
      onIssued: (id) => {
        issued.push(id);
      },
    });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    await user.click(launchButton());
    await waitFor(() => {
      expect(screen.queryByTestId("register-pending")).toBeNull();
      expect(launchButton()).toBeEnabled();
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByTestId("register-success")).toBeNull();
    expect(issued).toEqual([]);
    expect(document.body.textContent).not.toContain(ISSUE_COPY.registerFailed);
    expect(launchButton()).toHaveTextContent(ISSUE_COPY.launch);
    assertNoRawCodes();
  });

  it("shows the name-claim failure copy when simulation fails, without advancing", async () => {
    const user = userEvent.setup();
    const issued: string[] = [];
    renderIssue(MOCK_ISSUE_SESSION, {
      registerProphet: async () => {
        throw new Error("NullifierUsed");
      },
      onIssued: (id) => {
        issued.push(id);
      },
    });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    await user.click(launchButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.registerFailed));
    expect(issued).toEqual([]);
    expect(screen.queryByTestId("register-success")).toBeNull();
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

  it("calls registerProphet with { label, nullifier, serverSig } and advances only after success", async () => {
    const user = userEvent.setup();
    const seen: RegisterProphetInput[] = [];
    const issued: string[] = [];
    renderIssue(MOCK_ISSUE_SESSION, {
      registerProphet: async (input) => {
        seen.push(input);
      },
      onIssued: (id) => {
        issued.push(id);
      },
    });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    await user.click(launchButton());
    await waitFor(() => expect(seen).toEqual([
      {
        wallet: MOCK_ISSUE_SESSION.wallet,
        label: "mina",
        nullifier: MOCK_WORLD_VERIFY.nullifier,
        serverSig: MOCK_WORLD_VERIFY.serverSig,
      },
    ]));
    expect(issued).toEqual([]);
    await waitFor(() => expect(screen.getByTestId("launch-submit")).toBeEnabled());
    await user.click(screen.getByTestId("launch-submit"));
    await waitFor(() => expect(issued).toHaveLength(1));
    expect(screen.getByTestId("register-success")).toHaveTextContent(ISSUE_COPY.registerSuccess);
    expect(screen.getByTestId("register-success")).toHaveTextContent("Your name is claimed on Sepolia.");
    expect(MOCK_WORLD_VERIFY).not.toHaveProperty("label");
  });

  it("shows a write error and stays put when launch fails", async () => {
    const user = userEvent.setup();
    const issued: string[] = [];
    renderIssue(MOCK_RETURNING_SESSION, {
      launchProphecy: async () => {
        throw new Error("Slippage");
      },
      onIssued: (id) => issued.push(id),
    });
    await fillReturningForm(user);
    await user.click(launchButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(WRITE_COPY.failed));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Transaction failed. Nothing was charged except gas. Try again.",
    );
    expect(issued).toEqual([]);
    expect(launchButton()).toBeEnabled();
  });

  it("shows the launched-missing banner and does not navigate when Launched cannot be parsed", async () => {
    const user = userEvent.setup();
    const issued: string[] = [];
    renderIssue(MOCK_RETURNING_SESSION, {
      launchProphecy: async () => {
        throw new LaunchedParseError();
      },
      onIssued: (id) => issued.push(id),
    });
    await fillReturningForm(user);
    await user.click(launchButton());
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(WRITE_COPY.launchedMissing));
    expect(issued).toEqual([]);
    expect(launchButton()).toBeEnabled();
  });

  it("navigates with the launched token address only after a successful write", async () => {
    const user = userEvent.setup();
    const issued: string[] = [];
    const token = "0x1111111111111111111111111111111111111111" as const;
    let seen: LaunchInput | undefined;
    renderIssue(MOCK_RETURNING_SESSION, {
      launchProphecy: async (input) => {
        seen = input;
        return token;
      },
      onIssued: (id) => issued.push(id),
    });
    await fillReturningForm(user);
    await user.click(launchButton());
    await waitFor(() => expect(issued).toEqual([token]));
    expect(seen?.slug).toBe("coffee-last");
    expect(seen?.prophecy).toBe("Coffee lasts until the last pitch");
    expect(seen).toEqual({ slug: "coffee-last", prophecy: "Coffee lasts until the last pitch" });
    // The deployed launch still takes a legacy deadline; the Issue screen always sends 0.
    expect(launchWrite(seen!, token).args[2]).toBe(0n);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("write-success")).toHaveTextContent(WRITE_COPY.launchSuccess);
  });

  it("does not show a memo remaining counter on the launch form", async () => {
    renderIssue(MOCK_RETURNING_SESSION);
    expect(screen.queryByTestId("memo-left")).toBeNull();
    expect(screen.queryByLabelText(/^Memo$/i)).toBeNull();
    expect(document.body.textContent).not.toContain("140 left");
  });

  it("does not show a memo remaining counter on the launch form", () => {
    renderIssue(MOCK_RETURNING_SESSION);
    expect(screen.queryByTestId("memo-left")).toBeNull();
    expect(screen.queryByLabelText(/^Memo$/i)).toBeNull();
    expect(document.body.textContent).not.toContain("140 left");
  });

  it("does not show a first-buy field on the launch form", async () => {
    renderIssue(MOCK_RETURNING_SESSION);
    expect(screen.queryByLabelText(/First buy/i)).toBeNull();
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

  it("hides launch until registerProphet succeeds", async () => {
    const user = userEvent.setup();
    const launched: LaunchInput[] = [];
    renderIssue(MOCK_ISSUE_SESSION, {
      registerProphet: async () => undefined,
      launchProphecy: async (input) => {
        launched.push(input);
        return null;
      },
    });
    await fillFirstTimeForm(user);
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(launchButton()).toBeEnabled());
    expect(screen.queryByTestId("launch-submit")).toBeNull();
    expect(screen.getByTestId("register-submit")).toBeEnabled();
    await user.click(launchButton());
    await waitFor(() => expect(screen.getByTestId("register-success")).toBeInTheDocument());
    expect(launched).toEqual([]);
    expect(screen.getByTestId("launch-submit")).toBeEnabled();
  });

  it("skips registerProphet when prophetOf already returns a label", async () => {
    const user = userEvent.setup();
    const registered: RegisterProphetInput[] = [];
    const issued: string[] = [];
    renderIssue(MOCK_ISSUE_SESSION, {
      lookupProphet: async () => "mina",
      registerProphet: async (input) => {
        registered.push(input);
      },
      onIssued: (id) => issued.push(id),
    });
    await waitFor(() => expect(screen.getByLabelText(/Prophet name/i)).toHaveValue("mina"));
    await fillReturningForm(user);
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(screen.getByTestId("launch-submit")).toBeEnabled();
    await user.click(launchButton());
    await waitFor(() => expect(issued).toHaveLength(1));
    expect(registered).toEqual([]);
  });

  it("keeps Issue off when the prophecy exceeds the UTF-8 byte limit", async () => {
    const user = userEvent.setup();
    renderIssue(MOCK_RETURNING_SESSION);
    await user.click(screen.getByLabelText(/^Prophecy$/i));
    await user.paste("한".repeat(47));
    await user.type(screen.getByLabelText(/^Slug$/i), "coffee-last");
    expect(launchButton()).toBeDisabled();
    expect(screen.queryByTestId("launch-submit")).toBeNull();
  });

  it("does not enable Issue on a first-time path with an empty form after success", async () => {
    const user = userEvent.setup();
    renderIssue();

    expect(launchButton()).toHaveTextContent(ISSUE_COPY.disabledLaunch);
    await user.click(await screen.findByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(screen.getByText(/Verified/)).toBeInTheDocument());
    expect(launchButton()).toBeDisabled();
  });
});
