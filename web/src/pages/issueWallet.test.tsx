import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ISSUE_COPY, readStoredProphetLabel } from "../lib/issue";
import type { RegisterProphetInput } from "../lib/launchpad";
import { MOCK_ISSUE_SESSION, MOCK_WORLD_VERIFY } from "../lib/mock";
import { CreatePage } from "./CreatePage";
import { NamePage } from "./NamePage";

const WALLET_A = "0xC0ffee254729296a45a3885639AC7E10F9d54979" as const;
const WALLET_B = "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E" as const;

const chain = vi.hoisted(() => ({
  account: { address: undefined as `0x${string}` | undefined, status: "disconnected" as string },
  /** prophetOf state, keyed by lowercased wallet. */
  names: new Map<string, string>(),
  lookupFails: 0,
  lookups: [] as string[],
  verifies: [] as string[],
  registers: [] as RegisterProphetInput[],
}));

vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return { ...actual, useAccount: () => chain.account };
});

// Chain mode: the Launchpad is deployed.
vi.mock("../lib/mode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/mode")>();
  return { ...actual, isMockMode: () => false };
});

vi.mock("../lib/launchpad", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/launchpad")>();
  return {
    ...actual,
    createReadProphetOf: () => async (wallet: string) => {
      chain.lookups.push(wallet);
      if (chain.lookupFails > 0) {
        chain.lookupFails -= 1;
        throw new Error("HTTP request failed");
      }
      return chain.names.get(wallet.toLowerCase()) ?? "";
    },
    createRegisterProphet: () => async (input: RegisterProphetInput) => {
      chain.registers.push(input);
      chain.names.set(input.wallet.toLowerCase(), input.label);
    },
  };
});

vi.mock("../lib/world", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/world")>();
  return {
    ...actual,
    createWorldClient: () => {
      const base = actual.createWorldClient({ mock: true });
      return {
        ...base,
        async verifyProof(input: { wallet: string }) {
          chain.verifies.push(input.wallet);
          return { ...MOCK_WORLD_VERIFY };
        },
      };
    },
  };
});

function connect(address: `0x${string}` | undefined) {
  chain.account = address ? { address, status: "connected" } : { address: undefined, status: "disconnected" };
}

function renderAt(path: string) {
  const tree = () => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/create" element={<CreatePage />} />
        <Route path="/name" element={<NamePage />} />
      </Routes>
    </MemoryRouter>
  );
  const result = render(tree());
  return { ...result, rerenderPage: () => result.rerender(tree()) };
}

function issueButton() {
  return screen.getByRole("button", {
    name: (name) =>
      name === ISSUE_COPY.launch ||
      name === ISSUE_COPY.register ||
      name === ISSUE_COPY.disabledLaunch ||
      name === ISSUE_COPY.connectWallet,
  });
}

async function fillFirstTime(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Prophet name/i), "mina");
  await user.type(screen.getByLabelText(/^Prophecy$/i), "Coffee lasts until the last pitch");
  await user.type(screen.getByLabelText(/^Short name$/i), "coffee-last");
}

beforeEach(() => {
  connect(undefined);
  chain.names.clear();
  chain.lookupFails = 0;
  chain.lookups.length = 0;
  chain.verifies.length = 0;
  chain.registers.length = 0;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("/create in chain mode uses the connected wallet", () => {
  it("asks for a wallet before the World step and keeps Issue off", async () => {
    renderAt("/create");
    expect(screen.getByTestId("wallet-gate")).toHaveTextContent(ISSUE_COPY.connectWallet);
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(issueButton()).toBeDisabled();
    expect(issueButton()).toHaveTextContent(ISSUE_COPY.connectWallet);
    expect(chain.lookups).toEqual([]);
  });

  it("sends the connected address to prophetOf, World verify and registerProphet, then switches to returning", async () => {
    const user = userEvent.setup();
    connect(WALLET_A);
    // ?fresh=1 is a mock-only switch; chain mode still uses the wallet.
    renderAt("/create?fresh=1");

    await user.click(await screen.findByRole("button", { name: ISSUE_COPY.prove }));
    await fillFirstTime(user);
    await waitFor(() => expect(issueButton()).toBeEnabled());
    expect(chain.verifies).toEqual([WALLET_A]);
    expect(chain.verifies).not.toContain(MOCK_ISSUE_SESSION.wallet);

    await user.click(issueButton());
    await waitFor(() => expect(screen.getByTestId("register-success")).toBeInTheDocument());
    expect(chain.registers).toEqual([
      {
        wallet: WALLET_A,
        label: "mina",
        nullifier: MOCK_WORLD_VERIFY.nullifier,
        serverSig: MOCK_WORLD_VERIFY.serverSig,
      },
    ]);

    // prophetOf is read again for the same wallet right after the claim.
    await waitFor(() => expect(chain.lookups).toEqual([WALLET_A, WALLET_A]));
    await waitFor(() => expect(screen.getByTestId("step-launch")).toHaveAttribute("aria-current", "step"));
    expect(screen.queryByTestId("world-gate")).toBeNull();
    expect(screen.getByLabelText(/Prophet name/i)).toHaveValue("mina");
    expect(screen.getByLabelText(/Prophet name/i)).toHaveAttribute("readonly");
    expect(screen.getByTestId("launch-submit")).toBeEnabled();
    expect(screen.getByTestId("launch-submit")).toHaveTextContent(ISSUE_COPY.launch);
    expect(readStoredProphetLabel(WALLET_A)).toBe("mina");
    expect(readStoredProphetLabel(WALLET_B)).toBeNull();
  });

  it("never shows the World step to a wallet that already has a name", async () => {
    chain.names.set(WALLET_A.toLowerCase(), "ringo");
    connect(WALLET_A);
    renderAt("/create");

    // Not while prophetOf is still loading either.
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(screen.getByTestId("prophet-lookup-pending")).toHaveTextContent(ISSUE_COPY.checkingWallet);

    await waitFor(() => expect(screen.getByTestId("world-gate")).toHaveTextContent(ISSUE_COPY.returning));
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(screen.getByLabelText(/Prophet name/i)).toHaveValue("ringo");
    expect(screen.getByTestId("world-gate")).toHaveTextContent("ringo.");
    expect(chain.lookups).toEqual([WALLET_A]);
    expect(chain.verifies).toEqual([]);
  });

  it("keeps the typed inputs when the wallet reconnects after a reload", async () => {
    const user = userEvent.setup();
    const { rerenderPage } = renderAt("/create");
    await fillFirstTime(user);

    connect(WALLET_A);
    rerenderPage();

    expect(await screen.findByRole("button", { name: ISSUE_COPY.prove })).toBeInTheDocument();
    expect(screen.getByLabelText(/Prophet name/i)).toHaveValue("mina");
    expect(screen.getByLabelText(/^Prophecy$/i)).toHaveValue("Coffee lasts until the last pitch");
    expect(screen.getByLabelText(/^Short name$/i)).toHaveValue("coffee-last");
  });

  it("drops the World result and re-reads prophetOf when the wallet changes", async () => {
    const user = userEvent.setup();
    connect(WALLET_A);
    const { rerenderPage } = renderAt("/create");
    await user.click(await screen.findByRole("button", { name: ISSUE_COPY.prove }));
    await fillFirstTime(user);
    await waitFor(() => expect(issueButton()).toBeEnabled());

    connect(WALLET_B);
    rerenderPage();

    await waitFor(() => expect(chain.lookups).toEqual([WALLET_A, WALLET_B]));
    expect(await screen.findByRole("button", { name: ISSUE_COPY.prove })).toBeInTheDocument();
    expect(screen.queryByText(/Verified/)).toBeNull();
    expect(screen.getByLabelText(/Prophet name/i)).toHaveValue("");
    expect(issueButton()).toBeDisabled();
    expect(issueButton()).toHaveTextContent(ISSUE_COPY.disabledLaunch);

    await user.type(screen.getByLabelText(/Prophet name/i), "mina");
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.prove }));
    await waitFor(() => expect(issueButton()).toBeEnabled());
    await user.click(issueButton());
    await waitFor(() => expect(chain.registers).toHaveLength(1));
    expect(chain.verifies).toEqual([WALLET_A, WALLET_B]);
    expect(chain.registers[0]!.wallet).toBe(WALLET_B);
  });

  it("shows a retry when prophetOf fails instead of treating the wallet as new", async () => {
    const user = userEvent.setup();
    chain.lookupFails = 1;
    chain.names.set(WALLET_A.toLowerCase(), "ringo");
    connect(WALLET_A);
    renderAt("/create");

    await waitFor(() => expect(screen.getByTestId("prophet-lookup-failed")).toHaveTextContent(ISSUE_COPY.lookupFailed));
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(issueButton()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: ISSUE_COPY.retry }));
    await waitFor(() => expect(screen.getByTestId("world-gate")).toHaveTextContent(ISSUE_COPY.returning));
    expect(screen.queryByTestId("prophet-lookup-failed")).toBeNull();
    expect(chain.lookups).toEqual([WALLET_A, WALLET_A]);
  });
});

describe("/name in chain mode uses the connected wallet", () => {
  it("asks for a wallet first", () => {
    renderAt("/name");
    expect(screen.getByTestId("wallet-gate")).toHaveTextContent(ISSUE_COPY.connectWallet);
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(screen.getByRole("button", { name: ISSUE_COPY.connectWallet })).toBeDisabled();
  });

  it("claims the name for the connected wallet", async () => {
    const user = userEvent.setup();
    connect(WALLET_A);
    renderAt("/name?fresh=1");
    await user.click(await screen.findByRole("button", { name: ISSUE_COPY.prove }));
    await user.type(screen.getByLabelText(/^Name$/i), "mina");
    const next = screen.getByRole("button", { name: ISSUE_COPY.continueIssue });
    await waitFor(() => expect(next).toBeEnabled());
    await user.click(next);
    await waitFor(() => expect(chain.registers).toHaveLength(1));
    expect(chain.lookups[0]).toBe(WALLET_A);
    expect(chain.verifies).toEqual([WALLET_A]);
    expect(chain.registers[0]!.wallet).toBe(WALLET_A);
    // Back on /create the same wallet is now a returning prophet.
    await waitFor(() => expect(screen.getByTestId("world-gate")).toHaveTextContent(ISSUE_COPY.returning));
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
  });

  it("skips the World step for a wallet that already has a name", async () => {
    chain.names.set(WALLET_A.toLowerCase(), "ringo");
    connect(WALLET_A);
    renderAt("/name");
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    await waitFor(() => expect(screen.getByTestId("world-gate")).toHaveTextContent(ISSUE_COPY.returning));
    expect(screen.queryByRole("button", { name: ISSUE_COPY.prove })).toBeNull();
    expect(screen.getByRole("button", { name: ISSUE_COPY.oneTransaction })).toBeEnabled();
    expect(screen.getByLabelText(/^Name$/i)).toHaveValue("ringo");
  });
});
