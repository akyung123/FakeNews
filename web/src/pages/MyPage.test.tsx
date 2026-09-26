import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { Web3Provider } from "../providers/Web3Provider";
import { MyPage, type MyPageProps } from "./MyPage";

function renderMe(props: MyPageProps) {
  return render(
    <Web3Provider>
      <MemoryRouter initialEntries={["/me"]}>
        <MyPage {...props} />
      </MemoryRouter>
    </Web3Provider>,
  );
}

describe("My page", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("shows value cards in ETH with the fee card only for a prophet", async () => {
    // No wallet in tests: the cards ask for one.
    renderMe({ loadHoldings: async () => ({ holdingsValueWei: 0n, tokensHeldWei: 0n, bidSpentWei: 0n, feesWei: null }) });
    expect(screen.getByText("Connect a wallet to see your holdings.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/USD|\$/);
  });
});

describe("sidebar Following link", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  function renderApp(path: string) {
    return render(
      <Web3Provider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </Web3Provider>,
    );
  }

  it("never shows a prophet name link without a connected wallet", () => {
    renderApp("/");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.textContent).not.toContain(".prophecy.eth");
    expect(nav.querySelector('a[href^="/p/"]')).toBeNull();
  });
});
