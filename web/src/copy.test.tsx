import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { Web3Provider } from "./providers/Web3Provider";
import { gwei, mcap } from "./lib/format";
import { ISSUE_COPY } from "./lib/issue";
import { SEED_EVENTS } from "./lib/mock";
import { WRITE_COPY, ZERO_QUOTE_COPY } from "./lib/writes";
import { MEMO_COPY } from "./lib/limits";
import { WRITE_REVERT_COPY } from "./lib/writeErrors";

const NEW_MEMOS = [
  "I've met this router before.",
  "Router light is blinking amber already.",
  "Wi-Fi flickered at the demo table just now.",
  "Wi-Fi still up at midnight. Checking again at 3.",
  "They refilled the coffee at 10pm.",
  "Still haven't written a test.",
  "Half the team is still awake at 4am.",
];

const FLAGGED_MEMOS = [
  "LFG 📡",
  "buying the dip anyway",
  "I panic sold. classic",
  "ugh, why is it dropping AGAIN",
  "It's coming.",
];

const REMOVED = [
  "Holder talk",
  "How's your bag feeling?",
  "market cap since launch",
  "Graduated. The curve sold out.",
  "No talk yet. Buy in and say something.",
  "bought at",
  "Since launch",
  "Top prophecies by market cap",
  "by market cap",
  "prophecy.pump",
  "Bought at (MC)",
  "Now (MC)",
  "If sold now",
  "Return if sold now",
  "moon_park",
  "degen_kim",
  "wagmi_lee",
  "profit",
  "yield",
  "prediction market",
  "Set final price",
  "Auction ended · final price not set yet",
  "PRIVATE_KEY",
  "just saw a PRIVATE_KEY on the big screen 👀",
  ...FLAGGED_MEMOS,
];

/** Signed gain/loss figures such as +861% or -12.3%. Curve fill (70%) has no sign. */
const SIGNED_PCT = /[+-]\d+(?:\.\d+)?%/;

function renderApp(path: string): string {
  const html = renderToStaticMarkup(
    <Web3Provider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Web3Provider>,
  );
  return html.replace(/&#x27;/g, "'").replace(/&apos;/g, "'");
}

function assertRemoved(html: string) {
  for (const text of REMOVED) {
    expect(html).not.toContain(text);
  }
  expect(html).not.toMatch(SIGNED_PCT);
  expect(html.toLowerCase()).not.toContain("pump");
  expect(html.toLowerCase()).not.toContain("bag");
}

describe("DECISIONS #1 copy — new strings", () => {
  test("Screen 3 trade page uses trade-memo copy and a plain Holder badge", () => {
    const held = renderApp("/coin/wifi");
    expect(held).toContain("Trade memos");
    expect(held).toContain("Add a one-line memo (optional)");
    expect(held).toContain("Current clearing price");
    expect(held).toContain("Holder");
    expect(held).toContain("of 0.02 ETH raised to open the market");
    expect(held).toContain("Place bid");
    expect(held).not.toContain("0.0177 ETH");
    expect(held).not.toContain("Holder +");
    expect(held).not.toContain("Holder -");
    expect(held).toContain("I've met this router before.");
    expect(held).toContain("Router light is blinking amber already.");
    expect(held).toContain("Wi-Fi flickered at the demo table just now.");
    expect(held).toContain("Wi-Fi still up at midnight. Checking again at 3.");
    assertRemoved(held);
  });

  test("Screen 3 empty state and graduation copy", () => {
    const empty = renderApp("/n/curve-out.ringo.prophecy.eth");
    expect(empty).toContain("No trades yet. The first memo shows up here.");
    expect(empty).toContain("Trade memos");
    expect(empty).toContain("Current clearing price");
    expect(empty).toContain("of 0.02 ETH raised to open the market");
    expect(empty).toContain("Place bid");
    expect(empty).toContain("curve-out");
    expect(empty).toContain("curve-out.ringo.prophecy.eth");
    expect(empty).toContain("Copy");
    expect(empty).not.toContain("0.93 ETH");
    assertRemoved(empty);

    const graduated = renderApp("/n/two-min.ringo.prophecy.eth");
    expect(graduated).toContain("Market open on Uniswap v4");
    expect(graduated).toContain("Swap");
    expect(graduated).toContain("Collect fees");
    expect(graduated).toContain("Trade memos");
    expect(graduated).toContain("of 0.02 ETH raised to open the market");
    expect(graduated).not.toContain("Place bid");
    expect(graduated).not.toContain("3.74 ETH");
    assertRemoved(graduated);
  });

  test("Home cards and Top table drop gain figures and Since launch", () => {
    const home = renderApp("/");
    expect(home).toContain("Closest to graduation");
    expect(home).toContain("Price");
    expect(home).toContain("Curve");
    expect(home).toContain("Trade memos");
    expect(home).toContain("Sample data");
    expect(home).toContain("june_kim");
    expect(home).toContain("rin_park");
    expect(home).toContain("sam_lee");
    for (const memo of NEW_MEMOS) expect(home).toContain(memo);
    expect(home).not.toContain("Since launch");
    expect(home).not.toContain("Market cap");
    expect(home).not.toContain("holders");
    expect(home).not.toContain(">Prophet<");
    expect(home).not.toContain(">Copy<");
    assertRemoved(home);
  });

  test("Sidebar wordmark is prophit with no pump", () => {
    const home = renderApp("/");
    expect(home).toContain(">prophit<");
    expect(home).not.toContain(".pump");
    expect(home).toContain("Contracts not connected yet.");
    expect(home).toContain("Sample data");
    expect(home).toContain("Claim your name");
    expect(home).not.toContain("env");
    expect(home).not.toContain("Launchpad address loaded from env.");
    expect(home).not.toContain("Launchpad address not set yet.");
    assertRemoved(home);
  });

  test("MyPage uses entry / price now / sell quote and no gain percent", () => {
    const mine = renderApp("/me");
    expect(mine).toContain("Entry price");
    expect(mine).toContain("Price now");
    expect(mine).toContain("Sell quote");
    expect(mine).toContain("trade memos");
    expect(mine).not.toContain("Return");
    expect(mine).toContain("0.02702 gwei");
    expect(mine).toContain("0.01773 gwei");
    expect(mine).toContain(gwei(2.702024173734242e-11));
    expect(mine).toContain(gwei(1.7727753707046925e-11));
    expect(mine).not.toContain(mcap(0.017727753707046923));
    assertRemoved(mine);
  });

  test("name-claim copy uses the designer sentences", () => {
    expect(ISSUE_COPY.registerPending).toBe("Confirm your name in your wallet.");
    expect(ISSUE_COPY.registerSuccess).toBe("Your name is claimed on Sepolia.");
    expect(ISSUE_COPY.registerFailed).toBe(
      "Name claim failed. Nothing was charged except gas. Try again.",
    );
    expect(ISSUE_COPY.registerPending).not.toContain("Confirm the prophet name");
    expect(ISSUE_COPY.registerSuccess).not.toContain("Prophet name is on Sepolia");
    const create = renderApp("/create");
    expect(create).toContain("Issue a prophecy");
    expect(create).not.toContain("140 left");
    expect(create).toContain("opens with a short auction");
    expect(create).not.toContain("Confirm the prophet name in your wallet.");
    expect(create).not.toContain("Prophet name is on Sepolia.");
    assertRemoved(create);
  });

  test("live write copy is the designer sentences in ETH, with no coin or outlook wording", () => {
    expect(WRITE_COPY.pending).toBe("Confirm in your wallet.");
    expect(WRITE_COPY.waiting).toBe("Waiting for Sepolia…");
    expect(WRITE_COPY.launchSuccess).toBe("Token is live.");
    expect(WRITE_COPY.tradeSuccess).toBe("Trade confirmed.");
    expect(WRITE_COPY.claimSuccess).toBe("Fees claimed.");
    expect(WRITE_COPY.failed).toBe("Transaction failed. Nothing was charged except gas. Try again.");
    expect(WRITE_COPY.launchedMissing).toBe(
      "Token launched, but we couldn't find its page. Check your wallet activity.",
    );
    expect(WRITE_COPY.approve).toBe("Approve tokens to sell");
    expect(ZERO_QUOTE_COPY).toBe("Amount too small to trade. Try a larger amount.");
    expect(Object.values(WRITE_COPY)).not.toContain(ZERO_QUOTE_COPY);
    const text = Object.values(WRITE_COPY).join(" ");
    expect(text.toLowerCase()).not.toMatch(/coin|profit|yield|prediction|outlook/);
    expect(text).not.toContain("%");
    const create = renderApp("/create");
    expect(create).toContain("opens with a short auction");
    expect(create).not.toContain(WRITE_COPY.failed);
    expect(create).not.toContain(ZERO_QUOTE_COPY);
    assertRemoved(create);
  });

  test("trade memo limit copy never says bytes", () => {
    expect(MEMO_COPY.tooLong).toBe("Memo is too long. Shorten it to trade.");
    expect(MEMO_COPY.tooLong.toLowerCase()).not.toMatch(/byte/);
    const held = renderApp("/coin/wifi");
    expect(held).toContain("140 left");
    expect(held).not.toContain("bytes");
  });

  test("write revert banners use the designer sentences for the six Launchpad errors", () => {
    expect(WRITE_REVERT_COPY.NullifierUsed).toBe("This World ID already has a name.");
    expect(WRITE_REVERT_COPY.LabelTaken).toBe("That name is taken. Try another.");
    expect(WRITE_REVERT_COPY.AlreadyProphet).toBe("This wallet already has a name.");
    expect(WRITE_REVERT_COPY.SlugTaken).toBe("That token name is taken. Try another.");
    expect(WRITE_REVERT_COPY.Slippage).toBe("Price moved. Try again.");
    expect(WRITE_REVERT_COPY.CurveComplete).toBe("This token has graduated. Trade on Uniswap.");
    const text = Object.values(WRITE_REVERT_COPY).join(" ");
    expect(text.toLowerCase()).not.toMatch(/coin|profit|yield|prediction|outlook/);
    expect(text).not.toContain("%");
    expect(Object.keys(WRITE_REVERT_COPY)).toEqual([
      "NullifierUsed",
      "LabelTaken",
      "AlreadyProphet",
      "SlugTaken",
      "Slippage",
      "CurveComplete",
    ]);
  });

  test("seed memos replace price-sentiment lines and old usernames", () => {
    const says = SEED_EVENTS.map((e) => e.say).filter((s): s is string => Boolean(s));
    for (const memo of NEW_MEMOS) expect(says).toContain(memo);
    for (const memo of FLAGGED_MEMOS) expect(says).not.toContain(memo);
    const home = renderApp("/");
    expect(home).not.toContain("degen_kim");
    expect(home).not.toContain("wagmi_lee");
    expect(home).not.toContain("moon_park");
    expect(home).not.toContain("PRIVATE_KEY");
    expect(says).not.toContain("just saw a PRIVATE_KEY on the big screen 👀");
    assertRemoved(home);
  });

  test("create and name pages show the claim steps", () => {
    const create = renderApp("/create");
    expect(create).toContain('aria-current="step">Step 1 · Claim your name');
    expect(create).toContain("Step 2 · Launch your prophecy");
    expect(create).toContain("Short name");
    expect(create).not.toContain("One transaction");
    assertRemoved(create);

    const name = renderApp("/name");
    expect(name).toContain("Claim your name");
    expect(name).toContain("Step 1 of 2");
    expect(name).toContain("Step 2 of 2");
    assertRemoved(name);
  });

  test("returning prophet skips to the launch step with no Prophet badge", () => {
    const returning = renderApp("/create?returning=1");
    expect(returning).toContain('aria-current="step">Step 2 · Launch your prophecy');
    expect(returning).not.toContain('aria-current="step">Step 1');
    expect(returning).not.toContain("Step 1 of 2");
    expect(returning).not.toContain(">Prophet<");
    assertRemoved(returning);

    const profile = renderApp("/p/ringo");
    expect(profile).toContain("ringo.prophecy.eth");
    expect(profile).not.toContain(">Prophet<");
    expect(profile).not.toContain("holder share");
    expect(profile).not.toContain(">Copy<");
    assertRemoved(profile);
  });
});
