import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { App } from "../App";
import { auctionStatusCopy, CCA_COPY } from "../lib/cca/copy";
import { POOL_PRICE_LABEL, type MarketSnapshot } from "../lib/cca/loadAuction";
import { follow, getFollowing } from "../lib/following";
import { ethFromWei } from "../lib/format";
import { getProphetPage } from "../lib/prophetData";
import type { Coin } from "../lib/store";
import { Web3Provider } from "../providers/Web3Provider";
import { FollowingPage, followingFeed, prophetLabelOfName, type FollowingPageProps } from "./FollowingPage";

const ALICE_OLD = "0xaaaa00000000000000000000000000000000aaaa" as Address;
const ALICE_NEW = "0xbbbb00000000000000000000000000000000bbbb" as Address;
const BOB = "0xcccc00000000000000000000000000000000cccc" as Address;
const CAROL = "0xdddd00000000000000000000000000000000dddd" as Address;
const ODD = "0xeeee00000000000000000000000000000000eeee" as Address;

function coin(token: Address, name: string, prophecy: string, block: number): Coin {
  const label = name.split(".")[1] ?? "";
  return {
    id: token,
    token,
    name,
    ticker: name.split(".")[0].toUpperCase(),
    prophecy,
    creator: label,
    createdAt: block * 1000,
    sold: 0,
    ethRaised: 0,
    history: [],
    fromChain: true,
    launchedBlock: block,
  };
}

const coins = [
  coin(ALICE_OLD, "old-one.alice.prophecy.eth", "The old line", 10),
  coin(BOB, "bob-one.bob.prophecy.eth", "Bob's only line", 20),
  coin(ALICE_NEW, "new-one.alice.prophecy.eth", "The newest line", 30),
  coin(CAROL, "carol-one.carol.prophecy.eth", "Carol is not followed", 40),
  // Not a `{slug}.{label}.prophecy.eth` name even though it mentions alice.
  coin(ODD, "x.y.alice.prophecy.eth", "Odd name", 50),
];

const markets = new Map<Address, MarketSnapshot>([
  [
    ALICE_NEW,
    {
      token: ALICE_NEW,
      status: "live",
      statusVars: { blocks: 5 },
      priceLabel: CCA_COPY.currentClearingPrice,
      priceWei: 2_000_000_000n,
      history: [],
    },
  ],
  [
    BOB,
    {
      token: BOB,
      status: "pool_open",
      statusVars: {},
      priceLabel: POOL_PRICE_LABEL,
      priceWei: 0n,
      history: [],
    },
  ],
]);

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function renderPage(path: string, props: FollowingPageProps = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/following"
          element={
            <>
              <FollowingPage
                loadLaunched={props.loadLaunched ?? (async () => coins)}
                loadMarkets={props.loadMarkets ?? (async () => markets)}
              />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderApp(path: string) {
  return render(
    <Web3Provider>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Where />
      </MemoryRouter>
    </Web3Provider>,
  );
}

const where = () => screen.getByTestId("where").textContent;
const feedTexts = () => [...document.querySelectorAll("main .stack h2.post-text")].map((el) => el.textContent);
const sideList = () => document.querySelector("section.follow-list") as HTMLElement;
const chips = () => screen.getByRole("navigation", { name: "Following" });
const sideRow = (name: string) =>
  within(sideList())
    .getByText(name)
    .closest("li") as HTMLElement;

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("followingFeed", () => {
  it("reads the prophet label from the prophecy name only", () => {
    expect(prophetLabelOfName("lingo-2028.ringo.prophecy.eth", "prophecy.eth")).toBe("ringo");
    expect(prophetLabelOfName("ringo.prophecy.eth", "prophecy.eth")).toBeNull();
    expect(prophetLabelOfName("x.y.ringo.prophecy.eth", "prophecy.eth")).toBeNull();
    expect(prophetLabelOfName("a.ringo.other.eth", "prophecy.eth")).toBeNull();
  });

  it("keeps followed prophets only, newest first", () => {
    const feed = followingFeed(coins, ["alice", "bob"], "prophecy.eth");
    expect(feed.map((item) => item.row.token)).toEqual([ALICE_NEW, BOB, ALICE_OLD]);
  });
});

describe("Following page", () => {
  it("shows the empty state when nobody is followed", () => {
    const loadLaunched = vi.fn(async () => coins);
    renderPage("/following", { loadLaunched });
    const main = screen.getByRole("main");
    expect(main).toHaveClass("narrow", "stack");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Following");
    expect(screen.getByText(/You're not following any prophets yet\./)).toHaveClass("empty");
    expect(screen.getByRole("link", { name: "Browse prophecies" })).toHaveAttribute("href", "/");
    expect(loadLaunched).not.toHaveBeenCalled();
  });

  it("lists followed prophets' prophecies newest first with stage and price", async () => {
    follow("alice");
    follow("bob");
    const loadMarkets = vi.fn(async () => markets);
    renderPage("/following", { loadMarkets });

    await screen.findByText("The newest line");
    expect(feedTexts()).toEqual(["The newest line", "Bob's only line", "The old line"]);
    expect(screen.queryByText("Carol is not followed")).toBeNull();
    expect(screen.queryByText("Odd name")).toBeNull();

    const head = screen.getByRole("main").querySelector(".stack .block-head")!;
    expect(head.textContent).toBe("Allnewest first");

    const first = screen.getByText("The newest line").closest("li")!;
    expect(first).toHaveClass("post");
    expect(first.querySelector(".post-head strong")).toHaveTextContent("alice.prophecy.eth");
    expect(first.querySelector(".post-head img")).toHaveAttribute("width", "20");
    expect(first.querySelector(".post-meta .mono")).toHaveTextContent("new-one.alice.prophecy.eth");
    expect(within(first).getByRole("link", { name: "Open prophecy" })).toHaveAttribute(
      "href",
      "/n/new-one.alice.prophecy.eth",
    );
    expect(within(first).getByRole("link", { name: "Prophet page" })).toHaveAttribute("href", "/p/alice");
    await waitFor(() => expect(first.querySelector(".hold")).toHaveTextContent(auctionStatusCopy("live", { blocks: 5 })));
    expect(first.querySelector(".strong.mono")).toHaveTextContent(ethFromWei(2_000_000_000n));
    expect(first.textContent).toContain(CCA_COPY.currentClearingPrice);

    // Stage without a readable price: chip only.
    const bob = screen.getByText("Bob's only line").closest("li")!;
    expect(bob.querySelector(".hold")).toHaveTextContent(CCA_COPY.poolOpen);
    expect(bob.querySelector(".strong.mono")).toBeNull();
    expect(bob.textContent).not.toContain(POOL_PRICE_LABEL);

    // No snapshot at all: no stage line.
    const old = screen.getByText("The old line").closest("li")!;
    expect(old.querySelectorAll(".post-meta")).toHaveLength(1);

    expect(loadMarkets).toHaveBeenCalledWith([
      { token: ALICE_NEW, auction: undefined },
      { token: BOB, auction: undefined },
      { token: ALICE_OLD, auction: undefined },
    ]);
  });

  it("lists followed prophets on the side with counts", async () => {
    follow("dave");
    follow("bob");
    follow("alice");
    renderPage("/following");
    await screen.findByText("The newest line");

    const rows = [...sideList().querySelectorAll("ul.posts > li.post")];
    expect(rows.map((li) => li.querySelector("strong")!.textContent)).toEqual([
      "alice.prophecy.eth",
      "bob.prophecy.eth",
      "dave.prophecy.eth",
    ]);
    expect(rows.map((li) => li.querySelector(".row-sub")!.textContent)).toEqual([
      "2 prophecies",
      "1 prophecy",
      "0 prophecies",
    ]);
    expect(rows[0].querySelector(".post-head.chart-head > a.cell-coin img")).toHaveAttribute("width", "36");
    expect(within(rows[0] as HTMLElement).getByRole("button", { name: "Unfollow" })).toHaveClass("link", "strong", "small");
    expect(sideList().querySelector(".block-head")!.textContent).toBe("Followingsaved in this browser");
  });

  it("filters by a side row, keeps it in the URL and clears it again", async () => {
    const user = userEvent.setup();
    follow("bob");
    follow("alice");
    renderPage("/following");
    await screen.findByText("The newest line");

    await user.click(within(sideRow("bob.prophecy.eth")).getByRole("link"));
    expect(where()).toBe("/following?p=bob");
    expect(feedTexts()).toEqual(["Bob's only line"]);
    expect(sideRow("bob.prophecy.eth")).toHaveClass("post", "is-you");
    expect(sideRow("alice.prophecy.eth")).not.toHaveClass("is-you");
    const head = screen.getByRole("main").querySelector(".stack .block-head")!;
    expect(within(head as HTMLElement).getByRole("heading", { level: 2 })).toHaveTextContent("bob.prophecy.eth");

    // Same row again clears the filter.
    await user.click(within(sideRow("bob.prophecy.eth")).getByRole("link"));
    expect(where()).toBe("/following");
    expect(feedTexts()).toHaveLength(3);

    await user.click(within(sideRow("alice.prophecy.eth")).getByRole("link"));
    expect(feedTexts()).toEqual(["The newest line", "The old line"]);
    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(where()).toBe("/following");
    expect(feedTexts()).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
  });

  it("filters by a chip the same way", async () => {
    const user = userEvent.setup();
    follow("bob");
    follow("alice");
    renderPage("/following");
    await screen.findByText("The newest line");

    const nav = chips();
    expect(nav).toHaveClass("side-nav", "follow-chips");
    expect([...nav.querySelectorAll("a")].map((a) => a.textContent)).toEqual([
      "All",
      "alice.prophecy.eth",
      "bob.prophecy.eth",
    ]);
    expect(within(nav).getByRole("link", { name: "All" })).toHaveClass("active");

    await user.click(within(nav).getByRole("link", { name: "bob.prophecy.eth" }));
    expect(where()).toBe("/following?p=bob");
    expect(feedTexts()).toEqual(["Bob's only line"]);
    expect(within(chips()).getByRole("link", { name: "bob.prophecy.eth" })).toHaveClass("active");
    expect(within(chips()).getByRole("link", { name: "All" })).not.toHaveClass("active");

    await user.click(within(chips()).getByRole("link", { name: "All" }));
    expect(where()).toBe("/following");
    expect(feedTexts()).toHaveLength(3);
  });

  it("opens with the filter from ?p= after a reload", async () => {
    follow("bob");
    follow("alice");
    renderPage("/following?p=alice");
    await screen.findByText("The newest line");
    expect(feedTexts()).toEqual(["The newest line", "The old line"]);
    expect(sideRow("alice.prophecy.eth")).toHaveClass("is-you");
  });

  it("says so when the chosen prophet has no prophecy yet", async () => {
    follow("dave");
    follow("alice");
    renderPage("/following?p=dave");
    expect(await screen.findByText("This prophet has not written one yet.")).toHaveClass("empty");
    expect(feedTexts()).toEqual([]);
  });

  it("unfollowing the chosen prophet drops the row, the posts and the filter", async () => {
    const user = userEvent.setup();
    follow("bob");
    follow("alice");
    renderPage("/following?p=alice");
    await screen.findByText("The newest line");

    await user.click(within(sideRow("alice.prophecy.eth")).getByRole("button", { name: "Unfollow" }));
    expect(getFollowing()).toEqual(["bob"]);
    expect(where()).toBe("/following");
    expect(within(sideList()).queryByText("alice.prophecy.eth")).toBeNull();
    expect(within(chips()).queryByText("alice.prophecy.eth")).toBeNull();
    expect(feedTexts()).toEqual(["Bob's only line"]);
  });

  it("shows an error with Retry instead of an empty list when loading fails", async () => {
    const user = userEvent.setup();
    follow("alice");
    const loadLaunched = vi
      .fn<() => Promise<Coin[]>>()
      .mockRejectedValueOnce(new Error("rpc down"))
      .mockResolvedValue(coins);
    renderPage("/following", { loadLaunched });

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Try again later.");
    expect(screen.queryByText("No activity yet.")).toBeNull();
    expect(sideList().querySelector(".row-sub")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("The newest line")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(loadLaunched).toHaveBeenCalledTimes(2);
  });

  it("never shows the old bonding words or gain figures", async () => {
    follow("bob");
    follow("alice");
    renderPage("/following");
    await screen.findByText("The newest line");
    await waitFor(() => expect(document.querySelectorAll(".hold")).toHaveLength(2));
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/curve|graduat|pump|prediction|profit|market cap/i);
    expect(text).not.toMatch(/[+-]\d+(?:\.\d+)?%/);
  });
});

describe("Following in the app", () => {
  it("sends /me#following to /following and lights the sidebar link", async () => {
    follow("ringo");
    renderApp("/me#following");
    await waitFor(() => expect(where()).toBe("/following"));
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = [...nav.querySelectorAll("a")];
    const mine = links.find((a) => a.textContent?.startsWith("My prophecies"))!;
    const following = links.find((a) => a.textContent?.startsWith("Following"))!;
    expect(links.indexOf(following)).toBe(links.indexOf(mine) + 1);
    expect(following).toHaveAttribute("href", "/following");
    expect(following.textContent).toBe("Following\u00a01");
    expect(following).toHaveClass("active");
    expect(mine).not.toHaveClass("active");
  });

  it("lights My prophecies, not Following, on /me", () => {
    renderApp("/me");
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = [...nav.querySelectorAll("a")];
    expect(links.find((a) => a.textContent?.startsWith("My prophecies"))).toHaveClass("active");
    expect(links.find((a) => a.textContent?.startsWith("Following"))).not.toHaveClass("active");
  });

  it("updates the sidebar count right after Unfollow", async () => {
    const user = userEvent.setup();
    follow("mina");
    follow("ringo");
    renderApp("/following");
    const nav = screen.getByRole("navigation", { name: "Main" });
    const count = () => [...nav.querySelectorAll("a")].find((a) => a.textContent?.startsWith("Following"))!.textContent;
    expect(count()).toBe("Following\u00a02");

    // Demo mode: sample prophecies, newest first.
    const ringo = getProphetPage("ringo")!.prophecies.map((row) => row.sentence);
    for (const sentence of ringo) expect(feedTexts()).toContain(sentence);

    await user.click(within(sideRow("ringo.prophecy.eth")).getByRole("button", { name: "Unfollow" }));
    expect(count()).toBe("Following\u00a01");
    for (const sentence of ringo) expect(feedTexts()).not.toContain(sentence);

    await user.click(within(sideRow("mina.prophecy.eth")).getByRole("button", { name: "Unfollow" }));
    expect(count()).toBe("Following\u00a00");
    expect(screen.getByText(/You're not following any prophets yet\./)).toBeInTheDocument();
  });
});
