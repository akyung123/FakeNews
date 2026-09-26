import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { coinsFromLaunchedLogs } from "../lib/launched";
import { HomePage } from "./HomePage";

const TOKEN = "0x1111111111111111111111111111111111111111" as const;

describe("Acceptance #8 — chain-mode home list", () => {
  it("shows at least one token from mocked Launched logs", async () => {
    const coins = coinsFromLaunchedLogs([
      {
        args: {
          token: TOKEN,
          prophet: "0x2222222222222222222222222222222222222222",
          prophetLabel: "ringo",
          slug: "lingo-2028",
        },
      },
    ]);
    expect(coins.length).toBeGreaterThanOrEqual(1);
    render(
      <MemoryRouter>
        <HomePage loadLaunched={async () => coins} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("$LINGO-2028")).toBeInTheDocument());
    expect(document.querySelectorAll(".launch").length).toBeGreaterThanOrEqual(1);
    expect(document.body.textContent).toContain("ringo");
  });
});
