import { describe, expect, it } from "vitest";
import { resolveIssueSession } from "./issueSession";
import { MOCK_ISSUE_SESSION, MOCK_RETURNING_SESSION } from "./mock";

const WALLET = "0xC0ffee254729296a45a3885639AC7E10F9d54979" as const;
const none = () => null;

function search(query = "") {
  return new URLSearchParams(query);
}

describe("resolveIssueSession", () => {
  it("uses the connected wallet in chain mode", () => {
    expect(resolveIssueSession({ search: search(), mock: false, address: WALLET, storedLabel: none })).toEqual({
      wallet: WALLET,
      prophetLabel: null,
    });
  });

  it("returns no session in chain mode without a wallet", () => {
    expect(resolveIssueSession({ search: search(), mock: false, address: null })).toBeNull();
    expect(resolveIssueSession({ search: search(), mock: false })).toBeNull();
  });

  it("ignores the mock ?fresh / ?returning switches and the name cache in chain mode", () => {
    for (const query of ["fresh=1", "returning=1"]) {
      const session = resolveIssueSession({
        search: search(query),
        mock: false,
        address: WALLET,
        storedLabel: () => "mina",
      });
      expect(session).toEqual({ wallet: WALLET, prophetLabel: null });
    }
    expect(resolveIssueSession({ search: search("returning=1"), mock: false, address: null })).toBeNull();
  });

  it("uses mock wallets only in mock mode", () => {
    expect(resolveIssueSession({ search: search("returning=1"), mock: true, address: WALLET })).toEqual(
      MOCK_RETURNING_SESSION,
    );
    expect(resolveIssueSession({ search: search("fresh=1"), mock: true, address: WALLET })).toEqual(
      MOCK_ISSUE_SESSION,
    );
    expect(resolveIssueSession({ search: search(), mock: true, storedLabel: none })).toEqual(MOCK_ISSUE_SESSION);
  });

  it("reads the cached name for the mock wallet in mock mode", () => {
    const seen: string[] = [];
    const session = resolveIssueSession({
      search: search(),
      mock: true,
      storedLabel: (wallet) => {
        seen.push(wallet);
        return "mina";
      },
    });
    expect(session).toEqual({ wallet: MOCK_ISSUE_SESSION.wallet, prophetLabel: "mina" });
    expect(seen).toEqual([MOCK_ISSUE_SESSION.wallet]);
  });
});
