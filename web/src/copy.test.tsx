import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

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
  "profit",
  "yield",
  "prediction market",
];

/** Signed gain/loss figures such as +861% or -12.3%. Curve fill (70%) has no sign. */
const SIGNED_PCT = /[+-]\d+(?:\.\d+)?%/;

function renderApp(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
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
    expect(held).not.toContain("Holder +");
    expect(held).not.toContain("Holder -");
    assertRemoved(held);
  });

  test("Screen 3 empty state and graduation copy", () => {
    const empty = renderApp("/n/curve-out.ringo.prophecy.eth");
    expect(empty).toContain("No trades yet. The first memo shows up here.");
    expect(empty).toContain("Trade memos");
    expect(empty).toContain("Curve progress");
    assertRemoved(empty);

    const graduated = renderApp("/n/two-min.ringo.prophecy.eth");
    expect(graduated).toContain("Graduated to Uniswap V4");
    expect(graduated).toContain("Trade memos");
    expect(graduated).not.toContain("Curve progress");
    assertRemoved(graduated);
  });

  test("Home cards and Top table drop gain figures and Since launch", () => {
    const home = renderApp("/");
    expect(home).toContain("Top prophecies");
    expect(home).toContain("Price");
    expect(home).toContain("Curve");
    expect(home).toContain("Trade memos");
    expect(home).toContain("june_kim");
    expect(home).not.toContain("Since launch");
    expect(home).not.toContain("Market cap");
    assertRemoved(home);
  });

  test("Sidebar wordmark is prophecy with no pump", () => {
    const home = renderApp("/");
    expect(home).toContain(">prophecy<");
    expect(home).not.toContain(".pump");
    assertRemoved(home);
  });

  test("MyPage uses entry / price now / sell quote and no gain percent", () => {
    const mine = renderApp("/me");
    expect(mine).toContain("Entry price");
    expect(mine).toContain("Price now");
    expect(mine).toContain("Sell quote");
    expect(mine).toContain("trade memos");
    expect(mine).not.toContain("Return");
    assertRemoved(mine);
  });
});
