import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Address } from "viem";
import { WalletGate } from "../components/WalletGate";
import { WorldGate } from "../components/WorldGate";
import { SampleBadge } from "../components/SampleBadge";
import {
  ISSUE_COPY,
  isValidProphetLabel,
  storeProphetLabel,
  worldUserMessage,
  type IssueSession,
} from "../lib/issue";
import { useIssueSession, useProphetLookup, useWalletBoundWorld } from "../lib/issueSession";
import { createReadProphetOf, createRegisterProphet, type RegisterProphetInput } from "../lib/launchpad";
import { MOCK_ISSUE_PLACEHOLDER, MOCK_PARENT_NAME } from "../lib/mock";
import { isMockMode } from "../lib/mode";
import { writeErrorMessage } from "../lib/writes";
import { createWorldClient, type WorldClient } from "../lib/world";

export function NamePage() {
  const { session, connecting } = useIssueSession();
  return <ClaimNameScreen session={session} walletConnecting={connecting} />;
}

export function ClaimNameScreen({
  session,
  walletConnecting = false,
  world: worldProp,
  parentName = import.meta.env.VITE_PARENT_NAME || MOCK_PARENT_NAME,
  registerProphet = createRegisterProphet(),
  lookupProphet,
}: {
  /** null: chain mode with no wallet connected. */
  session: IssueSession | null;
  walletConnecting?: boolean;
  world?: WorldClient;
  parentName?: string;
  registerProphet?: (input: RegisterProphetInput) => Promise<void>;
  lookupProphet?: (wallet: string) => Promise<string>;
}) {
  const navigate = useNavigate();
  // One client per screen. A new one each render makes WorldGate recheck the
  // server and drop the open World ID widget.
  const [world] = useState(() => worldProp ?? createWorldClient());
  const wallet = session?.wallet ?? null;
  const presetLabel = session?.prophetLabel ?? null;
  const readProphet = useMemo(() => lookupProphet ?? createReadProphetOf(), [lookupProphet]);
  const { lookup, retry: retryLookup } = useProphetLookup(wallet, presetLabel, readProphet);
  const onChainLabel = lookup.status === "ready" ? lookup.label : "";
  const walletReady = Boolean(wallet) && lookup.status === "ready";
  const returningProphet = Boolean(onChainLabel);
  const {
    walletRef,
    worldStatus,
    worldError,
    verified,
    onStatus: onWorldStatus,
    onErrorKind: onWorldError,
    onVerified: onWorldVerified,
    reset: resetWorld,
  } = useWalletBoundWorld(wallet);
  const [typedLabel, setProphetLabel] = useState(presetLabel ?? "");
  // A wallet that already has a name keeps it; the field is read-only then.
  const prophetLabel = onChainLabel || typedLabel;
  const [registerStatus, setRegisterStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [writeError, setWriteError] = useState<string | null>(null);

  // A different wallet is a different person on chain: drop its World result and banners.
  const [stateWallet, setStateWallet] = useState(wallet);
  if (stateWallet !== wallet) {
    setStateWallet(wallet);
    resetWorld();
    setProphetLabel(presetLabel ?? "");
    setRegisterStatus("idle");
    setWriteError(null);
  }

  const labelOk = isValidProphetLabel(prophetLabel);
  const registerBusy = registerStatus === "pending";
  const canContinue =
    walletReady && (returningProphet || (labelOk && worldStatus === "success")) && !registerBusy;
  const pending =
    registerBusy
      ? ISSUE_COPY.registerPending
      : walletReady && !returningProphet && worldStatus === "pending"
        ? ISSUE_COPY.pending
        : null;
  const error =
    writeError ??
    (returningProphet || worldStatus === "pending" || registerBusy ? null : worldUserMessage(worldError));
  const fullName = prophetLabel ? `${prophetLabel}.${parentName}` : "";
  const submitLabel = !wallet
    ? ISSUE_COPY.connectWallet
    : returningProphet
      ? ISSUE_COPY.oneTransaction
      : ISSUE_COPY.continueIssue;

  return (
    <main className="narrow stack">
      <div className="home-toolbar">
        <h1>{ISSUE_COPY.claimTitle}</h1>
        <SampleBadge />
      </div>
      <p className="faint">{ISSUE_COPY.claimLead}</p>
      <div className="steps">
        {returningProphet ? (
          <span className="step on">{ISSUE_COPY.oneTransaction}</span>
        ) : (
          <>
            <span className={`step${worldStatus !== "success" ? " on" : ""}`}>{ISSUE_COPY.step1}</span>
            <span className={`step${worldStatus === "success" ? " on" : ""}`}>{ISSUE_COPY.step2}</span>
          </>
        )}
      </div>

      {world.isMock && isMockMode() ? (
        <p className="faint small">
          Mock session: <Link to="/name?fresh=1">first-time</Link>
          {" · "}
          <Link to="/name?returning=1">returning prophet</Link>
        </p>
      ) : null}

      <form
        className="block create name-hero"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canContinue || registerBusy || !wallet) return;
          if (!returningProphet && !verified) return;
          const signer = wallet;
          void (async () => {
            setWriteError(null);
            if (!returningProphet && verified) {
              setRegisterStatus("pending");
              try {
                await registerProphet({
                  wallet: signer as Address,
                  label: prophetLabel,
                  nullifier: verified.nullifier,
                  serverSig: verified.serverSig,
                });
              } catch (err) {
                if (walletRef.current !== signer) return;
                const message = writeErrorMessage(err, "registerProphet");
                setRegisterStatus(message ? "failed" : "idle");
                setWriteError(message);
                return;
              }
              if (walletRef.current !== signer) return;
              storeProphetLabel(signer, prophetLabel);
              setRegisterStatus("success");
            }
            navigate("/create");
          })();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input
            aria-label="Name"
            value={prophetLabel}
            maxLength={16}
            placeholder={MOCK_ISSUE_PLACEHOLDER.prophetLabel}
            readOnly={returningProphet}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setProphetLabel(e.target.value.toLowerCase())}
          />
          <span className="faint small">3–16 characters, a–z and 0–9. Becomes {prophetLabel || "name"}.{parentName}</span>
        </label>

        {fullName ? <p className="name-preview">{fullName}</p> : null}

        {wallet && walletReady ? (
          <WorldGate
            key={wallet}
            returningProphet={returningProphet}
            prophetName={onChainLabel ? `${onChainLabel}.${parentName}` : ""}
            wallet={wallet}
            world={world}
            status={worldStatus}
            onStatus={onWorldStatus}
            onErrorKind={onWorldError}
            onVerified={onWorldVerified}
          />
        ) : (
          <WalletGate hasWallet={Boolean(wallet)} connecting={walletConnecting} lookup={lookup} onRetry={retryLookup} />
        )}

        {pending ? (
          <p className="banner-lock" data-testid={registerBusy ? "register-pending" : "world-pending"}>
            {pending}
          </p>
        ) : null}
        {registerStatus === "success" ? (
          <p className="up" data-testid="register-success">
            {ISSUE_COPY.registerSuccess}
          </p>
        ) : null}
        {error ? (
          <p className="banner-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn primary full" disabled={!canContinue || registerBusy}>
          {submitLabel}
        </button>
      </form>
    </main>
  );
}
