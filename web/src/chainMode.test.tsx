import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { MOCK_ISSUE_PLACEHOLDER, MOCK_PROPHECIES, MOCK_PROPHETS } from "./lib/mock";
import { Web3Provider } from "./providers/Web3Provider";

// Chain mode: a launchpad is set, so the demo seed must stay out of every screen.
vi.mock("./lib/mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/mode")>()),
  isMockMode: () => false,
}));
vi.mock("./lib/contracts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/contracts")>();
  return { ...actual, hasLaunchpad: () => true, contracts: { ...actual.contracts, launchpad: "0x9999999999999999999999999999999999999999" } };
});
// No RPC in tests: nothing launched yet, and the wallet has no prophet name.
vi.mock("./lib/launched", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/launched")>()),
  loadLaunchedCoins: async () => [],
}));
vi.mock("./lib/launchpad", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/launchpad")>()),
  createReadProphetOf: () => async () => "",
}));

const SAMPLE_TEXT = [
  ...MOCK_PROPHETS.map((p) => p.label),
  ...MOCK_PROPHECIES.flatMap((p) => [p.slug, p.sentence]),
  MOCK_ISSUE_PLACEHOLDER.prophecy,
  MOCK_ISSUE_PLACEHOLDER.slug,
];

describe("chain mode", () => {
  it("never renders the sample prophets (ringo, mina) on any screen", async () => {
    const paths = [
      "/",
      "/p/ringo",
      "/p/mina.prophecy.eth",
      "/n/badges-2028.ringo.prophecy.eth",
      "/me",
      "/me#following",
      "/create?returning=1",
      "/name?returning=1",
    ];
    for (const path of paths) {
      const { container, unmount } = render(
        <Web3Provider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </Web3Provider>,
      );
      // Let the chain loaders settle (they resolve to "nothing found").
      await waitFor(() => expect(container.querySelector(".content main")).not.toBeNull());
      await new Promise((resolve) => setTimeout(resolve, 0));
      const html = container.innerHTML;
      expect(html, path).not.toContain("ringo");
      for (const text of SAMPLE_TEXT) expect(html, `${path}: ${text}`).not.toContain(text);
      unmount();
    }
  });
});
