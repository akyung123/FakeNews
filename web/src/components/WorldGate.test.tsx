import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ISSUE_COPY, type WorldStatus } from "../lib/issue";
import { MOCK_WORLD_HEALTH, MOCK_WORLD_LAUNCHPAD } from "../lib/mock";
import { createWorldClient, type WorldErrorKind } from "../lib/world";
import { WorldGate } from "./WorldGate";

function renderGate(fetch: typeof globalThis.fetch) {
  const live = createWorldClient({ mock: false, serverUrl: "http://world.test", launchpad: MOCK_WORLD_LAUNCHPAD, fetch });
  const statuses: WorldStatus[] = [];
  const kinds: WorldErrorKind[] = [];
  render(
    <WorldGate
      returningProphet={false}
      prophetName="ringo.prophecy.eth"
      wallet="0x2222222222222222222222222222222222222222"
      world={live}
      status="idle"
      onStatus={(s) => statuses.push(s)}
      onErrorKind={(k) => kinds.push(k)}
      onVerified={() => {}}
    />,
  );
  return { statuses, kinds };
}

describe("WorldGate server fallback", () => {
  it("uses the existing mock World step when the signature server answers with an error", async () => {
    renderGate(async () => new Response("", { status: 503 }));
    await waitFor(() => expect(screen.getByText(ISSUE_COPY.prove)).toBeInTheDocument());
    expect(screen.getByText(/Mock World ID/)).toBeInTheDocument();
  });

  it("reports a blocked World server instead of switching to mock, and recovers on retry", async () => {
    const user = userEvent.setup();
    let blocked = true;
    const { statuses, kinds } = renderGate(async () => {
      if (blocked) throw new TypeError("Failed to fetch");
      return Response.json(MOCK_WORLD_HEALTH);
    });

    await waitFor(() => expect(kinds).toEqual(["blocked"]));
    expect(statuses).toEqual(["failed"]);
    expect(screen.queryByText(/Mock World ID/)).toBeNull();
    expect(screen.queryByText(ISSUE_COPY.prove)).toBeNull();

    blocked = false;
    await user.click(screen.getByRole("button", { name: ISSUE_COPY.retry }));
    await waitFor(() => expect(screen.getByText(ISSUE_COPY.prove)).toBeInTheDocument());
    expect(screen.queryByText(/Mock World ID/)).toBeNull();
    expect(statuses).toEqual(["failed", "pending", "idle"]);
  });
});
