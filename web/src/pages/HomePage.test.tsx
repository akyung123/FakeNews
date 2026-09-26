import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { coinsFromLaunchedLogs } from "../lib/launched";
import type { Coin } from "../lib/store";
import { HomePage } from "./HomePage";

const TOKEN = "0x1111111111111111111111111111111111111111" as const;
const PROPHET = "0x2222222222222222222222222222222222222222" as const;

function launched(slug: string, token: `0x${string}`) {
  return coinsFromLaunchedLogs([{ args: { token, prophet: PROPHET, prophetLabel: "ringo", slug } }])[0]!;
}

/** Auction still running: the row was read before its end block. */
function running(coin: Coin, launchedBlock = 100): Coin {
  return { ...coin, launchedBlock, endBlock: launchedBlock + 10, readBlock: launchedBlock + 2 };
}

/** Auction over: the row was read after its end block. */
function over(coin: Coin, launchedBlock = 50, marketOpen = false): Coin {
  return { ...coin, launchedBlock, endBlock: launchedBlock + 10, readBlock: launchedBlock + 40, marketOpen };
}

function renderHome(coins: Coin[]) {
  return render(
    <MemoryRouter>
      <HomePage loadLaunched={async () => coins} />
    </MemoryRouter>,
  );
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
    const live = running({ ...launched("lingo-2028", TOKEN), ethRaised: 0.01 });
    const ended = over({
      ...launched("wifi-down", "0x3333333333333333333333333333333333333333"),
      ethRaised: 0.02,
      complete: true,
    });
    renderHome([live, ended]);
    await waitFor(() => expect(document.querySelector(".featured-kicker")).toHaveTextContent("Auction live"));
    expect(screen.getByText("Raised 0.01 ETH")).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("Curve");
    expect(text.toLowerCase()).not.toContain("graduat");
    expect(text).not.toContain("Closest to graduation");
  });

  it("hides the raised line when nothing has been raised yet", async () => {
    renderHome([running(launched("lingo-2028", TOKEN))]);
    await waitFor(() => expect(document.querySelector(".featured-kicker")).toHaveTextContent("Auction live"));
    expect(screen.queryByText(/^Raised /)).toBeNull();
  });

  it("shows exact raised wei without float noise and hides an unknown launch time", async () => {
    const live = running({ ...launched("lingo-2028", TOKEN), raisedWei: 40_000_000_000_000_001n });
    renderHome([live]);
    await waitFor(() => expect(screen.getByText("Raised 0.04 ETH")).toBeInTheDocument());
    expect(document.body.textContent).not.toContain("ago");
    expect(document.body.textContent).not.toContain("gwei");
  });

  it("puts the name on the first line and the ticker and date on the second", async () => {
    const featured = running({ ...launched("lingo-2028", TOKEN), raisedWei: 10_000_000_000_000_000n });
    const card = {
      ...launched("wifi-down", "0x3333333333333333333333333333333333333333"),
      createdAt: Date.now() - 5 * 60_000,
    };
    renderHome([featured, card]);
    await waitFor(() => expect(screen.getByText("$WIFI-DOWN")).toBeInTheDocument());
    const head = document.querySelector(".token-grid .launch-head")!;
    expect(head.querySelector(".launch-name")).toHaveTextContent("wifi-down");
    expect(head.querySelector(".launch-meta")).toHaveTextContent("$WIFI-DOWN");
    expect(head.querySelector(".launch-meta")).toHaveTextContent("5m ago");
  });

  it("keeps an ended auction in Just launched", async () => {
    const live = running(launched("lingo-2028", TOKEN));
    const ended = over({
      ...launched("wifi-down", "0x3333333333333333333333333333333333333333"),
      complete: true,
    });
    renderHome([live, ended]);
    await waitFor(() => expect(screen.getByText("$WIFI-DOWN")).toBeInTheDocument());
    expect(document.querySelectorAll(".token-grid .launch").length).toBe(1);
  });
});

describe("Featured card follows the auction end block", () => {
  const OTHER = "0x3333333333333333333333333333333333333333" as const;
  const THIRD = "0x4444444444444444444444444444444444444444" as const;

  it("features the newest running auction, never an ended one", async () => {
    const older = running(launched("older-live", TOKEN), 100);
    const newer = running(launched("newer-live", OTHER), 200);
    const endedNewest = over(launched("ended-new", THIRD), 300);
    renderHome([older, newer, endedNewest]);
    await waitFor(() => expect(document.querySelector(".featured")).toBeInTheDocument());
    expect(document.querySelector(".featured")).toHaveTextContent("newer-live");
    expect(document.querySelector(".featured")).not.toHaveTextContent("ended-new");
  });

  it("says No live auction when every auction has ended", async () => {
    renderHome([over(launched("wifi-down", OTHER)), over(launched("lingo-2028", TOKEN), 60, true)]);
    await waitFor(() => expect(screen.getByTestId("no-live-auction")).toHaveTextContent("No live auction"));
    expect(document.querySelectorAll(".token-grid .launch")).toHaveLength(2);
  });

  it("badges ended auctions Ended or Market open", async () => {
    renderHome([
      running(launched("lingo-2028", TOKEN), 100),
      over(launched("wifi-down", OTHER), 50),
      over(launched("open-pool", THIRD), 40, true),
    ]);
    await waitFor(() => expect(screen.getByText("Ended")).toBeInTheDocument());
    expect(screen.getByText("Market open")).toBeInTheDocument();
    const names = [...document.querySelectorAll(".token-grid .launch-name .token-slug")].map((n) => n.textContent);
    expect(names).toEqual(["wifi-down", "open-pool"]);
  });

  it("does not feature a row whose auction was never read", async () => {
    renderHome([launched("lingo-2028", TOKEN)]);
    await waitFor(() => expect(screen.getByTestId("no-live-auction")).toBeInTheDocument());
  });
});
