import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Address } from "viem";
import { auctionStatusCopy, CCA_COPY } from "../lib/cca/copy";
import { POOL_PRICE_LABEL, type MarketSnapshot } from "../lib/cca/loadAuction";
import { FOLLOWING_KEY, getFollowing } from "../lib/following";
import { prophetPageFromChain } from "../lib/prophetData";
import { ProphetPage, type ProphetPageProps } from "./ProphetPage";

const WALLET = "0x3333333333333333333333333333333333333333" as const;
const TOKEN_A = "0xaaaa00000000000000000000000000000000aaaa" as Address;
const TOKEN_B = "0xbbbb00000000000000000000000000000000bbbb" as Address;

const page = prophetPageFromChain({
  label: "alice",
  wallet: WALLET,
  claimableFeeWei: 0n,
  prophecies: [
    {
      slug: "rain-friday",
      ensName: "rain-friday.alice.prophecy.eth",
      sentence: "It rains on Friday",
      token: TOKEN_A,
      sold: 0n,
      complete: false,
      curveProgress: 0,
      launchedBlock: 20,
    },
    {
      slug: "late-train",
      ensName: "late-train.alice.prophecy.eth",
      sentence: "The last train runs late",
      token: TOKEN_B,
      sold: 0n,
      complete: true,
      curveProgress: 1,
      launchedBlock: 10,
    },
  ],
});

const markets = new Map<Address, MarketSnapshot>([
  [
    TOKEN_A,
    {
      token: TOKEN_A,
      status: "live",
      statusVars: { blocks: 12 },
      priceLabel: CCA_COPY.currentClearingPrice,
      priceWei: 1_500_000_000n,
      history: [
        { at: 100, wei: 1_000_000_000n },
        { at: 112, wei: 1_500_000_000n },
      ],
    },
  ],
  [
    TOKEN_B,
    {
      token: TOKEN_B,
      status: "pool_open",
      statusVars: {},
      priceLabel: POOL_PRICE_LABEL,
      priceWei: 2_000_000_000n,
      history: [],
    },
  ],
]);

function renderPage(props: Partial<ProphetPageProps> = {}) {
  return render(
    <MemoryRouter initialEntries={["/p/alice"]}>
      <Routes>
        <Route
          path="/p/:name"
          element={
            <ProphetPage
              loadProphet={async () => page}
              readCreatorFee={async () => 0n}
              loadMarkets={async () => markets}
              readProfile={async () => ({ avatar: null, description: null })}
              {...props}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("prophet profile", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("follows and unfollows from the name row", async () => {
    const user = userEvent.setup();
    renderPage();
    const followBtn = await screen.findByRole("button", { name: "Follow" });
    expect(followBtn).toHaveClass("btn", "primary");
    await user.click(followBtn);
    const following = screen.getByRole("button", { name: "Following" });
    expect(following).toHaveClass("btn", "ghost");
    expect(getFollowing()).toEqual(["alice"]);
    expect(JSON.parse(localStorage.getItem(FOLLOWING_KEY)!)).toEqual(["alice"]);
    await user.click(following);
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
    expect(getFollowing()).toEqual([]);
  });

  it("shows the ENS avatar and description when set", async () => {
    renderPage({
      readProfile: async () => ({ avatar: "ipfs://bafyavatar", description: "Writes about trains." }),
    });
    expect(await screen.findByText("Writes about trains.")).toBeInTheDocument();
    const img = document.querySelector(".prophet-hero img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://ipfs.io/ipfs/bafyavatar");
  });

  it("falls back to the skull picture and no description", async () => {
    const readProfile = async () => ({ avatar: null, description: null });
    renderPage({ readProfile });
    await screen.findByText("alice.prophecy.eth");
    const img = document.querySelector(".prophet-hero img") as HTMLImageElement;
    expect(img.getAttribute("src")).toMatch(/skull\.svg$/);
    expect(document.querySelector(".prophet-hero")!.textContent).not.toContain("undefined");
  });

  it("lists Name · Sentence · Token and prices per stage, charting only rows with history", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Prophecies" });
    const head = within(table).getAllByRole("row")[0];
    expect(head.textContent).toBe("NameSentenceToken");

    expect(await screen.findByText(auctionStatusCopy("live", { blocks: 12 }))).toHaveClass("hold");
    expect(screen.getByText(CCA_COPY.poolOpen)).toHaveClass("hold");
    expect(screen.getByText(CCA_COPY.currentClearingPrice)).toBeInTheDocument();
    expect(screen.getByText(POOL_PRICE_LABEL)).toBeInTheDocument();
    expect(screen.getByText("0.0000000015 ETH per token")).toBeInTheDocument();
    expect(screen.getByText("0.000000002 ETH per token")).toBeInTheDocument();
    // TOKEN_A has two clearing-price points; TOKEN_B has none yet.
    expect(screen.getAllByRole("img", { name: /over time/ })).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/%/);
  });

  it("has only Prophecies and Activity tabs", async () => {
    const user = userEvent.setup();
    renderPage();
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Prophecies", "Activity"]);
    expect(screen.queryByText(/Replies/)).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Activity" }));
    expect(screen.queryByRole("table")).toBeNull();
    const items = document.querySelectorAll("ul.posts > li.post");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("rain-friday");
    expect(items[0].textContent).toContain("Block 20");
  });
});
