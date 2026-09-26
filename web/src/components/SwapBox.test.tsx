import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Address } from "viem";
import { SWAP_SECTION_COPY } from "../lib/cca/copy";
import { SwapBox } from "./SwapBox";

const TOKEN = "0x1111111111111111111111111111111111111111" as Address;
const HOOK = "0x2222222222222222222222222222222222222222" as Address;

function render(props: Partial<Parameters<typeof SwapBox>[0]> = {}): string {
  return renderToStaticMarkup(
    <SwapBox token={TOKEN} hooks={HOOK} symbol="LINGO" poolOpen {...props} />,
  );
}

describe("swap box", () => {
  test("waits for the market before showing any controls", () => {
    const html = render({ poolOpen: false });
    expect(html).toContain(SWAP_SECTION_COPY.title);
    expect(html).toContain(SWAP_SECTION_COPY.beforePoolOpen);
    expect(html).not.toContain("<input");
    expect(html).not.toContain("You pay (ETH)");
  });

  test("trades in the app once the market is open", () => {
    const html = render();
    expect(html).toContain("You pay (ETH)");
    expect(html).toContain("Buy LINGO");
    expect(html).toContain("You get about 0 LINGO");
    expect(html).toContain("At least 0 LINGO");
  });

  test("names the pool fee and the split, and never sends the trader away", () => {
    const html = render();
    expect(html).toContain(SWAP_SECTION_COPY.feeNote);
    expect(html).not.toContain("app.uniswap.org");
    expect(html).not.toContain("<a ");
  });

  test("offers both sides of the market", () => {
    const html = render();
    expect(html).toContain(">Buy<");
    expect(html).toContain(">Sell<");
  });

  test("cannot send without a pool or a demo price", () => {
    const html = render({ token: undefined, hooks: undefined });
    expect(html).toContain("disabled");
  });

  test("can send in demo mode with no chain wiring", () => {
    const html = render({ token: undefined, hooks: undefined, demoPriceEth: 0.0000001 });
    expect(html).not.toContain("disabled");
  });
});
