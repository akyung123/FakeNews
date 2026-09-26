import { ISSUE_COPY } from "../lib/issue";
import type { ProphetLookup } from "../lib/issueSession";

/**
 * Shown in place of the World step until the wallet and its `prophetOf` are
 * known. Returns null once the World step can render.
 */
export function WalletGate({
  hasWallet,
  connecting,
  lookup,
  onRetry,
}: {
  hasWallet: boolean;
  connecting: boolean;
  lookup: ProphetLookup;
  onRetry: () => void;
}) {
  if (!hasWallet) {
    return (
      <section className="world-gate" data-testid="wallet-gate">
        <p className="strong">{connecting ? ISSUE_COPY.connectingWallet : ISSUE_COPY.connectWallet}</p>
        {connecting ? null : <p className="faint">{ISSUE_COPY.connectWalletHelp}</p>}
      </section>
    );
  }
  if (lookup.status === "loading") {
    return (
      <section className="world-gate" data-testid="wallet-gate">
        <p className="faint" data-testid="prophet-lookup-pending">
          {ISSUE_COPY.checkingWallet}
        </p>
      </section>
    );
  }
  if (lookup.status === "error") {
    return (
      <section className="world-gate" data-testid="wallet-gate">
        <p className="banner-error" role="alert" data-testid="prophet-lookup-failed">
          {ISSUE_COPY.lookupFailed}
        </p>
        <button type="button" className="btn ghost" onClick={onRetry}>
          {ISSUE_COPY.retry}
        </button>
      </section>
    );
  }
  return null;
}
