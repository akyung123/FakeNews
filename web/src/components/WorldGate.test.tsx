import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ISSUE_COPY } from "../lib/issue";
import { MOCK_WORLD_LAUNCHPAD } from "../lib/mock";
import { createWorldClient } from "../lib/world";
import { WorldGate } from "./WorldGate";

describe("WorldGate server fallback", () => {
  it("uses the existing mock World step when the signature server is down", async () => {
    const live = createWorldClient({
      mock: false,
      serverUrl: "http://world.test",
      launchpad: MOCK_WORLD_LAUNCHPAD,
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(live.isMock).toBe(false);
    render(
      <WorldGate
        returningProphet={false}
        prophetName="ringo.prophecy.eth"
        wallet="0x2222222222222222222222222222222222222222"
        world={live}
        status="idle"
        onStatus={() => {}}
        onErrorKind={() => {}}
        onVerified={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText(ISSUE_COPY.prove)).toBeInTheDocument());
    expect(screen.getByText(/Mock World ID/)).toBeInTheDocument();
  });
});
