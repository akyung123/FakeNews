import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { App } from "../App";
import { auctionStatusCopy, CCA_COPY } from "../lib/cca/copy";
import type { MarketSnapshot } from "../lib/cca/loadAuction";
import { follow, getFollowing } from "../lib/following";
import type { Coin } from "../lib/store";
import { Web3Provider } from "../providers/Web3Provider";
import { MyPage, type MyPageProps } from "./MyPage";

const TOKEN_OLD = "0xaaaa00000000000000000000000000000000aaaa" as Address;
const TOKEN_NEW = "0xbbbb00000000000000000000000000000000bbbb" as Address;

function coin(token: Address, slug: string, prophecy: string, block: number): Coin {
  return {
    id: token,
    token,
    name: `${slug}.alice.prophecy.eth`,
    ticker: slug.toUpperCase(),
    prophecy,
    creator: "alice",
    createdAt: block * 1000,
    sold: 0,
    ethRaised: 0,
    history: [],
    fromChain: true,
    launchedBlock: block,
  };
}

const coins = [
  coin(TOKEN_OLD, "old-one", "The old line", 10),
  coin(TOKEN_NEW, "new-one", "The newest line", 30),
];

const market: MarketSnapshot = {
  token: TOKEN_NEW,
  status: "live",
  statusVars: { blocks: 5 },
  priceLabel: CCA_COPY.currentClearingPrice,
  priceWei: 1n,
  history: [],
};

function renderMe(props: MyPageProps) {
  return render(
    <Web3Provider>
      <MemoryRouter initialEntries={["/me"]}>
        <MyPage {...props} />
      </MemoryRouter>
    </Web3Provider>,
  );
}

describe("My page following", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("shows the empty state with a link home", () => {
    renderMe({ loadLaunched: async () => coins });
    const section = document.getElementById("following")!;
    expect(section.querySelector(".block-head")!.textContent).toBe("Followingsaved in this browser");
    expect(screen.getByText(/You're not following any prophets yet\./)).toHaveClass("empty");
    expect(screen.getByRole("link", { name: "Browse prophecies" })).toHaveAttribute("href", "/");
  });

  it("lists each prophet with the latest prophecy, its stage and links", async () => {
    const user = userEvent.setup();
    follow("alice");
    follow("quiet");
    const loadMarkets = vi.fn(async () => new Map([[TOKEN_NEW, market]]));
    renderMe({ loadLaunched: async () => coins, loadMarkets });

    expect(await screen.findByText("The newest line")).toBeInTheDocument();
    expect(screen.queryByText("The old line")).toBeNull();
    expect(await screen.findByText(auctionStatusCopy("live", { blocks: 5 }))).toHaveClass("hold");
    expect(loadMarkets).toHaveBeenCalledWith([{ token: TOKEN_NEW, auction: undefined }]);

    const items = document.querySelectorAll("#following ul.posts > li.post");
    expect(items).toHaveLength(2);
    // Newest follow first.
    expect(items[0].textContent).toContain("quiet.prophecy.eth");
    expect(items[0].textContent).toContain("This prophet has not written one yet.");
    expect(items[0].querySelector(".hold")).toBeNull();

    expect(screen.getByRole("link", { name: "Open prophecy" })).toHaveAttribute(
      "href",
      "/n/new-one.alice.prophecy.eth",
    );
    expect(screen.getAllByRole("link", { name: "Prophet page" })[1]).toHaveAttribute("href", "/p/alice");

    await user.click(screen.getAllByRole("button", { name: "Unfollow" })[0]);
    expect(getFollowing()).toEqual(["alice"]);
  });

  it("shows value cards in ETH with the fee card only for a prophet", async () => {
    // No wallet in tests: the cards ask for one.
    renderMe({ loadHoldings: async () => ({ holdingsValueWei: 0n, tokensHeldWei: 0n, bidSpentWei: 0n, feesWei: null }) });
    expect(screen.getByText("Connect a wallet to see your holdings.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/USD|\$/);
  });
});

describe("sidebar Following link", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  function renderApp(path: string) {
    return render(
      <Web3Provider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </Web3Provider>,
    );
  }

  it("sits under My prophecies with a spaced count and its own active state", async () => {
    follow("alice");
    follow("bob");
    const { unmount } = renderApp("/me#following");
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = [...nav.querySelectorAll("a")];
    const mine = links.find((a) => a.textContent?.startsWith("My prophecies"))!;
    const following = links.find((a) => a.textContent?.startsWith("Following"))!;
    expect(links.indexOf(following)).toBe(links.indexOf(mine) + 1);
    expect(following.getAttribute("href")).toBe("/me#following");
    expect(following.textContent).toBe("Following 2");
    expect(following).toHaveClass("active");
    expect(mine).not.toHaveClass("active");
    unmount();

    renderApp("/me");
    const nav2 = screen.getByRole("navigation", { name: "Main" });
    const links2 = [...nav2.querySelectorAll("a")];
    expect(links2.find((a) => a.textContent?.startsWith("My prophecies"))).toHaveClass("active");
    expect(links2.find((a) => a.textContent?.startsWith("Following"))).not.toHaveClass("active");
    await waitFor(() => expect(document.getElementById("following")).not.toBeNull());
  });

  it("never shows a prophet name link without a connected wallet", () => {
    renderApp("/");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.textContent).not.toContain(".prophecy.eth");
    expect(nav.querySelector('a[href^="/p/"]')).toBeNull();
  });
});
