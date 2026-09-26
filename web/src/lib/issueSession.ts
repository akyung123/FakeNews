import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { readStoredProphetLabel, type IssueSession, type WorldStatus } from "./issue";
import { MOCK_ISSUE_SESSION, MOCK_RETURNING_SESSION } from "./mock";
import { isMockMode } from "./mode";
import type { WorldErrorKind, WorldServerSignature } from "./world";

/**
 * Who issues on /create and /name.
 *
 * Chain mode: the connected wallet, or null when no wallet is connected. The
 * World ID signal, the World server signature and `registerProphet` all use
 * this one address, so the signed digest matches `msg.sender`.
 * Mock mode: a mock wallet. `?returning=1` and `?fresh=1` pick the sample
 * prophet; otherwise the name this browser saw claimed for the mock wallet.
 */
export function resolveIssueSession(input: {
  search: URLSearchParams;
  mock: boolean;
  address?: Address | null;
  storedLabel?: (wallet: string) => string | null;
}): IssueSession | null {
  if (input.mock) {
    if (input.search.get("returning") === "1") return { ...MOCK_RETURNING_SESSION };
    if (input.search.get("fresh") === "1") return { ...MOCK_ISSUE_SESSION };
    const stored = (input.storedLabel ?? readStoredProphetLabel)(MOCK_ISSUE_SESSION.wallet);
    return { wallet: MOCK_ISSUE_SESSION.wallet, prophetLabel: stored };
  }
  if (!input.address) return null;
  return { wallet: input.address, prophetLabel: null };
}

export type IssueSessionState = {
  session: IssueSession | null;
  /** Wallet is still reconnecting after a page load. */
  connecting: boolean;
};

export function useIssueSession(): IssueSessionState {
  const [search] = useSearchParams();
  const { address, status } = useAccount();
  const mock = isMockMode();
  const session = useMemo(
    () => resolveIssueSession({ search, mock, address: address ?? null }),
    [search, mock, address],
  );
  const connecting = !mock && !session && (status === "connecting" || status === "reconnecting");
  return { session, connecting };
}

export type ProphetLookup =
  | { status: "loading" }
  | { status: "ready"; label: string }
  | { status: "error" };

function initialLookup(presetLabel: string | null): ProphetLookup {
  return presetLabel ? { status: "ready", label: presetLabel } : { status: "loading" };
}

/**
 * `prophetOf(wallet)` for the current wallet. A failed read stays an error
 * (never "not a prophet") so the screen can offer a retry. A result for an
 * earlier wallet is never shown for the current one.
 */
export function useProphetLookup(
  wallet: string | null,
  presetLabel: string | null,
  read: (wallet: string) => Promise<string>,
) {
  const [state, setState] = useState<{ wallet: string | null; lookup: ProphetLookup }>(() => ({
    wallet,
    lookup: initialLookup(presetLabel),
  }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!wallet) return;
    if (presetLabel) {
      setState({ wallet, lookup: { status: "ready", label: presetLabel } });
      return;
    }
    let cancelled = false;
    setState({ wallet, lookup: { status: "loading" } });
    read(wallet).then(
      (label) => {
        if (!cancelled) setState({ wallet, lookup: { status: "ready", label } });
      },
      () => {
        if (!cancelled) setState({ wallet, lookup: { status: "error" } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [wallet, presetLabel, read, attempt]);

  const lookup = state.wallet === wallet ? state.lookup : initialLookup(presetLabel);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  /** Re-read after `registerProphet`. Keeps the current state if the read fails or is still empty. */
  const refresh = useCallback(async () => {
    if (!wallet) return;
    try {
      const label = await read(wallet);
      if (label) setState((prev) => (prev.wallet === wallet ? { wallet, lookup: { status: "ready", label } } : prev));
    } catch {
      // registerStatus "success" already unlocks launch for this wallet.
    }
  }, [wallet, read]);

  return { lookup, retry, refresh };
}

/**
 * World step callbacks bound to one wallet. A result that arrives after the
 * wallet changed (a verify still in flight) is dropped, so a signature for one
 * address never unlocks another.
 */
export function useWalletBoundWorld(wallet: string | null) {
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const [worldStatus, setWorldStatus] = useState<WorldStatus>("idle");
  const [worldError, setWorldError] = useState<WorldErrorKind | null>(null);
  const [verified, setVerified] = useState<WorldServerSignature | null>(null);

  const onStatus = useCallback(
    (status: WorldStatus) => {
      if (walletRef.current !== wallet) return;
      setWorldStatus(status);
      if (status === "pending" || status === "success") setWorldError(null);
    },
    [wallet],
  );
  const onErrorKind = useCallback(
    (kind: WorldErrorKind) => {
      if (walletRef.current === wallet) setWorldError(kind);
    },
    [wallet],
  );
  const onVerified = useCallback(
    (result: WorldServerSignature) => {
      if (walletRef.current === wallet) setVerified(result);
    },
    [wallet],
  );
  const reset = useCallback(() => {
    setWorldStatus("idle");
    setWorldError(null);
    setVerified(null);
  }, []);

  return { walletRef, worldStatus, worldError, verified, onStatus, onErrorKind, onVerified, reset };
}
