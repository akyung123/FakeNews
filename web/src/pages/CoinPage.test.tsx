import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  applyGraduatedEvent,
  GRADUATED_BODY,
  GRADUATED_LINK,
  GRADUATED_TITLE,
  MOCK_HOOK,
  mockGraduationState,
  uniswapGraduationHref,
  v4PoolId,
} from "../lib/graduation";
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
      const row = getProphecyByName(ens, NOW)!;
      expect(html).toContain(row.sentence);
      expect(html).toContain(row.ensName);
      expect(html).toContain(row.slug);
      expect(html).toContain(">Copy<");
      expect(html).toContain("Buy");
      expect(html).toContain("Sell");
      expect(html).toContain("Trade memos");
      expect(html).toContain("Curve progress");
      expect(html).toContain("40% 0.0080 of 0.02 ETH to graduate");
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
});

describe("graduated trade panel", () => {
  test("hides Buy/Sell and shows the three designer lines", () => {
    Date.now = () => NOW * 1000;
    try {
      const ens = "sold-out.ringo.prophecy.eth";
      const html = renderName(ens);
      const row = getProphecyByName(ens, NOW)!;
      const poolId = v4PoolId({ token: row.token, hooks: MOCK_HOOK });
      expect(html).toContain(row.sentence);
      expect(html).toContain(GRADUATED_TITLE);
      expect(html).toContain(GRADUATED_BODY);
      expect(html).toContain(GRADUATED_LINK);
      expect(html).toContain(uniswapGraduationHref({ graduated: true, poolId, token: row.token }));
      expect(html).not.toContain(">Buy<");
      expect(html).not.toContain(">Sell<");
      expect(html).not.toContain("Amount (ETH)");
      expect(html).not.toContain("Curve sold out");
    } finally {
      Date.now = realNow;
    }
  });

  test("non-graduated trade panel is unchanged", () => {
    Date.now = () => NOW * 1000;
    try {
      const html = renderName("badges-2028.ringo.prophecy.eth");
      expect(html).toContain(">Buy<");
      expect(html).toContain(">Sell<");
      expect(html).toContain("Amount (ETH)");
      expect(html).not.toContain(GRADUATED_BODY);
      expect(html).not.toContain(GRADUATED_LINK);
    } finally {
      Date.now = realNow;
    }
  });

  test("mocked Graduated event flips Buy/Sell into the three lines", () => {
    const coin = prototypeCoinFromName("badges-2028.ringo.prophecy.eth", NOW)!;
    const open = mockGraduationState(coin.token!, false);
    const before = renderToStaticMarkup(
      <TradeBox coin={coin} balance={0.05} held={0} graduation={open} />,
    );
    expect(before).toContain("Buy");
    expect(before).toContain("Sell");
    expect(before).not.toContain(GRADUATED_BODY);

    const poolId = v4PoolId({ token: coin.token!, hooks: MOCK_HOOK });
    const flipped = applyGraduatedEvent(open, {
      token: coin.token!,
      poolId,
      hooks: MOCK_HOOK,
    });
    const after = renderToStaticMarkup(
      <TradeBox coin={coin} balance={0.05} held={0} graduation={flipped} />,
    );
    expect(after).toContain(GRADUATED_TITLE);
    expect(after).toContain(GRADUATED_BODY);
    expect(after).toContain(GRADUATED_LINK);
    expect(after).not.toContain(">Buy<");
    expect(after).not.toContain(">Sell<");
    expect(after).toContain(poolId);
  });
});
