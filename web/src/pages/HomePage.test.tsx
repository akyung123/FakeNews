import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { coinsFromLaunchedLogs } from "../lib/launched";
import type { Coin } from "../lib/store";
import { HomePage } from "./HomePage";

const TOKEN = "0x1111111111111111111111111111111111111111" as const;
const PROPHET = "0x2222222222222222222222222222222222222222" as const;
const GOAL_WEI = 20_000_000_000_000_000n;

function launched(slug: string, token: `0x${string}`, blockNumber?: bigint) {
  return coinsFromLaunchedLogs([{ args: { token, prophet: PROPHET, prophetLabel: "ringo", slug }, blockNumber }])[0]!;
}

function token(n: number): `0x${string}` {
  return `0x${n.toString(16).padStart(40, "0")}`;
}

/** Auction read at block 100: live ends later, the others ended at block 90. */
function live(slug: string, n: number, extra: Partial<Coin> = {}): Coin {
  return { ...launched(slug, token(n), BigInt(n)), endBlock: 200, readBlock: 100, ...extra };
}
function refunded(slug: string, n: number, extra: Partial<Coin> = {}): Coin {
  return { ...launched(slug, token(n), BigInt(n)), endBlock: 90, readBlock: 100, raisedWei: GOAL_WEI / 20n, ...extra };
}
function marketOpen(slug: string, n: number, extra: Partial<Coin> = {}): Coin {
  return {
    ...launched(slug, token(n), BigInt(n)),
    endBlock: 90,
    readBlock: 100,
    raisedWei: GOAL_WEI,
    complete: true,
    marketOpen: true,
    ...extra,
  };
}

function renderHome(coins: Coin[]) {
  return render(
    <MemoryRouter>
      <HomePage loadLaunched={async () => coins} />
    </MemoryRouter>,
  );
}

function card(slug: string): HTMLElement {
  const el = [...document.querySelectorAll<HTMLElement>(".token-grid .launch")].find(
    (c) => c.querySelector(".token-slug")?.textContent === slug,
  );
  if (!el) throw new Error(`no card for ${slug}`);
  return el;
}

function gridSlugs(): string[] {
  return [...document.querySelectorAll(".token-grid .launch .token-slug")].map((el) => el.textContent ?? "");
}

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

describe("Home copy follows the auction flow", () => {
  it("shows Auction live and the ETH raised, with no curve or graduation words", async () => {
    renderHome([live("lingo-2028", 2, { ethRaised: 0.01 }), marketOpen("wifi-down", 1, { ethRaised: 0.02 })]);
    await waitFor(() => expect(document.querySelector(".featured")).not.toBeNull());
    expect(document.querySelector(".featured .stage-badge")).toHaveTextContent("Auction live");
    expect(screen.getByText("Raised 0.01 ETH")).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("Curve");
    expect(text.toLowerCase()).not.toContain("graduat");
    expect(text).not.toContain("Closest to graduation");
  });

  it("hides the raised line when nothing has been raised yet", async () => {
    renderHome([live("lingo-2028", 1)]);
    await waitFor(() => expect(screen.getByText("Auction live")).toBeInTheDocument());
    expect(screen.queryByText(/^Raised /)).toBeNull();
  });

  it("shows exact raised wei without float noise and hides an unknown launch time", async () => {
    renderHome([live("lingo-2028", 1, { raisedWei: 40_000_000_000_000_001n })]);
    await waitFor(() => expect(screen.getByText("Raised 0.04 ETH")).toBeInTheDocument());
    expect(document.body.textContent).not.toContain("ago");
    expect(document.body.textContent).not.toContain("gwei");
  });

  it("puts the name on the first line and the ticker and date on the second", async () => {
    const card = { ...live("wifi-down", 1), createdAt: Date.now() - 5 * 60_000 };
    renderHome([live("lingo-2028", 2, { raisedWei: 10_000_000_000_000_000n }), card]);
    await waitFor(() => expect(screen.getByText("$WIFI-DOWN")).toBeInTheDocument());
    const head = document.querySelector(".token-grid .launch-head")!;
    expect(head.querySelector(".launch-name")).toHaveTextContent("wifi-down");
    expect(head.querySelector(".launch-meta")).toHaveTextContent("$WIFI-DOWN");
    expect(head.querySelector(".launch-date")).toHaveTextContent("5m ago");
  });

  it("keeps an ended auction in Just launched", async () => {
    renderHome([live("lingo-2028", 2), refunded("wifi-down", 1)]);
    await waitFor(() => expect(screen.getByText("$WIFI-DOWN")).toBeInTheDocument());
    expect(gridSlugs()).toEqual(["wifi-down"]);
  });
});

describe("Home prices", () => {
  it("reads a sub-1e-6 ETH price in gwei on the featured card and the list", async () => {
    // 4e-11 ETH is the auction floor: 40,000,000 wei = 0.04 gwei.
    renderHome([live("lingo-2028", 2, { priceWei: 40_000_000n }), live("wifi-down", 1, { priceWei: 161_500_000n })]);
    await waitFor(() => expect(document.querySelector(".featured")).not.toBeNull());
    expect(document.querySelector(".featured")).toHaveTextContent("Price 0.04 gwei per token");
    expect(card("wifi-down")).toHaveTextContent("0.1615 gwei per token");
    expect(document.body.textContent).not.toContain("0.0000");
  });
});

describe("Home featured card", () => {
  it("never features an auction that ended below its goal", async () => {
    // Newest launch, but its end block has passed and the goal was missed.
    renderHome([refunded("trump", 3), marketOpen("wifi-down", 1)]);
    await waitFor(() => expect(screen.getByText("$TRUMP")).toBeInTheDocument());
    expect(document.querySelector(".featured .token-slug")).toHaveTextContent("wifi-down");
    expect(document.querySelector(".featured")).not.toHaveTextContent("Auction live");
    expect(card("trump")).toHaveTextContent("Ended · refunded");
  });

  it("features the newest live auction", async () => {
    renderHome([live("older", 1, { raisedWei: GOAL_WEI / 2n }), live("newer", 2), refunded("trump", 3)]);
    await waitFor(() => expect(document.querySelector(".featured")).not.toBeNull());
    expect(document.querySelector(".featured .token-slug")).toHaveTextContent("newer");
    expect(document.querySelector(".featured")).toHaveClass("stage-live");
    expect(document.querySelector(".featured .stage-badge")).toHaveTextContent("Auction live");
  });

  it("features the market that opened last when no auction is live", async () => {
    renderHome([
      marketOpen("first-market", 1, { endBlock: 50 }),
      marketOpen("last-market", 2, { endBlock: 80 }),
      refunded("trump", 3),
    ]);
    await waitFor(() => expect(document.querySelector(".featured")).not.toBeNull());
    expect(document.querySelector(".featured .token-slug")).toHaveTextContent("last-market");
    expect(document.querySelector(".featured")).toHaveClass("stage-market");
    expect(document.querySelector(".featured .stage-badge")).toHaveTextContent("Market open");
  });

  it("does not feature a row whose auction was never read", async () => {
    renderHome([launched("lingo-2028", TOKEN, 1n)]);
    await waitFor(() => expect(screen.getByText("$LINGO-2028")).toBeInTheDocument());
    expect(document.querySelector(".featured")).toBeNull();
    expect(gridSlugs()).toEqual(["lingo-2028"]);
  });

  it("hides the featured card when nothing is live or open", async () => {
    renderHome([refunded("trump", 2), launched("unread", token(1), 1n)]);
    await waitFor(() => expect(screen.getByText("$TRUMP")).toBeInTheDocument());
    expect(document.querySelector(".featured")).toBeNull();
    expect(gridSlugs()).toEqual(["trump", "unread"]);
  });
});

describe("Home list stages", () => {
  const coins = () => [live("lingo-2028", 3), marketOpen("two-min", 2), refunded("trump", 4), live("wifi-down", 1)];

  it("gives each card its stage class and badge text", async () => {
    renderHome(coins());
    await waitFor(() => expect(screen.getByText("$TRUMP")).toBeInTheDocument());
    expect(card("wifi-down")).toHaveClass("stage-live");
    expect(card("wifi-down").querySelector(".stage-badge")).toHaveTextContent("Auction live");
    expect(card("two-min")).toHaveClass("stage-market");
    expect(card("two-min").querySelector(".stage-badge")).toHaveTextContent("Market open");
    expect(card("trump")).toHaveClass("stage-ended");
    expect(card("trump").querySelector(".stage-badge")).toHaveTextContent("Ended · refunded");
  });

  it("fills the bar of an open market", async () => {
    renderHome([live("lingo-2028", 2), marketOpen("two-min", 1, { raisedWei: GOAL_WEI / 2n })]);
    await waitFor(() => expect(screen.getByText("$TWO-MIN")).toBeInTheDocument());
    expect(card("two-min").querySelector('[role="meter"]')).toHaveAttribute("aria-valuenow", "100");
  });

  it("shows no badge while the auction has not been read", async () => {
    renderHome([live("lingo-2028", 2), launched("unread", token(1), 1n)]);
    await waitFor(() => expect(screen.getByText("$UNREAD")).toBeInTheDocument());
    expect(card("unread").querySelector(".stage-badge")).toBeNull();
    expect(card("unread").className).toBe("launch");
  });

  it("lists newest first and filters by stage", async () => {
    renderHome(coins());
    await waitFor(() => expect(screen.getByText("$TRUMP")).toBeInTheDocument());
    // All: newest first, without the featured live auction (lingo-2028) that sits above.
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(gridSlugs()).toEqual(["trump", "two-min", "wifi-down"]);

    fireEvent.click(screen.getByRole("button", { name: "Live" }));
    expect(screen.getByRole("button", { name: "Live" })).toHaveAttribute("aria-pressed", "true");
    expect(gridSlugs()).toEqual(["lingo-2028", "wifi-down"]);

    fireEvent.click(screen.getByRole("button", { name: "Market open" }));
    expect(gridSlugs()).toEqual(["two-min"]);

    fireEvent.click(screen.getByRole("button", { name: "Ended" }));
    expect(gridSlugs()).toEqual(["trump"]);

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(gridSlugs()).toEqual(["trump", "two-min", "wifi-down"]);
  });

  it("says so when a stage has no prophecies", async () => {
    renderHome([live("lingo-2028", 1)]);
    await waitFor(() => expect(screen.getByText("$LINGO-2028")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Ended" }));
    expect(screen.getByText("No auction has ended below its goal.")).toBeInTheDocument();
  });
});
