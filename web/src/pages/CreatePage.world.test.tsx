import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ISSUE_COPY } from "../lib/issue";
import { MOCK_ISSUE_SESSION, MOCK_RP_CONTEXT_RESPONSE, MOCK_WORLD_HEALTH, MOCK_WORLD_LAUNCHPAD } from "../lib/mock";
import { IssueScreen } from "./CreatePage";

const calls = vi.hoisted(() => ({ created: 0, health: 0, signals: [] as string[] }));

vi.mock("@worldcoin/idkit", () => ({
  IDKitRequestWidget: ({ onError }: { onError: (code: string) => void }) => (
    <div data-testid="idkit-widget">
      <button type="button" onClick={() => onError("nullifier_replayed")}>
        World App refuses
      </button>
    </div>
  ),
  proofOfHuman: ({ signal }: { signal: string }) => {
    calls.signals.push(signal);
    return {};
  },
}));

vi.mock("../lib/world", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/world")>();
  return {
    ...actual,
    // Live client, as on the deployed site: every call builds a new object.
    createWorldClient: () => {
      calls.created += 1;
      return actual.createWorldClient({
        mock: false,
        serverUrl: "http://world.test",
        launchpad: MOCK_WORLD_LAUNCHPAD,
        fetch: async (input) => {
          const url = String(input);
          if (url.endsWith("/health")) {
            calls.health += 1;
            return Response.json(MOCK_WORLD_HEALTH);
          }
          return Response.json(MOCK_RP_CONTEXT_RESPONSE);
        },
      });
    },
  };
});

describe("Screen 2 live World ID", () => {
  it("keeps the World ID widget open when the screen re-renders after the prove click", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IssueScreen session={MOCK_ISSUE_SESSION} lookupProphet={async () => ""} />
      </MemoryRouter>,
    );

    const prove = await screen.findByRole("button", { name: ISSUE_COPY.prove });
    await user.type(screen.getByLabelText(/Prophet name/i), "mina");
    await user.click(prove);

    expect(await screen.findByTestId("idkit-widget")).toBeInTheDocument();
    // Before the fix, each re-render built a new client, rechecked /health
    // and unmounted the widget.
    await waitFor(() => expect(calls.health).toBe(1));
    expect(screen.getByTestId("idkit-widget")).toBeInTheDocument();
    expect(calls.created).toBe(1);
    // The proof is bound to the same wallet that later sends registerProphet.
    expect(calls.signals.length).toBeGreaterThan(0);
    expect(new Set(calls.signals)).toEqual(new Set([MOCK_ISSUE_SESSION.wallet]));
  });

  it("tells a person whose World ID was already used to connect the wallet that holds the name", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <IssueScreen session={MOCK_ISSUE_SESSION} lookupProphet={async () => ""} />
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole("button", { name: ISSUE_COPY.prove }));
    await user.click(await screen.findByRole("button", { name: "World App refuses" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(ISSUE_COPY.alreadyVerified));
    expect(screen.getByRole("alert")).not.toHaveTextContent(ISSUE_COPY.checkFailed);
    expect(document.body.textContent).not.toContain("nullifier_replayed");
  });
});
