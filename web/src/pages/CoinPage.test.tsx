import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GRADUATED_BODY } from "../lib/graduation";
import { getProphecyByName, prototypeCoinFromName } from "../lib/prophetData";
import { Web3Provider } from "../providers/Web3Provider";
import { CoinPage, TradeBox } from "./CoinPage";

const NOW = 1_750_000_000;
const realNow = Date.now;

function renderName(name: string): string {
  return renderToStaticMarkup(
    <Web3Provider>
      <MemoryRouter initialEntries={[`/n/${name}`]}>
        <Routes>
          <Route path="/n/:name" element={<CoinPage />} />
          <Route path="/coin/:id" element={<CoinPage />} />
        </Routes>
      </MemoryRouter>
    </Web3Provider>,
  );
}

describe("Screen 3 name route", () => {
  test("navigating to /n/<name> renders the detail, not a blank page", () => {
    Date.now = () => NOW * 1000;
    try {
      const ens = "badges-2028.ringo.prophecy.eth";
      const html = renderName(ens);
      const row = getProphecyByName(ens)!;
      expect(html).toContain(row.sentence);
      expect(html).toContain(row.slug);
      expect(html).toContain(row.ensName);
      expect(html).toContain(">Copy<");
      expect(html).toContain('aria-label="Copy full name"');
      expect(html).not.toContain("holders");
      expect(html).toContain("Place bid");
      expect(html).toContain("Budget (ETH)");
      expect(html).toContain("Max price per token (ETH)");
      expect(html).toContain("Trade memos");
      expect(html).toContain("Current clearing price");
      expect(html).toContain("of 0.02 ETH raised to open the market");
      expect(html).not.toContain("1.32 ETH");
      expect(html).not.toContain("Holder talk");
      expect(html).not.toContain("market cap since launch");
      expect(html).not.toContain("Prophecy not found");
      expect(html).not.toContain(GRADUATED_BODY);
      expect(html.trim()).not.toBe("");
    } finally {
      Date.now = realNow;
    }
  });

  test("progress bar uses auction copy, not the bonding curve", () => {
    Date.now = () => NOW * 1000;
    try {
      const html = renderName("badges-2028.ringo.prophecy.eth");
      expect(html).toContain('aria-label="Auction progress"');
      expect(html).toContain("<span>Auction 40%</span>");
      expect(html).toContain("Market opens at 100%");
      expect(html).not.toContain("Bonding");
      expect(html).not.toContain("Graduates at");
    } finally {
      Date.now = realNow;
    }
  });
});

describe("CCA trade panel", () => {
  test("hides Place bid on a graduated prototype and shows swap copy", () => {
    Date.now = () => NOW * 1000;
    try {
      const ens = "sold-out.ringo.prophecy.eth";
      const html = renderName(ens);
      const row = getProphecyByName(ens)!;
      expect(html).toContain(row.sentence);
      expect(html).toContain("Market open on Uniswap v4");
      expect(html).toContain("Swap");
      expect(html).toContain("Collect fees");
      expect(html).not.toContain("Set final price");
      expect(html).not.toContain("Set up fee collection");
      expect(html).not.toContain("Place bid");
      expect(html).not.toContain("Budget (ETH)");
      expect(html).not.toContain("Curve sold out");
    } finally {
      Date.now = realNow;
    }
  });

  test("live prototype shows the bid fields", () => {
    Date.now = () => NOW * 1000;
    try {
      const html = renderName("badges-2028.ringo.prophecy.eth");
      expect(html).toContain("Place bid");
      expect(html).toContain("Budget (ETH)");
      expect(html).toContain("Max price per token (ETH)");
      expect(html).not.toContain(GRADUATED_BODY);
    } finally {
      Date.now = realNow;
    }
  });

  test("TradeBox on a live coin is the bid panel", () => {
    const coin = prototypeCoinFromName("badges-2028.ringo.prophecy.eth", NOW)!;
    const html = renderToStaticMarkup(
      <TradeBox coin={coin} balance={0.05} held={0} />,
    );
    expect(html).toContain("Place bid");
    expect(html).toContain("Budget (ETH)");
    expect(html).not.toContain(GRADUATED_BODY);
  });
});
