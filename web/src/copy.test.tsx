import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
import { Web3Provider } from "./providers/Web3Provider";
import { gwei, mcap } from "./lib/format";
import { ISSUE_COPY } from "./lib/issue";
import { SEED_EVENTS } from "./lib/mock";

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
    expect(held).toContain("Curve progress");
    expect(held).toContain("Holder");
    expect(held).toContain("53% 0.0106 of 0.02 ETH to graduate");
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
    expect(empty).toContain("Curve progress");
    expect(empty).toContain("0% 0.0000 of 0.02 ETH to graduate");
    expect(empty).not.toContain("0.93 ETH");
    assertRemoved(empty);

    const graduated = renderApp("/n/two-min.ringo.prophecy.eth");
    expect(graduated).toContain("Graduated to Uniswap V4");
    expect(graduated).toContain("Trade memos");
    expect(graduated).toContain("100% 0.0200 of 0.02 ETH to graduate");
    expect(graduated).not.toContain("Curve progress");
    expect(graduated).not.toContain("3.74 ETH");
    assertRemoved(graduated);
  });

  test("Home cards and Top table drop gain figures and Since launch", () => {
    const home = renderApp("/");
    expect(home).toContain("Top prophecies");
    expect(home).toContain("Price");
    expect(home).toContain("Curve");
    expect(home).toContain("Trade memos");
    expect(home).toContain("june_kim");
    expect(home).toContain("rin_park");
    expect(home).toContain("sam_lee");
    for (const memo of NEW_MEMOS) expect(home).toContain(memo);
    expect(home).not.toContain("Since launch");
    expect(home).not.toContain("Market cap");
    assertRemoved(home);
  });

  test("Sidebar wordmark is prophecy with no pump", () => {
    const home = renderApp("/");
    expect(home).toContain(">prophecy<");
    expect(home).not.toContain(".pump");
    expect(home).toContain("Contracts not connected yet.");
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
    expect(create).toContain("It becomes a token.");
    expect(create).not.toContain("Confirm the prophet name in your wallet.");
    expect(create).not.toContain("Prophet name is on Sepolia.");
    assertRemoved(create);
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
});
