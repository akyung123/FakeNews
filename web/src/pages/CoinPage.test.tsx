import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getProphecyByName } from "../lib/prophetData";
import { CoinPage } from "./CoinPage";

const NOW = 1_750_000_000;
const realNow = Date.now;

function renderName(name: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/n/${name}`]}>
      <Routes>
        <Route path="/n/:name" element={<CoinPage />} />
        <Route path="/coin/:id" element={<CoinPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Screen 3 name route", () => {
  test("navigating to /n/<name> renders the detail, not a blank page", () => {
    Date.now = () => NOW * 1000;
    try {
      const ens = "badges-2028.ringo.prophecy.eth";
      const html = renderName(ens);
      const row = getProphecyByName(ens, NOW)!;
      expect(html).toContain(row.sentence);
      expect(html).toContain(row.ensName);
      expect(html).toContain("Buy");
      expect(html).toContain("Trade memos");
      expect(html).toContain("Curve progress");
      expect(html).toContain("40% 0.0080 of 0.02 ETH to graduate");
      expect(html).not.toContain("1.32 ETH");
      expect(html).not.toContain("Holder talk");
      expect(html).not.toContain("market cap since launch");
      expect(html).not.toContain("Prophecy not found");
      expect(html.trim()).not.toBe("");
    } finally {
      Date.now = realNow;
    }
  });
});
