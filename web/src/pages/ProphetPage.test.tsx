import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MOCK_PROPHECIES } from "../lib/mock";
import { getProphetPage, prophecyDetailPath } from "../lib/prophetData";
import { ProphetPage } from "./ProphetPage";

const NOW = 1_750_000_000;
const realNow = Date.now;
const screenPath = join(dirname(fileURLToPath(import.meta.url)), "ProphetPage.tsx");

function renderProphet(name: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/p/${name}`]}>
      <Routes>
        <Route path="/p/:name" element={<ProphetPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProphetPage", () => {
  test("renders the mock prophet with sentences, fees, and Screen 3 links", () => {
    Date.now = () => NOW * 1000;
    try {
      const html = renderProphet("ringo");
      const data = getProphetPage("ringo")!;

      expect(html).toContain(data.prophet.ensName);
      expect(html).toContain(data.prophet.wallet);
      expect(html).toContain("Claimable fees");
      expect(html).toContain("0.0012 ETH");
      expect(html).toContain(">Follow<");
      expect(html).toContain("skull.svg");
      expect(html).toContain(">Prophecies<");
      expect(html).toContain(">Activity<");
      expect(html).not.toContain("Replies");
      expect(html).not.toContain(">Curve<");
      expect(html).not.toContain(">Trade<");
      expect(html).not.toContain("Departed");
      expect(html).not.toContain("Deadline");

      for (const row of data.prophecies) {
        expect(html).toContain(row.sentence);
        expect(html).toContain(row.ensName);
        expect(html).toContain(row.slug);
        expect(html).toContain(prophecyDetailPath(row.ensName));
        expect(html).toContain(row.token.slice(0, 6));
      }
      expect(html).not.toContain(">Buy</span>");

      expect(html).not.toContain(">Copy<");
      expect(html).not.toContain("True");
      expect(html).not.toContain("False");
      expect(html).not.toContain("yield");
      expect(html).not.toContain("profit");
      expect(html).not.toContain("prediction market");
    } finally {
      Date.now = realNow;
    }
  });

  test("shows a not-found state for an unknown name", () => {
    const html = renderProphet("nobody");
    expect(html).toContain("Prophet not found");
  });

  test("screen component does not hardcode sentence strings", () => {
    const source = readFileSync(screenPath, "utf8");
    expect(source.includes("getProphetPage")).toBe(true);
    expect(source.includes("../lib/mock")).toBe(false);
    for (const row of MOCK_PROPHECIES) {
      expect(source).not.toContain(row.sentence);
    }
  });
});
